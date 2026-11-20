package org.abundent.humkinradio;

import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.MimeTypes;

/** A real public HLS feed from the current HUMKIN Tower.
 * Keep station ID separate from song IDs: no fabricated per-track HUM, game
 * unlock, collection, or artwork until timed broadcast cues are verified.
 */
final class TowerLive {
    private static final String WORKER=
            "https://humkin-long-wave.joyvolcanomusic.workers.dev";
    private static final String STATION_ONE="tower:station-one";
    private TowerLive(){}

    static String stream(String frequency){
        if(frequency==null||!frequency.matches("[a-z0-9][a-z0-9-]{0,31}"))
            return null;
        return WORKER+"/hls/"+
                ("station-one".equals(frequency)?"":frequency+"/")+"live.m3u8";
    }
    static boolean isLive(MediaItem item){
        return item!=null && STATION_ONE.equals(item.mediaId);
    }
    static MediaItem stationOne(){
        return new MediaItem.Builder()
                .setMediaId(STATION_ONE)
                .setUri(stream("station-one"))
                .setMimeType(MimeTypes.APPLICATION_M3U8)
                .setMediaMetadata(new MediaMetadata.Builder()
                        .setTitle("HUMKIN · Tower Live")
                        .setArtist("Station One · Shared Broadcast")
                        .setAlbumTitle("HUMKIN Radio")
                        .build())
                .build();
    }
}
