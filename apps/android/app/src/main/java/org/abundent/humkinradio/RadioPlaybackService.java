package org.abundent.humkinradio;

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
    private static long upcomingCycle;
    private ExoPlayer player;
    private MediaSession session;
    private int consecutiveFailures;

    static void armSameTime(RadioCatalog.Station station,long firstUnqueuedCycle) {
        sameTimeStation=station;
        upcomingCycle=firstUnqueuedCycle;
    }
    static void clearSameTime() {sameTimeStation=null;}

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
        player=new ExoPlayer.Builder(this).build();
        player.setAudioAttributes(new AudioAttributes.Builder()
                .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                .setUsage(C.USAGE_MEDIA).build(),true);
        player.setHandleAudioBecomingNoisy(true);
        player.setRepeatMode(Player.REPEAT_MODE_ALL);
        player.addListener(new Player.Listener(){
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
        if(session!=null){session.release();session=null;}
        if(player!=null){player.release();player=null;}
        super.onDestroy();
    }
}
