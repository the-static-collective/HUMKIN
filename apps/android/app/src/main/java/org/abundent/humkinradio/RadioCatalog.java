package org.abundent.humkinradio;

import android.net.Uri;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Load the same ordered approved source list as the public browser radio:
 * static rotation, allowlisted field carts, cloud-published records and their
 * owner-edited overrides. The app never accesses private draft uploads.
 */
final class RadioCatalog {
    private static final String ORIGIN="https://humkin.abundent.org/";
    private static final String CONFIG=ORIGIN+"fm/rotation.json";
    private static final String AIR=ORIGIN+"fm/air-carts.json";
    private static final String API="https://kbhqacsdvjsstzyplqij.supabase.co";
    // Public publishable key from the station site, NOT a service-role secret.
    private static final String KEY="sb_publishable_Bv9JuOctSQTmnE3O1dP8RA_MKRNSD-o";
    private static final Uri COVER=Uri.parse(ORIGIN+"cover.jpg");

    private static final class Track {
        final String id,title,artist,album,url;
        final long durationMs;
        final boolean bumper;
        Track(String id,String title,String artist,String album,String url,
              long durationMs,boolean bumper) {
            this.id=id;this.title=title;this.artist=artist;this.album=album;
            this.url=url;this.durationMs=durationMs;this.bumper=bumper;
        }
        Track override(JSONObject row) {
            return new Track(id,row.optString("title",title),row.optString("artist",artist),
                    row.optString("album",album),url,durationMs,
                    "bumper".equals(row.optString("kind",bumper?"bumper":"song")));
        }
        MediaItem mediaItem() {
            MediaMetadata meta=new MediaMetadata.Builder()
                    .setTitle(title).setArtist(artist).setAlbumTitle(album)
                    .setArtworkUri(COVER).build();
            return new MediaItem.Builder().setMediaId(id).setUri(url)
                    .setMediaMetadata(meta).build();
        }
    }

    static final class Station {
        private final List<Track> tracks;
        final SharedClock clock;
        final long clockOffsetMs;
        final boolean clockCalibrated;
        final boolean catalogComplete;
        final boolean scheduledShowsExist;
        private final int cadence;

        Station(List<Track> tracks,int cadence,long epoch,long offset,
                boolean calibrated,boolean complete,boolean scheduled) {
            this.tracks=Collections.unmodifiableList(new ArrayList<>(tracks));
            this.clockOffsetMs=offset;this.clockCalibrated=calibrated;
            this.catalogComplete=complete;this.scheduledShowsExist=scheduled;
            this.cadence=cadence;
            List<Long> lengths=new ArrayList<>();
            List<Integer> songs=new ArrayList<>(),bumpers=new ArrayList<>();
            for (int i=0;i<tracks.size();i++) {
                Track t=tracks.get(i);
                lengths.add(t.durationMs);
                (t.bumper?bumpers:songs).add(i);
            }
            clock=new SharedClock(lengths,songs,bumpers,cadence,epoch);
        }
        long stationNow() {return System.currentTimeMillis()+clockOffsetMs;}
        SharedClock.Cue tuneAt(long now) {return clock.at(now);}
        List<MediaItem> itemsForCycle(long cycle) {
            List<MediaItem> out=new ArrayList<>();
            for(int idx:clock.sequence(cycle))out.add(tracks.get(idx).mediaItem());
            return out;
        }
        List<MediaItem> initialClockQueue(SharedClock.Cue cue) {
            List<Integer> current=clock.sequence(cue.cycle);
            List<MediaItem> out=new ArrayList<>();
            for(int i=cue.slot;i<current.size();i++)
                out.add(tracks.get(current.get(i)).mediaItem());
            out.addAll(itemsForCycle(cue.cycle+1));
            return out;
        }
        List<MediaItem> shuffleQueue() {
            List<Integer> music=new ArrayList<>(),bumpers=new ArrayList<>();
            for(int i=0;i<tracks.size();i++)
                (tracks.get(i).bumper?bumpers:music).add(i);
            Collections.shuffle(music);
            Collections.shuffle(bumpers);
            List<MediaItem> out=new ArrayList<>();
            for(int i:SharedClock.insertBumpers(music,bumpers,cadence))
                out.add(tracks.get(i).mediaItem());
            return out;
        }
        int songsCount() {
            int n=0;for(Track t:tracks)if(!t.bumper)n++;return n;
        }
    }

    static Station loadStation() throws Exception {
        JSONObject rotation=new JSONObject(fetch(CONFIG,false));
        if(!"track_list".equals(rotation.optString("source_type")))
            throw new IOException("Unsupported station playlist");
        JSONArray staticRows=rotation.getJSONArray("tracks");
        List<Track> staticTracks=new ArrayList<>();
        for(int i=0;i<staticRows.length();i++){
            JSONObject row=staticRows.getJSONObject(i);
            URL url=new URL(new URL(CONFIG),row.getString("src"));
            if(!safeStaticUrl(url))continue;
            Track t=new Track(row.optString("id","static-"+i),row.optString("title","HUMKIN"),
                    row.optString("artist","HUMKIN"),row.optString("album","HUMKIN RADIO"),
                    url.toString(),durationMs(row.optDouble("duration",0)),false);
            if(t.durationMs>0)staticTracks.add(t);
        }
        if(staticTracks.isEmpty())throw new IOException("No static station records");

        boolean complete=true;
        try {
            JSONObject data=new JSONObject(fetch(AIR,false));
            if(!"humkin.radio.air-carts/v1".equals(data.optString("schema_version")))
                throw new IOException("Air-cart schema mismatch");
            JSONArray rows=data.getJSONArray("carts");
            if(rows.length()>16)throw new IOException("Too many field carts");
            for(int i=0;i<rows.length();i++){
                JSONObject t=rows.getJSONObject(i);
                String id=t.optString("id"),sha=t.optString("sha256"),src=t.optString("src");
                if(!id.matches("field-fm-[0-9]{3}")||!sha.matches("[0-9a-f]{64}"))continue;
                URL url=new URL(new URL(AIR),src);
                if(!url.getProtocol().equals("https")||
                   !url.getHost().equals("humkin.abundent.org")||
                   !url.getPath().startsWith("/fm/studio/recordings/")||
                   !url.getPath().substring("/fm/studio/recordings/".length())
                         .matches("[a-z0-9-]+\\.mp3"))continue;
                long duration=durationMs(t.optDouble("duration_seconds",0));
                if(duration<1000||duration>120000)continue;
                staticTracks.add(new Track("air-"+id,t.optString("title","HUMKIN ID"),
                       "HUMKIN","HUMKIN RADIO · FIELD CARTS",url.toString(),duration,true));
            }
        }catch(Exception e){complete=false;}

        // Browser overrides are applied to static rotation + allowlisted carts.
        List<Track> tracks=new ArrayList<>();
        Map<String,JSONObject> overrides=new HashMap<>();
        try{
            JSONArray rows=new JSONArray(fetch(API+"/rest/v1/humkin_radio_static_overrides"
                    +"?select=track_id,title,artist,album,enabled,kind&limit=1000",true));
            for(int i=0;i<rows.length();i++){
                JSONObject o=rows.getJSONObject(i);
                overrides.put(o.optString("track_id"),o);
            }
        }catch(Exception e){complete=false;}
        for(Track t:staticTracks){
            JSONObject override=overrides.get(t.id);
            if(override!=null&& !override.optBoolean("enabled",true))continue;
            tracks.add(override==null?t:t.override(override));
        }

        try{
            JSONArray rows=new JSONArray(fetch(API+"/rest/v1/humkin_radio_tracks"
                    +"?select=id,title,artist,album,kind,storage_path,duration_seconds"
                    +"&published_at=not.is.null&enabled=eq.true&order=published_at.asc&limit=1000",true));
            for(int i=0;i<rows.length();i++){
                JSONObject t=rows.getJSONObject(i);
                String path=t.optString("storage_path","");
                if(!path.matches("[0-9a-fA-F-]{36}/[0-9a-fA-F]{64}\\.mp3"))continue;
                long duration=durationMs(t.optDouble("duration_seconds",0));
                if(duration<=0||duration>=14400000)continue;
                tracks.add(new Track("crate-"+t.optString("id"),
                        t.optString("title","HUMKIN"),t.optString("artist","HUMKIN"),
                        t.optString("album","HUMKIN RADIO"),
                        API+"/storage/v1/object/public/humkin-radio-live/"+path,
                        duration,"bumper".equals(t.optString("kind"))));
            }
        }catch(Exception e){complete=false;}

        int every=0;
        try{
            JSONArray settings=new JSONArray(fetch(API+
                    "/rest/v1/humkin_radio_settings?select=bumper_every&id=eq.main&limit=1",true));
            if(settings.length()>0)every=settings.getJSONObject(0).optInt("bumper_every",0);
            if(every<1||every>20)every=0;
        }catch(Exception e){complete=false;}
        boolean scheduled=false;
        try{
            JSONArray programs=new JSONArray(fetch(API+
                    "/rest/v1/humkin_radio_programs?select=id&is_active=eq.true&limit=1",true));
            scheduled=programs.length()>0;
        }catch(Exception e){complete=false;}

        long offset=0;
        boolean clockCalibrated=false;
        try {
            long before=System.currentTimeMillis();
            String raw=fetch(API+"/rest/v1/rpc/humkin_radio_clock_ms",true);
            long after=System.currentTimeMillis();
            long remote=Long.parseLong(raw.trim());
            long rtt=after-before;
            long measured=remote-(before+(rtt/2));
            if(rtt>=0&&rtt<=2000&&Math.abs(measured)<=600000){
                offset=measured;clockCalibrated=true;
            }
        }catch(Exception ignored){/* Device clock is an explicit approximate fallback. */ }

        long epoch=Instant.parse(rotation.optString("synced_clock_epoch_utc",
                "2026-11-13T00:00:00Z")).toEpochMilli();
        Station station=new Station(tracks,every,epoch,offset,clockCalibrated,complete,scheduled);
        if(station.songsCount()==0||station.clock.cycleMs()<=0)
            throw new IOException("No playable station records");
        return station;
    }

    private static boolean safeStaticUrl(URL url) {
        return url.getProtocol().equals("https")&&
                url.getHost().equals("humkin.abundent.org")&&
                url.getPath().toLowerCase().endsWith(".mp3");
    }
    private static long durationMs(double seconds) {
        return Double.isFinite(seconds)&&seconds>0?Math.round(seconds*1000):0;
    }
    private static String fetch(String uri,boolean withKey) throws IOException {
        HttpURLConnection conn=(HttpURLConnection)new URL(uri).openConnection();
        conn.setConnectTimeout(9000);conn.setReadTimeout(9000);
        conn.setRequestProperty("Accept","application/json");
        if(withKey)conn.setRequestProperty("apikey",KEY);
        try{
            if(conn.getResponseCode()!=200)
                throw new IOException("HTTP "+conn.getResponseCode());
            try(InputStream in=conn.getInputStream()){
                ByteArrayOutputStream buffer=new ByteArrayOutputStream();
                byte[] bytes=new byte[8192];int n;
                while((n=in.read(bytes))!=-1)buffer.write(bytes,0,n);
                return new String(buffer.toByteArray(),StandardCharsets.UTF_8);
            }
        }finally{conn.disconnect();}
    }
}
