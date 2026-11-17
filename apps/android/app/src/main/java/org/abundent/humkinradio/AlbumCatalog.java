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
import java.util.ArrayList;
import java.util.List;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

/**
 * Public, published album manifests only. No private upload access.
 * The radio catalog remains independent of albums.
 */
final class AlbumCatalog {
    static final class Album {
        final String id, title, detail, manifestUrl, coverUrl, pageUrl;
        Album(String id, String title, String detail, String manifestUrl,
              String coverUrl, String pageUrl) {
            this.id=id;this.title=title;this.detail=detail;
            this.manifestUrl=manifestUrl;this.coverUrl=coverUrl;this.pageUrl=pageUrl;
        }
    }

    static final Album MUTANT_POP = new Album(
        "mutant-pop", "MUTANT POP", "12 songs · Bright, strange and familiar.",
        "https://humkin.abundent.org/tracks.json",
        "https://humkin.abundent.org/cover.jpg",
        "https://humkin.abundent.org/"
    );
    static final Album EVERYWHERE = new Album(
        "everywhere-near-you", "everywhere;near you", "7 songs · Close and far away.",
        "https://humkin.abundent.org/releases/everywhere-near-you/tracks.json",
        "https://humkin.abundent.org/releases/everywhere-near-you/cover.jpg",
        "https://humkin.abundent.org/releases/everywhere-near-you/"
    );

    // This public index is updated at publication, not at Android build time.
    // Its order is editorial: newest published album first.
    private static final String INDEX =
            "https://humkin.abundent.org/releases/catalog.json";

    static List<Album> builtIn() {
        List<Album> albums=new ArrayList<>();
        albums.add(EVERYWHERE); // currently newest approved web record
        albums.add(MUTANT_POP);
        return albums;
    }

    static List<Album> discover() throws Exception {
        return parsePublished(readLimited(new URL(INDEX), 65536));
    }

    // A status gate prevents accidental preorder/draft leaks. Reject arbitrary
    // remote media hosts and paths: the app plays only owner-published files.
    static List<Album> parsePublished(String json) throws Exception {
        JSONObject root=new JSONObject(json);
        if(root.getInt("version") != 1) throw new IOException("Unsupported album index");
        JSONArray entries=root.getJSONArray("albums");
        if(entries.length()<1 || entries.length()>60) throw new IOException("Invalid album count");
        List<Album> published=new ArrayList<>();
        Set<String> used=new HashSet<>();
        for(int i=0;i<entries.length();i++) {
            JSONObject item=entries.getJSONObject(i);
            if(!"published".equals(item.optString("status"))) continue;
            String id=item.getString("id");
            String title=item.getString("title").trim();
            String detail=item.optString("detail","").trim();
            if(!id.matches("[a-z0-9]+(?:-[a-z0-9]+)*") || id.length()>70 ||
                    title.isEmpty() || title.length()>85 || detail.length()>150 ||
                    !used.add(id)) throw new IOException("Invalid published album entry");
            String pathPrefix="mutant-pop".equals(id) ? "/" : "/releases/"+id+"/";
            String manifest=item.getString("manifest");
            String cover=item.getString("cover");
            String page=item.getString("page");
            if(!manifest.equals(pathPrefix+"tracks.json") ||
                    !page.equals(pathPrefix) ||
                    !cover.startsWith(pathPrefix) ||
                    !(cover.endsWith(".jpg") || cover.endsWith(".jpeg") ||
                            cover.endsWith(".png") || cover.endsWith(".webp")) ||
                    cover.indexOf('/',pathPrefix.length())>=0) {
                throw new IOException("Album paths are not within the published release");
            }
            published.add(new Album(id,title,detail,site(manifest),site(cover),site(page)));
        }
        if(published.isEmpty()) throw new IOException("No published albums");
        return Collections.unmodifiableList(published);
    }

    private static String site(String path) throws IOException {
        if(!path.startsWith("/") || path.startsWith("//") || path.contains("..") ||
                path.contains("\\\\") || path.contains("?") || path.contains("#"))
            throw new IOException("Invalid site path");
        return "https://humkin.abundent.org"+path;
    }

    static String readLimited(URL url, int limit) throws IOException {
        if(!"https".equals(url.getProtocol()) ||
                !"humkin.abundent.org".equals(url.getHost()) ||
                url.getUserInfo()!=null) throw new IOException("Untrusted album source");
        HttpURLConnection connection=(HttpURLConnection)url.openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(9000);connection.setReadTimeout(9000);
        connection.setRequestProperty("Accept","application/json");
        try {
            if(connection.getResponseCode()!=200) throw new IOException("Published album list unavailable");
            try(InputStream stream=connection.getInputStream()) {
                ByteArrayOutputStream data=new ByteArrayOutputStream();
                byte[] bytes=new byte[8192];int count;
                while((count=stream.read(bytes))!=-1){
                    if(data.size()+count>limit)throw new IOException("Album list too large");
                    data.write(bytes,0,count);
                }
                return new String(data.toByteArray(), StandardCharsets.UTF_8);
            }
        } finally {connection.disconnect();}
    }

    static List<MediaItem> load(Album album) throws Exception {
        URL manifest=new URL(album.manifestUrl);
        String json=readLimited(manifest, 140000);

        JSONObject doc=new JSONObject(json);
        JSONArray tracks=doc.getJSONArray("tracks");
        if(tracks.length()<1||tracks.length()>200)throw new IOException("Unexpected album tracks");
        List<MediaItem> media=new ArrayList<>();
        for(int i=0;i<tracks.length();i++){
            JSONObject row=tracks.getJSONObject(i);
            String path=row.getString("url");
            URL track=new URL(manifest,path);
            if(!"https".equals(track.getProtocol())||
               !"humkin.abundent.org".equals(track.getHost())||
               !track.getPath().endsWith(".mp3")||
               !track.getPath().startsWith(new URL(manifest,"./").getPath()))
                continue;
            String title=row.optString("title","Track "+(i+1));
            MediaMetadata metadata=new MediaMetadata.Builder()
                .setTitle(title).setArtist("HUMKIN").setAlbumTitle(album.title)
                .setArtworkUri(Uri.parse(album.coverUrl)).build();
            media.add(new MediaItem.Builder()
                .setMediaId("album:"+album.id+":"+(i+1))
                .setUri(track.toString()).setMediaMetadata(metadata).build());
        }
        if(media.isEmpty())throw new IOException("No playable songs for "+album.title);
        return media;
    }
}
