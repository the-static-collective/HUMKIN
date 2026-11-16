package org.abundent.humkinradio;

import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;

import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;

/**
 * Media3 owns lock-screen/BT controls and background song transitions.
 * Native Same-Time queues are extended INSIDE the playback service, even if
 * Android stops the Activity when the listener locks their screen.
 */
public final class RadioPlaybackService extends MediaSessionService {
    private static RadioCatalog.Station sameTimeStation;
    private static volatile boolean staticEnabled = true;
    private static RadioPlaybackService activeService;
    private static long upcomingCycle;
    private ExoPlayer player;
    private MediaSession session;
    private int consecutiveFailures;
    private WarmStaticBed warmStatic;
    private final Handler signalHandler = new Handler(Looper.getMainLooper());
    private final Runnable startDip = this::beginDip;
    private final Runnable stepDip = this::advanceDip;
    private FractalSignalPattern weather;
    private FractalSignalPattern.Cue dip;
    private boolean signalRunning;
    private long dipStartMs;
    private float cleanVolume = 1f;

    static void armSameTime(RadioCatalog.Station station,long firstUnqueuedCycle) {
        sameTimeStation=station;
        upcomingCycle=firstUnqueuedCycle;
        if (activeService != null) activeService.syncWarmStatic();
    }
    static void clearSameTime() {
        sameTimeStation=null;
        if (activeService != null) activeService.syncWarmStatic();
    }
    static void setWarmStaticEnabled(boolean enabled) {
        staticEnabled=enabled;
        if (activeService != null) activeService.syncWarmStatic();
    }

    private boolean radioAudible() {
        return staticEnabled && sameTimeStation != null && player != null
                && player.isPlaying() && player.getPlaybackState() == Player.STATE_READY;
    }

    private void syncWarmStatic() {
        if (warmStatic == null || player == null) return;
        boolean on = radioAudible();
        // All weather follows the radio-only static preference; never albums or shuffle.
        warmStatic.setAudible(on);
        if (on && !signalRunning) {
            signalRunning = true;
            cleanVolume = player.getVolume();
            if (weather == null) weather = new FractalSignalPattern(
                    SystemClock.elapsedRealtimeNanos() ^ System.currentTimeMillis());
            scheduleNextDip();
        } else if (!on && signalRunning) {
            stopWeather();
        }
    }

    private void scheduleNextDip() {
        if (!signalRunning || !radioAudible()) return;
        dip = weather.next();
        signalHandler.postDelayed(startDip, dip.delayMs);
    }

    private void beginDip() {
        if (!signalRunning || !radioAudible() || dip == null) {
            syncWarmStatic();
            return;
        }
        dipStartMs = SystemClock.uptimeMillis();
        advanceDip();
    }

    private void advanceDip() {
        if (!signalRunning || !radioAudible() || dip == null) {
            syncWarmStatic();
            return;
        }
        double progress = (SystemClock.uptimeMillis() - dipStartMs)
                / (double) dip.durationMs;
        float envelope = FractalSignalPattern.envelope(progress);
        // Change only ExoPlayer's session gain, never system volume or source audio.
        // The static bed narrows toward mono while the signal gently loses level.
        player.setVolume(cleanVolume * (1f - dip.depth * envelope));
        warmStatic.setNarrowing(envelope);
        if (progress < 1.0) {
            signalHandler.postDelayed(stepDip, 25);
        } else {
            dip = null;
            scheduleNextDip();
        }
    }

    private void stopWeather() {
        signalRunning = false;
        signalHandler.removeCallbacks(startDip);
        signalHandler.removeCallbacks(stepDip);
        dip = null;
        if (warmStatic != null) warmStatic.setNarrowing(0f);
        if (player != null && player.getVolume() != cleanVolume)
            player.setVolume(cleanVolume);
    }

    private void extendClockIfNeeded() {
        if (sameTimeStation==null||player==null||player.getMediaItemCount()==0)return;
        int current=player.getCurrentMediaItemIndex();
        // Extend before the end of a cycle without seeking/cutting a track.
        if(current>=0&&player.getMediaItemCount()-current<=4) {
            player.addMediaItems(sameTimeStation.itemsForCycle(upcomingCycle++));
        }
        // Bound long-running playlist memory while keeping previous/next tracks.
        if(current>100)player.removeMediaItems(0,current-3);
    }

    @Override public void onCreate() {
        super.onCreate();
        activeService=this;
        staticEnabled=getSharedPreferences("humkin-radio",MODE_PRIVATE)
                .getBoolean("analog-static",true);
        warmStatic=new WarmStaticBed();
        player=new ExoPlayer.Builder(this).build();
        player.setAudioAttributes(new AudioAttributes.Builder()
                .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                .setUsage(C.USAGE_MEDIA).build(),true);
        player.setHandleAudioBecomingNoisy(true);
        player.setRepeatMode(Player.REPEAT_MODE_ALL);
        player.addListener(new Player.Listener(){
            @Override public void onEvents(Player player,Player.Events events) {
                syncWarmStatic();
            }
            @Override public void onPlaybackStateChanged(int state) {
                if(state==Player.STATE_READY)consecutiveFailures=0;
            }
            @Override public void onMediaItemTransition(MediaItem item,int reason) {
                extendClockIfNeeded();
            }
            @Override public void onPlayerError(PlaybackException error) {
                if(++consecutiveFailures<=3&&player.getMediaItemCount()>1){
                    player.seekToNextMediaItem();
                    player.prepare();
                    player.play();
                }
            }
        });
        session=new MediaSession.Builder(this,player).build();
    }

    @Override public MediaSession onGetSession(MediaSession.ControllerInfo info) {
        return session;
    }

    @Override public void onDestroy() {
        sameTimeStation=null;
        stopWeather();
        if (warmStatic != null) {
            warmStatic.close();
            warmStatic=null;
        }
        if (activeService == this) activeService=null;
        if(session!=null){session.release();session=null;}
        if(player!=null){player.release();player=null;}
        super.onDestroy();
    }
}
