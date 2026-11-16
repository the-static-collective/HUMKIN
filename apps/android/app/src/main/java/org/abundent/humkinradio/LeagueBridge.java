package org.abundent.humkinradio;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Public, inspectable radio data: chart + catalog + separate song-request
 * board. No auth account, background polling, contact/location collection,
 * payment or score manufacture. All network work stays off the UI thread.
 */
final class LeagueBridge {
    static final String ENDPOINT =
        "https://kbhqacsdvjsstzyplqij.supabase.co/functions/v1/humkin-league";
    private LeagueBridge() {}

    static final class Board {
        final String day;
        final List<SignalFeatures.Song> catalog;
        final List<SignalFeatures.Song> ranked;
        final List<Request> requests;
        final int requestCount;
        Board(String day,List<SignalFeatures.Song> catalog,
              List<SignalFeatures.Song> ranked,List<Request> requests,int requestCount){
            this.day=day;this.catalog=catalog;this.ranked=ranked;
            this.requests=requests;this.requestCount=requestCount;
        }
    }
    static final class Request {
        final String id,title;
        final int nominations;
        Request(String id,String title,int nominations){
            this.id=id;this.title=title;this.nominations=nominations;
        }
    }

    static String call(JSONObject body) throws Exception {
        HttpURLConnection conn=(HttpURLConnection)new URL(ENDPOINT).openConnection();
        try{
            conn.setConnectTimeout(5500);conn.setReadTimeout(9000);
            conn.setRequestProperty("Accept","application/json");
            if(body!=null){
                conn.setRequestMethod("POST");
                conn.setDoOutput(true);
                conn.setRequestProperty("Content-Type","application/json");
                byte[] bytes=body.toString().getBytes(StandardCharsets.UTF_8);
                conn.setFixedLengthStreamingMode(bytes.length);
                try(OutputStream out=conn.getOutputStream()){out.write(bytes);}
            }
            int status=conn.getResponseCode();
            java.io.InputStream stream=status>=400?conn.getErrorStream():conn.getInputStream();
            if(stream==null)throw new IllegalStateException("The request line did not answer");
            StringBuilder response=new StringBuilder();
            try(BufferedReader reader=new BufferedReader(
                    new InputStreamReader(stream,StandardCharsets.UTF_8))){
                String line;while((line=reader.readLine())!=null&&response.length()<500_000)
                    response.append(line);
            }
            JSONObject parsed=new JSONObject(response.toString());
            if(status>=400)throw new IllegalStateException(
                parsed.optString("error","The station desk is temporarily unavailable"));
            return response.toString();
        }finally{conn.disconnect();}
    }

    static Board readBoard() throws Exception{
        JSONObject json=new JSONObject(call(null));
        if(!"humkin.top42/v1".equals(json.optString("schema")))
            throw new IllegalStateException("The station desk sent an unknown format");
        String day=json.optString("station_day","");
        Map<String,SignalFeatures.Song> charted=new HashMap<>();
        JSONArray rankedJson=json.optJSONArray("chart");
        if(rankedJson!=null)for(int i=0;i<rankedJson.length();i++){
            JSONObject r=rankedJson.optJSONObject(i);
            if(r==null)continue;
            charted.put(r.optString("id",""),new SignalFeatures.Song(
                r.optString("id",""),r.optString("title",""),"",
                r.optBoolean("featured"),r.optInt("plays"),r.optInt("radio"),
                r.optInt("playlist")));
        }
        JSONArray catalogJson=json.optJSONArray("catalog");
        List<SignalFeatures.Song> catalog=new ArrayList<>();
        Map<String,SignalFeatures.Song> byId=new HashMap<>();
        if(catalogJson!=null)for(int i=0;i<catalogJson.length();i++){
            JSONObject track=catalogJson.optJSONObject(i);
            if(track==null)continue;
            String id=track.optString("id","");
            if(!id.matches("[-a-z0-9]{3,90}"))continue;
            SignalFeatures.Song score=charted.get(id);
            SignalFeatures.Song song=new SignalFeatures.Song(id,
                track.optString("title","Unknown Recording"),
                track.optString("album","HUMKIN RADIO"),
                track.optBoolean("featured"),
                score==null?0:score.plays,score==null?0:score.radio,
                score==null?0:score.playlist);
            catalog.add(song);byId.put(id,song);
        }
        List<SignalFeatures.Song> ranked=new ArrayList<>();
        if(rankedJson!=null)for(int i=0;i<rankedJson.length();i++){
            JSONObject rank=rankedJson.optJSONObject(i);
            if(rank!=null&&rank.optInt("plays",0)>0&&
                    byId.containsKey(rank.optString("id")))
                ranked.add(byId.get(rank.optString("id")));
        }
        JSONArray beaconJson=json.optJSONArray("beacons");
        List<Request> requests=new ArrayList<>();
        if(beaconJson!=null)for(int i=0;i<beaconJson.length();i++){
            JSONObject b=beaconJson.optJSONObject(i);
            if(b!=null)requests.add(new Request(b.optString("id"),
                b.optString("title","Unknown Recording"),b.optInt("nominations")));
        }
        return new Board(day,catalog,ranked,requests,json.optInt("request_count",0));
    }

    private static SharedPreferences prefs(Context context){
        return context.getApplicationContext()
            .getSharedPreferences("humkin-radio",Context.MODE_PRIVATE);
    }
    static String listener(Context context) {
        SharedPreferences p=prefs(context);
        String existing=p.getString("league-listener-v1","");
        if(existing.matches("[0-9a-f-]{36}"))return existing;
        String created=UUID.randomUUID().toString();
        p.edit().putString("league-listener-v1",created).apply();
        return created;
    }
    static String sendBeacon(Context context,String trackId,String day) throws Exception {
        JSONObject req=new JSONObject()
            .put("action","beacon").put("listener",listener(context))
            .put("track_id",trackId);
        JSONObject result=new JSONObject(call(req));
        if(!result.optBoolean("accepted"))
            throw new IllegalStateException("The Request Desk could not file your song");
        String stationDay=result.optString("day",day);
        prefs(context).edit().putString("beacon_sent_day",stationDay)
            .putString("beacon_sent_track",trackId).apply();
        return result.optString("note","Request filed.");
    }
    static boolean beaconSent(Context c,String day){
        return day!=null&&!day.isEmpty()&&
            day.equals(prefs(c).getString("beacon_sent_day",""));
    }
    static Set<String> watched(Context context){
        return new HashSet<>(prefs(context)
            .getStringSet("scout-crate-v1",Collections.emptySet()));
    }
    static boolean toggleWatch(Context context,String id){
        if(id==null||!id.matches("[-a-z0-9]{3,90}"))return false;
        Set<String> items=watched(context);
        boolean added;
        if(items.contains(id)){items.remove(id);added=false;}
        else {
            if(items.size()>=42)return false;
            items.add(id);added=true;
        }
        prefs(context).edit().putStringSet("scout-crate-v1",items).apply();
        return added;
    }
}
