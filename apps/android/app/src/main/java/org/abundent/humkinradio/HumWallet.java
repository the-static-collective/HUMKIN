package org.abundent.humkinradio;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import androidx.media3.common.MediaItem;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * The on-device HUM wallet: an immediately USEFUL local listening-game ledger
 * for DRM-free music collection. It deliberately never claims to be the shared
 * Station Guilds verified HUM ledger, a monetary balance or anti-Sybil identity.
 * A later server adaptor must authoritatively issue/redeem credits, not upload
 * client-edited balances as verified HUM. One JSON preference commit holds
 * the debit and entitlement together.
 */
final class HumWallet {
    private static final String FILE="humkin-local-hum-v1", STATE="state";
    private HumWallet() {}

    static final class Record {
        final String id,title,artist,audioUrl,uri;
        final int price;
        final long acquired;
        Record(String id,String title,String artist,String audioUrl,String uri,int price,long acquired) {
            this.id=id;this.title=title;this.artist=artist;this.audioUrl=audioUrl;
            this.uri=uri;this.price=price;this.acquired=acquired;
        }
    }
    static final class Snapshot {
        final int balance,earned,spent,lastAward;
        final long awardSequence,awardAt;
        final List<Record> records;
        Snapshot(JSONObject state) {
            balance=Math.max(0,state.optInt("balance",0));
            earned=Math.max(0,state.optInt("earned",0));
            spent=Math.max(0,state.optInt("spent",0));
            lastAward=state.optInt("last_award",0);
            awardSequence=state.optLong("award_seq",0);
            awardAt=state.optLong("award_at",0);
            records=new ArrayList<>();
            JSONObject rows=state.optJSONObject("collection");
            if(rows!=null) {
                java.util.Iterator<String> keys=rows.keys();
                while(keys.hasNext()&&records.size()<3000){
                    String id=keys.next();
                    JSONObject row=rows.optJSONObject(id);
                    if(row==null||HumEconomy.canonicalId(id)==null)continue;
                    String url=row.optString("audio","");
                    if(!HumEconomy.approvedAudio(url))continue;
                    records.add(new Record(id,row.optString("title","Unknown Record"),
                        row.optString("artist","HUMKIN"),url,row.optString("uri",""),
                        row.optInt("price",1),row.optLong("at",0)));
                }
            }
            records.sort(Comparator.comparingLong((Record rec)->rec.acquired).reversed());
        }
        Record find(String id) {
            for(Record r:records)if(r.id.equals(id))return r;
            return null;
        }
    }
    private static SharedPreferences prefs(Context c){
        return c.getApplicationContext().getSharedPreferences(FILE,Context.MODE_PRIVATE);
    }
    private static JSONObject load(Context c) {
        try{return new JSONObject(prefs(c).getString(STATE,"{}"));}
        catch(Exception ignored){return new JSONObject();}
    }
    private static boolean commit(Context c,JSONObject state){
        return prefs(c).edit().putString(STATE,state.toString()).commit();
    }
    static synchronized Snapshot snapshot(Context c){return new Snapshot(load(c));}

    /**
     * Called only by the actual Media3 playback listener AFTER SignalRpg's
     * bounded audible delta is committed. No elapsed-clock reward or button
     * can mint HUM. Milestone bitset survives repeated callbacks/restarts.
     */
    static synchronized int settleListening(Context c,SignalRpg.Snapshot radio) {
        if(radio==null||radio.day==null||radio.day.isEmpty())return 0;
        JSONObject state=load(c);
        String oldDay=state.optString("day","");
        int was=radio.day.equals(oldDay)?state.optInt("milestones",0):0;
        int now=HumEconomy.newMask(was,radio.todayMs);
        int amount=HumEconomy.newAwards(was,radio.todayMs);
        if(amount==0 && radio.day.equals(oldDay))return 0;
        try{
            state.put("day",radio.day).put("milestones",now);
            if(amount>0){
                state.put("balance",state.optInt("balance",0)+amount);
                state.put("earned",state.optInt("earned",0)+amount);
                state.put("last_award",amount);
                state.put("award_seq",state.optLong("award_seq",0)+1);
                state.put("award_at",System.currentTimeMillis());
            }
            return commit(c,state)?amount:0;
        }catch(Exception ignored){return 0;}
    }

    static final int INSUFFICIENT=0,ACQUIRED=1,ALREADY_OWNED=2,INVALID=-1;
    /** Atomic local game debit + permanent collection membership. */
    static synchronized int keep(Context c,MediaItem item) {
        if(item==null||item.localConfiguration==null)return INVALID;
        String id=HumEconomy.canonicalId(item.mediaId);
        String audio=item.localConfiguration.uri.toString();
        if(id==null||!HumEconomy.approvedAudio(audio)||
                item.mediaId.startsWith("air-")||item.mediaId.startsWith("bumper-"))
            return INVALID;
        JSONObject state=load(c);
        try{
            JSONObject rows=state.optJSONObject("collection");
            if(rows==null)rows=new JSONObject();
            if(rows.has(id))return ALREADY_OWNED;
            int price=price(item);
            int balance=state.optInt("balance",0);
            if(balance<price)return INSUFFICIENT;
            String title=item.mediaMetadata.title==null?"Unknown Record":
                    item.mediaMetadata.title.toString().trim();
            String artist=item.mediaMetadata.artist==null?"HUMKIN":
                    item.mediaMetadata.artist.toString().trim();
            if(title.isEmpty())title="Unknown Record";
            if(title.length()>180)title=title.substring(0,180);
            if(artist.length()>120)artist=artist.substring(0,120);
            JSONObject record=new JSONObject().put("title",title).put("artist",artist)
                .put("audio",audio).put("at",System.currentTimeMillis())
                .put("price",price).put("uri","");
            rows.put(id,record);
            state.put("collection",rows);
            state.put("balance",balance-price);
            state.put("spent",state.optInt("spent",0)+price);
            return commit(c,state)?ACQUIRED:INVALID;
        }catch(Exception ignored){return INVALID;}
    }
    static int price(MediaItem item){
        android.os.Bundle extras=item==null?null:item.mediaMetadata.extras;
        return HumEconomy.price(extras!=null&&extras.getBoolean("humkin_current_single",false));
    }
    static synchronized boolean setDownloaded(Context c,String id,String contentUri){
        if(HumEconomy.canonicalId(id)==null||contentUri==null)return false;
        // MediaStore content URI or old-device app-private file URI only.
        Uri uri=Uri.parse(contentUri);
        if(!("content".equals(uri.getScheme())&&"media".equals(uri.getAuthority())) &&
           !("file".equals(uri.getScheme())&&uri.getPath()!=null))return false;
        JSONObject state=load(c);
        try{
            JSONObject rows=state.optJSONObject("collection");
            JSONObject row=rows==null?null:rows.optJSONObject(id);
            if(row==null)return false;
            row.put("uri",contentUri);
            return commit(c,state);
        }catch(Exception ignored){return false;}
    }
    static synchronized boolean clearDownloaded(Context c,String id) {
        JSONObject state=load(c);
        try{
            JSONObject rows=state.optJSONObject("collection");
            JSONObject row=rows==null?null:rows.optJSONObject(id);
            if(row==null)return false;
            row.put("uri","");
            return commit(c,state);
        }catch(Exception ignored){return false;}
    }
}
