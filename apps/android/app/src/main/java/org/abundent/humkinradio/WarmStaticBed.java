package org.abundent.humkinradio;

import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;
import java.util.Random;

/**
 * Quiet, synthesized analog air. An independent PCM layer: it never replaces,
 * reprocesses, or changes the music stream. The service is its sole owner.
 * The renderer sleeps whenever radio is paused or another source is selected.
 */
final class WarmStaticBed {
    private static final int RATE = 22050;
    private static final int FRAMES = 1024;
    // Match the website's 37.8% texture, reduced by the requested 4.2%.
    private static final float GAIN = (float)
            ((.004 + Math.pow(.378, 1.35) * .085) * .958);
    private final Object gate = new Object();
    private volatile boolean audible;
    private volatile boolean closed;
    private volatile float narrowing;
    void setNarrowing(float amount) {
        narrowing = Math.max(0f, Math.min(1f, amount));
    }
    private Thread renderer;

    void setAudible(boolean on) {
        if (closed) return;
        audible = on;
        synchronized (gate) {
            if (on && renderer == null) {
                renderer = new Thread(this::render, "HUMKIN-analog-air");
                renderer.setDaemon(true);
                renderer.start();
            }
            gate.notifyAll();
        }
    }

    void close() {
        closed = true;
        audible = false;
        narrowing = 0f;
        synchronized (gate) { gate.notifyAll(); }
    }

    private void render() {
        AudioTrack track = null;
        boolean playing = false;
        try {
            int minimum = AudioTrack.getMinBufferSize(RATE,
                    AudioFormat.CHANNEL_OUT_STEREO, AudioFormat.ENCODING_PCM_16BIT);
            if (minimum <= 0) return;
            int bytes = Math.max(minimum, FRAMES * 2 * 2 * 3);
            track = new AudioTrack(
                    new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_MEDIA)
                            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build(),
                    new AudioFormat.Builder()
                            .setSampleRate(RATE)
                            .setChannelMask(AudioFormat.CHANNEL_OUT_STEREO)
                            .setEncoding(AudioFormat.ENCODING_PCM_16BIT).build(),
                    bytes, AudioTrack.MODE_STREAM, android.media.AudioManager.AUDIO_SESSION_ID_GENERATE);
            if (track.getState() != AudioTrack.STATE_INITIALIZED) return;

            short[] buffer = new short[FRAMES * 2];
            Random random = new Random();
            float[] colored = {0f, 0f};
            float[] smooth = {0f, 0f};
            float[] low = {0f, 0f};
            float[] stereo = new float[2];
            long frame = 0;
            while (!closed) {
                if (!audible) {
                    if (playing) {
                        track.pause();
                        track.flush();
                        playing = false;
                    }
                    synchronized (gate) {
                        if (!audible && !closed) gate.wait(650);
                    }
                    continue;
                }
                if (!playing) {
                    track.play();
                    playing = true;
                }
                for (int i = 0; i < FRAMES; i++, frame++) {
                    // The website's gentle four-beat slow swell, not a pulse in the music.
                    double swell = 1 + .115 * Math.sin(2 * Math.PI * frame * (92.0 / 240.0) / RATE);
                    for (int channel = 0; channel < 2; channel++) {
                        float white = random.nextFloat() * 2 - 1;
                        colored[channel] = colored[channel] * .96f + white * .04f;
                        float mixed = white * .58f + colored[channel] * .8f;
                        // Soften sharp top-end noise and roll off subsonic rumble.
                        smooth[channel] = smooth[channel] * .62f + mixed * .38f;
                        low[channel] = low[channel] * .997f + smooth[channel] * .003f;
                        stereo[channel] = (smooth[channel] - low[channel]) * GAIN * (float) swell;
                    }
                    // Recenter only independent static, never collapse music stereo.
                    float center = (stereo[0] + stereo[1]) * .5f;
                    float narrowingNow = narrowing;
                    float left = stereo[0] + (center - stereo[0]) * narrowingNow;
                    float right = stereo[1] + (center - stereo[1]) * narrowingNow;
                    buffer[i * 2] = (short) (Math.max(-1f, Math.min(1f, left)) * 32767);
                    buffer[i * 2 + 1] = (short) (Math.max(-1f, Math.min(1f, right)) * 32767);
                }
                int wrote = track.write(buffer, 0, buffer.length, AudioTrack.WRITE_BLOCKING);
                if (wrote < 0) break;
            }
        } catch (Exception ignored) {
            // Unsupported audio routes must never interrupt native radio playback.
        } finally {
            if (track != null) {
                try { if (playing) track.pause(); } catch (Exception ignored) {}
                try { track.flush(); } catch (Exception ignored) {}
                track.release();
            }
        }
    }
}
