package org.abundent.humkinradio;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;
import androidx.media3.common.MediaItem;
import java.net.HttpURLConnection;
import java.net.URL;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * First real server-side HUM wallet connection. Listener's hardware P-256 key
 * signs each request, PostgreSQL serializes and idempotently accounts
 * nontransferable awards/redemptions. All I/O is off the UI thread.
 *
 * This does not convert old local HUM to shared HUM or touch Station Guilds.
 * Credits can only be earned from reported broadcast playback and redeemed
 * for already-public music. Reports are rate bounded, not acoustic proof.
 */
final class HumServerBridge {
    private static final String ENDPOINT=
        "https://kbhqacsdvjsstzyplqij.supabase.co/functions/v1/humkin-hum-wallet";
    private static final String FILE="humkin-server-hum-v1";
    private static final ExecutorService IO=Executors.newSingleThreadExecutor();
    private static final AtomicBoolean SYNCING=new AtomicBoolean(false);
    private static volatile long lastAttemptElapsed=0L;
    private HumServerBridge(){}

    static final class Snapshot {
        final boolean known,online;
        final int balance,lastAward;
        final long awardSequence,awardAt;
        final JSONArray records;
        Snapshot(SharedPreferences p){
            known=p.getBoolean("known",false);
            online=known && System.currentTimeMillis()-p.getLong("checked_at",0)<300000;
            balance=p.getInt("balance",0);
            lastAward=p.getInt("last_award",0);
            awardSequence=p.getLong("award_seq",0L);
            awardAt=p.getLong("award_at",0L);
            JSONArray saved;
            try{saved=new JSONArray(p.getString("records","[]"));}
            catch(Exception ignored){saved=new JSONArray();}
            records=saved;
        }
        boolean owns(String id){
            if(id==null)return false;
            for(int i=0;i<records.length();i++)if(id.equals(records.optString(i)))return true;
            return false;
        }
    }
    private static SharedPreferences prefs(Context c){
        return c.getApplicationContext().getSharedPreferences(FILE,Context.MODE_PRIVATE);
    }
    static Snapshot snapshot(Context c){return new Snapshot(prefs(c));}
    private static JSONObject post(Context c,String action,long listened,String song)throws Exception{
        JSONObject body=HumKeyring.request(action,listened,song);
        HttpURLConnection con=(HttpURLConnection)new URL(ENDPOINT).openConnection();
        con.setInstanceFollowRedirects(false);
        con.setConnectTimeout(8000);con.setReadTimeout(8500);
        con.setRequestMethod("POST");
        con.setRequestProperty("Content-Type","application/json");
        con.setRequestProperty("Accept","application/json");
        con.setDoOutput(true);
        byte[] payload=body.toString().getBytes(StandardCharsets.UTF_8);
        con.setFixedLengthStreamingMode(payload.length);
        try{
            try(OutputStream out=con.getOutputStream()){out.write(payload);}
            int status=con.getResponseCode();
            InputStream raw=status<400?con.getInputStream():con.getErrorStream();
            if(raw==null)throw new java.io.IOException("Station wallet did not answer");
            byte[] bytes;
            try(InputStream in=raw){bytes=ApiCompatStreams.readAtMost(in,12000);}
            JSONObject data=new JSONObject(new String(bytes,StandardCharsets.UTF_8));
            if(status>=400)throw new java.io.IOException(
                    data.optString("error","Station wallet unavailable"));
            if(!"humkin.hum-wallet/v1".equals(data.optString("schema")))
                throw new java.io.IOException("Unknown HUM receipt");
            return data;
        }finally{con.disconnect();}
    }
    private static synchronized void apply(Context c,JSONObject data){
        SharedPreferences p=prefs(c);
        int award=data.optInt("awarded",0);
        SharedPreferences.Editor edit=p.edit()
            .putBoolean("known",true)
            .putInt("balance",Math.max(0,data.optInt("balance",0)))
            .putString("records",data.optJSONArray("records")==null?"[]":
                    data.optJSONArray("records").toString())
            .putLong("checked_at",System.currentTimeMillis());
        if(award>0 && award<=6){
            edit.putInt("last_award",award)
                .putLong("award_at",System.currentTimeMillis())
                .putLong("award_seq",p.getLong("award_seq",0L)+1);
        }
        edit.apply();
    }
    private static JSONObject signed(Context c,String action,long playedMs,String song)throws Exception{
        Context app=c.getApplicationContext();
        SharedPreferences p=prefs(app);
        if(!p.getBoolean("registered",false)){
            JSONObject registered=post(app,"register",0,"");
            apply(app,registered);
            p.edit().putBoolean("registered",true).commit();
        }
        try{
            JSONObject data=post(app,action,playedMs,song);
            apply(app,data);
            return data;
        }catch(java.io.IOException e){
            if(e.getMessage()!=null&&e.getMessage().contains("Wallet not registered")){
                p.edit().putBoolean("registered",false).commit();
                JSONObject registered=post(app,"register",0,"");
                apply(app,registered);
                p.edit().putBoolean("registered",true).commit();
                JSONObject data=post(app,action,playedMs,song);
                apply(app,data);
                return data;
            }
            throw e;
        }
    }
    static void refresh(Context c){
        Context app=c.getApplicationContext();
        IO.execute(()->{
            try{signed(app,"state",0,"");}
            catch(Exception ignored){/* Offline: preserve last known balance. */}
        });
    }
    /** Call from the Media3 event stream. Never mint on the foreground/UI clock. */
    static void maybeSync(Context c,long todayBroadcastMs){
        if(todayBroadcastMs<0)return;
        long now=android.os.SystemClock.elapsedRealtime();
        if(now-lastAttemptElapsed<20000L||!SYNCING.compareAndSet(false,true))return;
        lastAttemptElapsed=now;
        Context app=c.getApplicationContext();
        IO.execute(()->{
            try{signed(app,"listen",todayBroadcastMs,"");}
            catch(Exception ignored){/* No fake award on network error. */}
            finally{SYNCING.set(false);}
        });
    }
    /** Must be called on an I/O thread, and never locally mint on failure. */
    static boolean collect(Context c,MediaItem item) throws Exception {
        if(item==null||item.localConfiguration==null ||
           !HumEconomy.approvedAudio(item.localConfiguration.uri.toString()))
           throw new java.io.IOException("That song cannot be collected");
        String id=HumEconomy.canonicalId(item.mediaId);
        if(id==null)throw new java.io.IOException("Unknown song");
        JSONObject result=signed(c,"collect",0,id);
        if(!snapshot(c).owns(id))throw new java.io.IOException("Song receipt unavailable");
        return result.optBoolean("owned",false);
    }
}
