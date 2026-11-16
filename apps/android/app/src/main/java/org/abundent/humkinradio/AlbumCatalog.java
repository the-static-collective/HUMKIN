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

    static List<MediaItem> load(Album album) throws Exception {
        URL manifest=new URL(album.manifestUrl);
        if (!"https".equals(manifest.getProtocol()) ||
                !"humkin.abundent.org".equals(manifest.getHost()))
            throw new IOException("Untrusted album source");
        HttpURLConnection connection=(HttpURLConnection)manifest.openConnection();
        connection.setConnectTimeout(9000);connection.setReadTimeout(9000);
        connection.setRequestProperty("Accept","application/json");
        String json;
        try{
            if(connection.getResponseCode()!=200)throw new IOException("Album not published");
            try(InputStream stream=connection.getInputStream()) {
                ByteArrayOutputStream data=new ByteArrayOutputStream();
                byte[] bytes=new byte[8192];int count;
                while((count=stream.read(bytes))!=-1){
                    if(data.size()+count>140000)throw new IOException("Album catalog too large");
                    data.write(bytes,0,count);
                }
                json=new String(data.toByteArray(), StandardCharsets.UTF_8);
            }
        }finally{connection.disconnect();}

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
