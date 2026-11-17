package org.abundent.humkinradio;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONObject;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * One local answer per recorded song; text describes experience, not rating.
 * This memory does not create a verified listen or manipulate Top 42 rankings.
 */
final class SongReactions {
    static final String[] CODES={"hope","tears","seen","laugh","move","stayed"};
    static final String[] CHOICES={
            "✳  It gave me hope",
            "◌  It made me cry",
            "↗  I felt less alone",
            "☀  It made me laugh",
            "♫  It made me move",
            "✦  It stayed with me"
    };
    private static final String KEY="song-reactions-v1";
    private static final String PREFS="humkin-radio";
    private SongReactions() {}
    static boolean valid(String code){return Arrays.asList(CODES).contains(code);}
    static String phrase(String code){
        for(int i=0;i<CODES.length;i++)if(CODES[i].equals(code))return CHOICES[i];
        return "It got to me";
    }
    static String codeAt(int index){return index<0||index>=CODES.length?null:CODES[index];}
    private static SharedPreferences prefs(Context c){
        return c.getApplicationContext().getSharedPreferences(PREFS,Context.MODE_PRIVATE);
    }
    private static Map<String,String> read(Context c){
        Map<String,String> map=new LinkedHashMap<>();
        try{
            JSONObject rows=new JSONObject(prefs(c).getString(KEY,"{}"));
            java.util.Iterator<String> it=rows.keys();
            while(it.hasNext()&&map.size()<300){
                String id=it.next(),code=rows.optString(id,"");
                if(SongReactionId.canonical(id)!=null&&valid(code))map.put(id,code);
            }
        }catch(Exception ignored){}
        return map;
    }
    static String get(Context c,String mediaId){
        String id=SongReactionId.canonical(mediaId);
        if(id==null)return null;
        return read(c).get(id);
    }
    static boolean save(Context c,String mediaId,String code){
        String id=SongReactionId.canonical(mediaId);
        if(id==null||!valid(code))return false;
        Map<String,String> values=read(c);
        values.remove(id);
        values.put(id,code);
        while(values.size()>300)values.remove(values.keySet().iterator().next());
        JSONObject rows=new JSONObject();
        for(Map.Entry<String,String> entry:values.entrySet()){
            try{rows.put(entry.getKey(),entry.getValue());}
            catch(Exception ignored){}
        }
        return prefs(c).edit().putString(KEY,rows.toString()).commit();
    }
    static int sharing(Context c){return prefs(c).getInt("song-reaction-share-choice",0);}
    static void setSharing(Context c,int choice){
        prefs(c).edit().putInt("song-reaction-share-choice",choice).apply();
    }
}
