package org.abundent.humkinradio;

import android.os.Handler;
import android.content.SharedPreferences;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import android.os.Looper;
import android.os.SystemClock;
import org.json.JSONArray;
import org.json.JSONObject;

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
    private static RadioCatalog.Station roadShuffleStation;
    private static RadioCatalog.Station pirateStation;
    private static PirateFrequency.Dial pirateDial;
    private static PirateWeather.Board pirateWeather;
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
    private MediaItem previousRecord;
    private final Handler checkpointHandler = new Handler(Looper.getMainLooper());
    private boolean checkpointScheduled;
    private final Runnable checkpointTick = () -> {
        checkpointScheduled = false;
        savePlaybackCheckpoint();
        updateCheckpointTimer();
    };

    private final ExecutorService leagueNetwork=Executors.newSingleThreadExecutor();
    private final Handler leagueHandler=new Handler(Looper.getMainLooper());
    private String leagueTrackId="";
    private long leagueHeardMs=0L,leagueLastTick=0L;
    private boolean leagueSent=false;
    private String outpostTrackId="",outpostTrackTitle="";
    private long outpostTrackHeardMs=0L,outpostUnbankedMs=0L;
    private boolean outpostTrackQualified=false;

    private void flushOutpost() {
        if(outpostUnbankedMs>0L){
            SignalRpg.audible(getApplicationContext(),outpostUnbankedMs);
            // Same bounded, actually audible Media3 batch. No independent
            // clock or background XP generator in the listening report.
            OrchardLedger.Snapshot orchard=OrchardLedger.snapshot(getApplicationContext());
            NativeNightWatch.record(getApplicationContext(),outpostTrackId,
                    outpostTrackTitle,outpostUnbankedMs,orchard.level,orchard.owned);
            outpostUnbankedMs=0L;
        }
    }
    private final Runnable leagueTick=new Runnable(){
        @Override public void run() {
            long now=SystemClock.elapsedRealtime();
            MediaItem current=player==null?null:player.getCurrentMediaItem();
            String id=current==null?"":current.mediaId;
            if (!id.equals(leagueTrackId)) {
                leagueTrackId=id;leagueHeardMs=0L;leagueSent=false;
            }
            boolean playing=player!=null && player.isPlaying() &&
                    player.getPlaybackState()==Player.STATE_READY &&
                    (sameTimeStation!=null || roadShuffleStation!=null || pirateStation!=null) &&
                    !id.isEmpty()&&!id.startsWith("album:");
            long delta=leagueLastTick>0L?Math.min(2500L,Math.max(0L,now-leagueLastTick)):0L;
            leagueLastTick=now;
            // The optional Outpost grows exclusively from actual audible
            // Media3 playback. All modes count (radio/shuffle/albums), but
            // the public Top 42's separate radio restrictions stay unchanged.
            if(!id.equals(outpostTrackId)){
                flushOutpost();
                outpostTrackId=id;
                outpostTrackTitle=current==null||current.mediaMetadata.title==null?
                        id:current.mediaMetadata.title.toString();
                outpostTrackHeardMs=0L;outpostTrackQualified=false;
            }
            boolean audible=player!=null && player.isPlaying() &&
                    player.getPlaybackState()==Player.STATE_READY && !id.isEmpty();
            if(audible){
                outpostUnbankedMs+=delta;
                outpostTrackHeardMs+=delta;
                if(!outpostTrackQualified && outpostTrackHeardMs>=30_000L){
                    outpostTrackQualified=true;
                    String title=current==null||current.mediaMetadata.title==null?
                            id:current.mediaMetadata.title.toString();
                    SignalRpg.qualifiedTrack(getApplicationContext(),id,title);
                }
            }
            if(outpostUnbankedMs>=8_000L || (!audible && outpostUnbankedMs>0L))
                flushOutpost();
            if(playing&&!leagueSent){
                leagueHeardMs+=delta;
                if(leagueHeardMs>=30000L){
                    leagueSent=true;
                    final String finished=id;
                    leagueNetwork.execute(()->LeaguePlayReporter.report(
                            getApplicationContext(),finished,leagueHeardMs/1000L));
                }
            }
            leagueHandler.postDelayed(this,1000L);
        }
    };

    static void armSameTime(RadioCatalog.Station station,long firstUnqueuedCycle) {
        pirateStation=null;pirateDial=null;pirateWeather=null;
        roadShuffleStation=null;
        sameTimeStation=station;
        upcomingCycle=firstUnqueuedCycle;
        if (activeService != null) activeService.syncWarmStatic();
    }
    static void armRoadShuffle(RadioCatalog.Station station) {
        pirateStation=null;pirateDial=null;pirateWeather=null;
        sameTimeStation=null;
        roadShuffleStation=station;
        if (activeService != null) activeService.syncWarmStatic();
    }
    static void armPirateStation(RadioCatalog.Station station,
            PirateFrequency.Dial dial,PirateWeather.Board weather) {
        // Only one program can own the native media service at once.
        sameTimeStation=null;roadShuffleStation=null;
        pirateStation=station;pirateDial=dial;pirateWeather=weather;
        if(activeService!=null)activeService.syncWarmStatic();
    }
    static boolean isPirateArmed(){return pirateStation!=null;}
    static void clearSameTime() {
        // Album playback is neither a broadcast nor a roaming shuffle.
        sameTimeStation=null;
        roadShuffleStation=null;
        pirateStation=null;pirateDial=null;pirateWeather=null;
        if (activeService != null) activeService.syncWarmStatic();
    }
    static void setWarmStaticEnabled(boolean enabled) {
        // UI is not the enforcement boundary: persisted old preferences or
        // another caller cannot turn off the station's default signal before
        // the listener has earned the first Antenna upgrade.
        staticEnabled = activeService == null || SignalRpg.canControlRadioStatic(activeService)
                ? enabled : true;
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

    /**
     * Only public playback metadata goes into this device's private history;
     * nothing is uploaded, and no identifying listener data is collected.
     * Capture the *previous* item on a transition rather than claiming a
     * newly selected record has already been heard.
     */
    private void rememberRecord(MediaItem item) {
        if (item == null || item.mediaMetadata.title == null) return;
        try {
            String title = item.mediaMetadata.title.toString();
            if (title.trim().isEmpty()) return;
            JSONObject entry = new JSONObject()
                    .put("id", item.mediaId)
                    .put("title", title)
                    .put("artist", item.mediaMetadata.artist == null
                            ? "HUMKIN" : item.mediaMetadata.artist.toString())
                    .put("time", System.currentTimeMillis());
            String old = getSharedPreferences("humkin-radio", MODE_PRIVATE)
                    .getString("recent-records", "[]");
            JSONArray before = new JSONArray(old);
            JSONArray after = new JSONArray();
            after.put(entry);
            for (int i = 0; i < before.length() && after.length() < 50; i++) {
                JSONObject row = before.optJSONObject(i);
                if (row != null && !item.mediaId.equals(row.optString("id")))
                    after.put(row);
            }
            getSharedPreferences("humkin-radio", MODE_PRIVATE).edit()
                    .putString("recent-records", after.toString()).apply();
        } catch (Exception ignored) {
            // History must never delay or break a song transition.
        }
    }

    /** Save only public track IDs and current playhead; never cache MP3 URLs. */
    private void savePlaybackCheckpoint() {
        if (player == null || player.getMediaItemCount() == 0) return;
        try {
            MediaItem item = player.getCurrentMediaItem();
            int current = player.getCurrentMediaItemIndex();
            if (item == null || current < 0) return;
            String mode = sameTimeStation != null ? "radio"
                    : pirateStation != null ? "pirate"
                    : item.mediaId.startsWith("album:") ? "album" : "shuffle";
            List<String> remaining = new ArrayList<>();
            int limit = Math.min(player.getMediaItemCount(),
                    current + PlaybackContinuity.MAX_QUEUE_IDS);
            for (int i = current; i < limit; i++) {
                MediaItem queued = player.getMediaItemAt(i);
                if (queued != null && queued.mediaId != null && !queued.mediaId.isEmpty())
                    remaining.add(queued.mediaId);
            }
            PlaybackContinuity.save(getSharedPreferences("humkin-radio", MODE_PRIVATE),
                    new PlaybackContinuity.Saved(mode, item.mediaId,
                            System.currentTimeMillis(),
                            player.getCurrentPosition(), player.isPlaying(), remaining));
        } catch (Exception ignored) {
            // Not a prerequisite for making or continuing radio.
        }
    }

    private void updateCheckpointTimer() {
        if (player != null && player.isPlaying() && !checkpointScheduled) {
            checkpointScheduled = true;
            checkpointHandler.postDelayed(checkpointTick, 12000L);
        } else if ((player == null || !player.isPlaying()) && checkpointScheduled) {
            checkpointHandler.removeCallbacks(checkpointTick);
            checkpointScheduled = false;
        }
    }

    private void extendClockIfNeeded() {
        if(player==null||player.getMediaItemCount()==0)return;
        int current=player.getCurrentMediaItemIndex();
        if(current<0)return;
        int remaining=player.getMediaItemCount()-current;
        if (sameTimeStation!=null && remaining<=4) {
            // Browser-style shared clock: remain on the published schedule.
            player.addMediaItems(sameTimeStation.itemsForCycle(upcomingCycle++));
        } else if (pirateStation!=null && pirateDial!=null && remaining<=4) {
            // Keep the personally tuned station rolling while screen is locked.
            // No network work is done in the media session or transition path.
            List<MediaItem> next=PirateFrequency.mix(getApplicationContext(),
                    pirateStation,pirateDial,pirateWeather,false,System.nanoTime());
            if(!next.isEmpty())player.addMediaItems(next);
        } else if (roadShuffleStation!=null && remaining<=4) {
            // Overnight Road Shuffle must not wrap back to the *same* queue.
            // Rebuild ahead of time with local recent-play history.
            Map<String,Long> heard = new HashMap<>();
            try {
                JSONArray history = new JSONArray(
                    getSharedPreferences("humkin-radio", MODE_PRIVATE)
                            .getString("recent-records", "[]"));
                long now = System.currentTimeMillis();
                for (int i=0; i<history.length(); i++) {
                    JSONObject row = history.optJSONObject(i);
                    if (row != null && now-row.optLong("time",0L)
                            < FreshRotation.HOUR_MS)
                        heard.put(row.optString("id",""),row.optLong("time",0L));
                }
                if (previousRecord != null) heard.put(previousRecord.mediaId,now);
            } catch (Exception ignored) { /* Playback never waits for history. */ }
            player.addMediaItems(roadShuffleStation.shuffleQueue(
                    heard, System.currentTimeMillis()));
        }
        // Limit the native playlist in memory without cutting current music.
        if(current>100)player.removeMediaItems(0,current-3);
    }

    @Override public void onCreate() {
        super.onCreate();
        activeService=this;
        staticEnabled=!SignalRpg.canControlRadioStatic(this) ||
                getSharedPreferences("humkin-radio",MODE_PRIVATE)
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
                updateCheckpointTimer();
            }
            @Override public void onPlayWhenReadyChanged(boolean playWhenReady, int reason) {
                SharedPreferences.Editor edit = getSharedPreferences("humkin-radio", MODE_PRIVATE)
                        .edit();
                if (!playWhenReady) edit.putLong("paused-at-ms", System.currentTimeMillis());
                else edit.remove("paused-at-ms");
                edit.apply();
                savePlaybackCheckpoint();
            }
            @Override public void onPlaybackStateChanged(int state) {
                if(state==Player.STATE_READY)consecutiveFailures=0;
            }
            @Override public void onMediaItemTransition(MediaItem item,int reason) {
                flushOutpost();
                outpostTrackId="";outpostTrackTitle="";
                outpostTrackHeardMs=0L;outpostTrackQualified=false;
                leagueTrackId="";leagueHeardMs=0L;leagueSent=false;
                if (previousRecord != null && item != null
                        && !previousRecord.mediaId.equals(item.mediaId))
                    rememberRecord(previousRecord);
                previousRecord = item;
                extendClockIfNeeded();
                savePlaybackCheckpoint();
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
        leagueLastTick=SystemClock.elapsedRealtime();
        leagueHandler.postDelayed(leagueTick,1000L);
    }

    @Override public MediaSession onGetSession(MediaSession.ControllerInfo info) {
        return session;
    }

    @Override public void onDestroy() {
        leagueHandler.removeCallbacks(leagueTick);
        flushOutpost();
        leagueNetwork.shutdown();
        // Capture where the last record stopped before clearing mode state.
        savePlaybackCheckpoint();
        checkpointHandler.removeCallbacks(checkpointTick);
        checkpointScheduled = false;
        sameTimeStation=null;
        roadShuffleStation=null;
        pirateStation=null;pirateDial=null;pirateWeather=null;
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
