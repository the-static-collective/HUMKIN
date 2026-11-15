package org.abundent.humkinradio;

import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;

/**
 * Genuine Android audio service, not a WebView tab. Media3 owns lock-screen
 * controls and the playback foreground service so songs continue screen-off.
 */
public final class RadioPlaybackService extends MediaSessionService {
    private ExoPlayer player;
    private MediaSession session;
    private int consecutiveFailures;

    @Override public void onCreate() {
        super.onCreate();
        player = new ExoPlayer.Builder(this).build();
        player.setAudioAttributes(new AudioAttributes.Builder()
                .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                .setUsage(C.USAGE_MEDIA).build(), true);
        player.setHandleAudioBecomingNoisy(true);
        player.setRepeatMode(Player.REPEAT_MODE_ALL);
        player.addListener(new Player.Listener() {
            @Override public void onPlaybackStateChanged(int state) {
                if (state == Player.STATE_READY) consecutiveFailures = 0;
            }
            @Override public void onPlayerError(PlaybackException error) {
                // Skip a bad remote record, without retrying forever on bad network.
                if (++consecutiveFailures <= 3 && player.getMediaItemCount() > 1) {
                    player.seekToNextMediaItem();
                    player.prepare();
                    player.play();
                }
            }
        });
        session = new MediaSession.Builder(this, player).build();
    }

    @Override public MediaSession onGetSession(MediaSession.ControllerInfo info) {
        return session;
    }

    @Override public void onDestroy() {
        if (session != null) {
            session.release();
            session = null;
        }
        if (player != null) {
            player.release();
            player = null;
        }
        super.onDestroy();
    }
}
