package org.abundent.humkinradio;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Native Night Watch: a bounded, local record of actually audible Media3 time.
 * The playback service supplies deltas; this class never uses a wall clock to
 * grant minutes, XP, discoveries or HUM. Reports are not server certificates.
 */
final class NativeNightWatch {
    static final long QUIET_MS=30L*60_000L;
    static final long QUALIFIED_MS=30_000L;
    static final long PREVIEW_MS=5L*60_000L;
    private static final String PREFS="humkin-native-night-watch-v1";
    private static final String DATA="watch_json";
    private static final int MAX_WATCHES=12,MAX_TRACKS=240,MAX_KNOWN=1200;
    private NativeNightWatch() {}

    static boolean qualified(long actualMs){return actualMs>=QUALIFIED_MS;}
    static boolean closed(long lastActualAt,long now){
        return lastActualAt>0L && now>=lastActualAt && now-lastActualAt>=QUIET_MS;
    }
    private static SharedPreferences store(Context context){
        return context.getApplicationContext().getSharedPreferences(PREFS,Context.MODE_PRIVATE);
    }
    private static JSONObject load(SharedPreferences preferences){
        try{return new JSONObject(preferences.getString(DATA,"{}"));}
        catch(Exception error){return new JSONObject();}
    }
    private static JSONArray array(JSONObject obj,String key){
        JSONArray a=obj.optJSONArray(key);
        return a==null?new JSONArray():a;
    }
    private static boolean has(JSONArray a,String value){
        for(int i=0;i<a.length();i++)if(value.equals(a.optString(i)))return true;
        return false;
    }
    private static JSONArray tail(JSONArray old,int maximum){
        JSONArray trimmed=new JSONArray();
        for(int i=Math.max(0,old.length()-maximum);i<old.length();i++)
            trimmed.put(old.opt(i));
        return trimmed;
    }
    private static String name(String value,int length){
        if(value==null)return "";
        String clean=value.replace('\n',' ').replace('\r',' ').trim();
        return clean.length()>length?clean.substring(0,length):clean;
    }

    /**
     * Invoked only from the actual audible-tick flush in RadioPlaybackService.
     * A delta over the service's bounded batch limit is rejected, not inferred.
     */
    static synchronized void record(Context context,String trackId,String title,long actualMs,
            int level,Set<String> owned){
        if(actualMs<=0L||actualMs>15_000L)return;
        SharedPreferences preferences=store(context);
        JSONObject data=load(preferences);
        long now=System.currentTimeMillis();
        try{
            JSONArray watches=array(data,"watches");
            JSONObject watch=watches.length()==0?null:watches.optJSONObject(watches.length()-1);
            if(watch==null||closed(watch.optLong("lastAt",0),now)
                    ||now<watch.optLong("lastAt",0L)){
                watch=new JSONObject().put("id",String.valueOf(now))
                    .put("startedAt",now).put("lastAt",now).put("ms",0L)
                    .put("tracks",new JSONArray()).put("finds",new JSONArray())
                    .put("levels",new JSONArray());
                watches.put(watch);
                watches=tail(watches,MAX_WATCHES);
            }
            watch.put("lastAt",now).put("ms",Math.min(100_000_000L,
                    watch.optLong("ms",0L)+actualMs));
            String id=name(trackId,120);
            if(!id.isEmpty()){
                JSONArray tracks=array(watch,"tracks");
                JSONObject track=null;
                for(int i=0;i<tracks.length();i++){
                    JSONObject found=tracks.optJSONObject(i);
                    if(found!=null&&id.equals(found.optString("id"))){track=found;break;}
                }
                if(track==null&&tracks.length()<MAX_TRACKS){
                    track=new JSONObject().put("id",id)
                        .put("title",name(title,90)).put("ms",0L).put("first",false);
                    tracks.put(track);
                }
                if(track!=null){
                    long elapsed=Math.min(5_000_000L,track.optLong("ms",0L)+actualMs);
                    track.put("ms",elapsed);
                    JSONArray known=array(data,"known");
                    if(qualified(elapsed)&&!has(known,id)){
                        track.put("first",true);
                        known.put(id);
                        data.put("known",tail(known,MAX_KNOWN));
                    }
                }
            }
            // Record only changes actually observed AFTER this journal started;
            // never retroactively claim a trophy or rank from old app history.
            if(data.has("lastLevel")){
                int previous=data.optInt("lastLevel",level);
                JSONArray levels=array(watch,"levels");
                for(int x=previous+1;x<=level&&levels.length()<32;x++)levels.put(x);
            }
            data.put("lastLevel",level);
            JSONArray previousOwned=array(data,"lastOwned");
            if(data.has("lastOwned")&&owned!=null){
                JSONArray finds=array(watch,"finds");
                for(String object:owned){
                    OrchardLedger.Spec spec=OrchardLedger.find(object);
                    if(spec!=null&&spec.rare&&!has(previousOwned,object)
                            &&!has(finds,spec.name)&&finds.length()<32)finds.put(spec.name);
                }
            }
            if(owned!=null){
                JSONArray nextOwned=new JSONArray();
                for(String object:owned)if(object!=null&&nextOwned.length()<120)
                    nextOwned.put(object);
                data.put("lastOwned",nextOwned);
            }
            data.put("watches",watches);
            preferences.edit().putString(DATA,data.toString()).apply();
        }catch(JSONException error){
            // A corrupted/oversized journal may be dropped, never backfilled.
        }
    }

    static final class Report {
        final String id,when;
        final long actualMs;
        final int recordings,firstLogged;
        final List<String> finds,levels;
        final boolean ongoing,unread;
        Report(JSONObject watch,boolean inProgress,String readId){
            id=watch.optString("id");
            long started=watch.optLong("startedAt",0);
            when=new SimpleDateFormat("MMM d, h:mm a",Locale.getDefault())
                .format(new Date(started));
            actualMs=watch.optLong("ms",0L);
            JSONArray tracks=array(watch,"tracks");
            int count=0,first=0;
            for(int i=0;i<tracks.length();i++){
                JSONObject track=tracks.optJSONObject(i);
                if(track!=null&&qualified(track.optLong("ms",0L))){
                    count++;if(track.optBoolean("first",false))first++;
                }
            }
            recordings=count;firstLogged=first;
            finds=new ArrayList<>();levels=new ArrayList<>();
            JSONArray objects=array(watch,"finds");
            for(int i=0;i<objects.length();i++)finds.add(objects.optString(i));
            JSONArray lev=array(watch,"levels");
            for(int i=0;i<lev.length();i++)levels.add(String.valueOf(lev.optInt(i)));
            ongoing=inProgress;
            unread=!inProgress&&!id.equals(readId);
        }
        String brief(){
            return (ongoing?"WATCH IN PROGRESS":unread?"NEW REPORT":"LAST REPORT")
                +"  ·  "+(actualMs/60_000L)+" MIN  ·  "+recordings+" RECORDINGS";
        }
        String detail(){
            StringBuilder body=new StringBuilder();
            body.append(ongoing?"CURRENT WATCH / SO FAR":"COMPLETED NIGHT WATCH")
                .append("\nBEGAN ").append(when)
                .append("\n").append(actualMs/60_000L).append(" minutes of actual audio")
                .append("\n").append(recordings).append(" recordings heard  ·  ")
                .append(firstLogged).append(" first logged here");
            if(!levels.isEmpty())body.append("\nOUTPOST LEVELS: ").append(String.join(", ",levels));
            if(!finds.isEmpty())body.append("\nSTRANGE FINDS: ").append(String.join(", ",finds));
            if(levels.isEmpty()&&finds.isEmpty())body.append("\nThe records played. No strange business reported.");
            body.append("\n\nLOCAL RECEIPT ONLY. Counts begin with this app version. No idle-time or screen-off guesses.");
            return body.toString();
        }
    }

    static synchronized Report latest(Context context){
        JSONObject data=load(store(context));
        JSONArray watches=array(data,"watches");
        long now=System.currentTimeMillis();
        JSONObject newest=watches.optJSONObject(watches.length()-1);
        if(newest!=null&&newest.optLong("ms",0)>=PREVIEW_MS
                &&now>=newest.optLong("lastAt",0L)
                &&now-newest.optLong("lastAt",0L)<QUIET_MS)
            return new Report(newest,true,data.optString("readId"));
        for(int i=watches.length()-1;i>=0;i--){
            JSONObject watch=watches.optJSONObject(i);
            if(watch!=null&&closed(watch.optLong("lastAt",0),now))
                return new Report(watch,false,data.optString("readId"));
        }
        return null;
    }
    static synchronized void markRead(Context context,String id){
        SharedPreferences p=store(context);
        JSONObject data=load(p);
        JSONArray watches=array(data,"watches");
        if(id==null)return;
        boolean found=false;
        for(int i=0;i<watches.length();i++){
            JSONObject watch=watches.optJSONObject(i);
            if(watch!=null&&id.equals(watch.optString("id")))found=true;
        }
        if(!found)return;
        try{data.put("readId",id);p.edit().putString(DATA,data.toString()).apply();}
        catch(JSONException ignored){}
    }
}
