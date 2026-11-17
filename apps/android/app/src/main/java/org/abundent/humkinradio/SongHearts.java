package org.abundent.humkinradio;

import android.content.Context;
import android.content.SharedPreferences;
import androidx.media3.common.MediaItem;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

/** Device-only favorite records. A heart is never a Top 42 chart play.
 * The user separately confirms a public, server-backed Request Desk nomination.
 */
final class SongHearts {
    private static final String PREFS="humkin-radio";
    private static final String KEY="liked-songs-v1";
    private static final int LIMIT=100;
    static final class Song {
        final String id,title;
        Song(String id,String title){this.id=id;this.title=title;}
    }
    private SongHearts() {}
    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS,Context.MODE_PRIVATE);
    }
    static List<Song> list(Context context) {
        List<Song> out=new ArrayList<>();
        try {
            JSONArray rows=new JSONArray(prefs(context).getString(KEY,"[]"));
            for(int i=0;i<rows.length()&&out.size()<LIMIT;i++) {
                JSONObject row=rows.optJSONObject(i);
                if(row==null)continue;
                String id=SongHeartId.canonical(row.optString("id",null));
                String title=row.optString("title","");
                if(id==null||title.length()>180||out.stream().anyMatch(s->s.id.equals(id)))continue;
                out.add(new Song(id,title.isEmpty()?id:title));
            }
        }catch(Exception ignored){/* corrupt preference cannot prevent radio playback */}
        return out;
    }
    static boolean liked(Context context,String id) {
        String canonical=SongHeartId.canonical(id);
        if(canonical==null)return false;
        for(Song entry:list(context))if(entry.id.equals(canonical))return true;
        return false;
    }
    static void remove(Context context,String id) {
        String canonical=SongHeartId.canonical(id);
        if(canonical==null)return;
        List<Song> entries=list(context);
        entries.removeIf(song->song.id.equals(canonical));
        write(context,entries);
    }
    static boolean add(Context context,MediaItem item) {
        String id=item==null?null:SongHeartId.canonical(item.mediaId);
        if(id==null)return false;
        List<Song> entries=list(context);
        if(entries.stream().anyMatch(song->song.id.equals(id)))return false;
        String title=item.mediaMetadata.title==null?id:item.mediaMetadata.title.toString();
        title=title.replaceAll("[\\p{Cntrl}]"," ").trim();
        if(title.isEmpty())title=id;
        if(title.length()>160)title=title.substring(0,160);
        entries.add(0,new Song(id,title));
        while(entries.size()>LIMIT)entries.remove(entries.size()-1);
        write(context,entries);
        return true;
    }
    private static void write(Context context,List<Song> entries){
        JSONArray arr=new JSONArray();
        for(Song item:entries){
            JSONObject row=new JSONObject();
            try{row.put("id",item.id);row.put("title",item.title);arr.put(row);}
            catch(Exception ignored){}
        }
        prefs(context).edit().putString(KEY,arr.toString()).apply();
    }
}
