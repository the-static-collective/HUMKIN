package org.abundent.humkinradio;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

/**
 * Public aggregate only: no per-listener response, private database or vote
 * weights are ever downloaded. Weather is optional; offline means local-first.
 */
final class PirateWeather {
    private static final String API=
        "https://kbhqacsdvjsstzyplqij.supabase.co/functions/v1/humkin-resonance";
    private static final String KEY="pirate-weather-v1";
    private static final long MAX_STALE=7L*86400000L;
    static final class Board {
        final Map<String,PirateSelector.Weather> tracks;
        final int total;
        final boolean live;
        final String week;
        Board(Map<String,PirateSelector.Weather> tracks,int total,boolean live,String week){
            this.tracks=Collections.unmodifiableMap(tracks);
            this.total=total;this.live=live;this.week=week;
        }
    }
    private PirateWeather(){}
    private static SharedPreferences prefs(Context c){
        return c.getApplicationContext().getSharedPreferences("humkin-radio",Context.MODE_PRIVATE);
    }
    private static Board parse(String raw,boolean live) throws Exception {
        JSONObject body=new JSONObject(raw);
        if(!"humkin.listener-weather/v1".equals(body.optString("schema")))
            throw new Exception("Unknown weather format");
        JSONArray rows=body.optJSONArray("tracks");
        if(rows==null||rows.length()>500)throw new Exception("Invalid weather tracks");
        Map<String,PirateSelector.Weather> out=new HashMap<>();
        int total=0;
        for(int i=0;i<rows.length();i++){
            JSONObject entry=rows.optJSONObject(i);
            if(entry==null)continue;
            String id=SongReactionId.canonical(entry.optString("id",""));
            if(id==null)continue;
            int count=entry.optInt("total",0);
            if(count<1||count>100000)continue;
            JSONObject ratings=entry.optJSONObject("feelings");
            if(ratings==null)continue;
            Map<String,Integer> feelings=new HashMap<>();
            int sum=0;
            for(String code:SongReactions.CODES){
                int n=Math.max(0,Math.min(100000,ratings.optInt(code,0)));
                if(n>0)feelings.put(code,n);
                sum+=n;
            }
            if(sum!=count)continue;
            out.put(id,new PirateSelector.Weather(count,feelings));
            total+=count;
        }
        String week=body.optString("week_start","");
        if(!week.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}"))throw new Exception("Invalid week");
        return new Board(out,total,live,week);
    }
    static Board cached(Context c){
        long at=prefs(c).getLong(KEY+"-at",0);
        if(at<=0||System.currentTimeMillis()-at>MAX_STALE)
            return new Board(new HashMap<>(),0,false,"");
        try{return parse(prefs(c).getString(KEY,"{}"),false);}
        catch(Exception ignored){return new Board(new HashMap<>(),0,false,"");}
    }
    /** Call on a worker thread, never from the Media3 session/UI thread. */
    static Board fetch(Context c) {
        HttpURLConnection conn=null;
        try {
            conn=(HttpURLConnection)new URL(API).openConnection();
            conn.setConnectTimeout(4500);conn.setReadTimeout(5500);
            conn.setRequestProperty("Accept","application/json");
            if(conn.getResponseCode()!=200)throw new Exception("Weather offline");
            try(InputStream in=conn.getInputStream()) {
                ByteArrayOutputStream output=new ByteArrayOutputStream();
                byte[] chunk=new byte[2048];int n;
                while((n=in.read(chunk))!=-1){
                    if(output.size()+n>180000)throw new Exception("Weather response too large");
                    output.write(chunk,0,n);
                }
                String raw=new String(output.toByteArray(),StandardCharsets.UTF_8);
                Board board=parse(raw,true);
                prefs(c).edit().putString(KEY,raw)
                    .putLong(KEY+"-at",System.currentTimeMillis()).apply();
                return board;
            }
        } catch(Exception ignored){return cached(c);}
        finally{if(conn!=null)conn.disconnect();}
    }
}
