package org.abundent.humkinradio;

import android.net.Uri;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.IOException;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Reads exactly the station's public playlist and published Supabase catalog.
 * A publish to the existing Crate Loader becomes eligible on next Tune In.
 * No account, advertisements, analytics, or hidden API key is required.
 */
final class RadioCatalog {
    private static final String ORIGIN = "https://humkin.abundent.org/";
    private static final String CONFIG = ORIGIN + "fm/rotation.json";
    private static final String API = "https://kbhqacsdvjsstzyplqij.supabase.co";
    // Publishable, RLS-limited key already exposed by the public station.
    private static final String KEY = "sb_publishable_Bv9JuOctSQTmnE3O1dP8RA_MKRNSD-o";
    private static final Uri COVER = Uri.parse(ORIGIN + "cover.jpg");

    private static final class Track {
        final String id, title, artist, album, url;
        Track(String id, String title, String artist, String album, String url) {
            this.id=id; this.title=title; this.artist=artist; this.album=album; this.url=url;
        }
        MediaItem item() {
            MediaMetadata metadata = new MediaMetadata.Builder()
                    .setTitle(title).setArtist(artist).setAlbumTitle(album)
                    .setArtworkUri(COVER).build();
            return new MediaItem.Builder().setMediaId(id).setUri(url)
                    .setMediaMetadata(metadata).build();
        }
    }

    static List<MediaItem> load() throws Exception {
        ArrayList<Track> songs = new ArrayList<>();
        ArrayList<Track> bumpers = new ArrayList<>();
        IOException firstError = null;
        try {
            JSONObject rotation = new JSONObject(fetch(CONFIG, false));
            JSONArray tracks = rotation.getJSONArray("tracks");
            for (int i=0; i<tracks.length(); i++) {
                JSONObject t = tracks.getJSONObject(i);
                URL url = new URL(new URL(CONFIG), t.getString("src"));
                // Static track locations must remain on the canonical site.
                if (!url.getProtocol().equals("https")
                        || !url.getHost().equals("humkin.abundent.org")) continue;
                songs.add(new Track("static-" + t.optString("id", String.valueOf(i)),
                        t.optString("title", "HUMKIN"),
                        t.optString("artist", "HUMKIN"),
                        t.optString("album", "HUMKIN RADIO"), url.toString()));
            }
        } catch (Exception e) { firstError = new IOException("Static rotation unavailable", e); }

        try {
            String query = "/rest/v1/humkin_radio_tracks?select=id,title,artist,album,kind,storage_path"
                    + "&published_at=not.is.null&enabled=eq.true&order=published_at.asc&limit=1000";
            JSONArray rows = new JSONArray(fetch(API + query, true));
            for (int i=0; i<rows.length(); i++) {
                JSONObject t = rows.getJSONObject(i);
                String path = t.optString("storage_path", "");
                if (!path.matches("[0-9a-fA-F-]{36}/[0-9a-fA-F]{64}\\.mp3")) continue;
                Track track = new Track("crate-" + t.optString("id"),
                        t.optString("title", "HUMKIN"),
                        t.optString("artist", "HUMKIN"),
                        t.optString("album", "HUMKIN RADIO"),
                        API + "/storage/v1/object/public/humkin-radio-live/" + path);
                if ("bumper".equals(t.optString("kind"))) bumpers.add(track);
                else songs.add(track);
            }
        } catch (Exception ignored) {
            // Radio remains usable from the static playlist during cloud outages.
        }
        if (songs.isEmpty()) throw new IOException(
                firstError == null ? "No published songs available" : firstError.getMessage());

        int bumperEvery = 0;
        try {
            JSONArray settings = new JSONArray(fetch(API
                    + "/rest/v1/humkin_radio_settings?select=bumper_every&id=eq.main&limit=1", true));
            if (settings.length() > 0)
                bumperEvery = Math.max(0, Math.min(20,
                        settings.getJSONObject(0).optInt("bumper_every", 0)));
        } catch (Exception ignored) { /* Never assert a cadence when settings are offline. */ }

        Collections.shuffle(songs);
        Collections.shuffle(bumpers);
        ArrayList<MediaItem> queue = new ArrayList<>();
        int bumper = 0;
        for (int i=0; i<songs.size(); i++) {
            queue.add(songs.get(i).item());
            if (bumperEvery > 0 && !bumpers.isEmpty() && (i+1)%bumperEvery == 0
                    && i+1 < songs.size()) {
                queue.add(bumpers.get(bumper++ % bumpers.size()).item());
            }
        }
        return queue;
    }

    private static String fetch(String uri, boolean withKey) throws IOException {
        HttpURLConnection conn = (HttpURLConnection) new URL(uri).openConnection();
        conn.setConnectTimeout(9000);
        conn.setReadTimeout(9000);
        conn.setRequestProperty("Accept", "application/json");
        if (withKey) conn.setRequestProperty("apikey", KEY);
        try {
            if (conn.getResponseCode() != 200) throw new IOException("HTTP " + conn.getResponseCode());
            try (InputStream in = conn.getInputStream()) {
                ByteArrayOutputStream output = new ByteArrayOutputStream();
                byte[] buffer = new byte[8192];
                int count;
                while ((count = in.read(buffer)) != -1) output.write(buffer, 0, count);
                return new String(output.toByteArray(), StandardCharsets.UTF_8);
            }
        } finally { conn.disconnect(); }
    }
}
