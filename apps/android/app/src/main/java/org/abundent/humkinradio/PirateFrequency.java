package org.abundent.humkinradio;

import android.content.Context;
import android.content.SharedPreferences;
import androidx.media3.common.MediaItem;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** A saved native tuning preference, NOT a transmitter or an actual FM signal. */
final class PirateFrequency {
    static final class Dial {
        final String mood,anchor;
        final int balance;
        Dial(String mood,int balance,String anchor){
            this.mood=PirateSelector.validMood(mood)?mood:PirateSelector.OPEN;
            this.balance=Math.max(0,Math.min(2,balance));
            this.anchor=SongReactionId.canonical(anchor);
        }
    }
    private PirateFrequency(){}
    private static SharedPreferences prefs(Context c){
        return c.getApplicationContext().getSharedPreferences("humkin-radio",Context.MODE_PRIVATE);
    }
    static Dial last(Context c){
        SharedPreferences p=prefs(c);
        return new Dial(p.getString("pirate-mood-v1",PirateSelector.OPEN),
                p.getInt("pirate-blend-v1",PirateSelector.BOTH),
                p.getString("pirate-seed-v1",""));
    }
    static void save(Context c,Dial dial){
        prefs(c).edit()
                .putString("pirate-mood-v1",dial.mood)
                .putInt("pirate-blend-v1",dial.balance)
                .putString("pirate-seed-v1",dial.anchor==null?"":dial.anchor)
                .apply();
    }
    static Set<String> recentlyHeard(Context c){
        long cutoff=System.currentTimeMillis()-FreshRotation.HOUR_MS;
        Set<String> known=new HashSet<>();
        try{
            org.json.JSONArray history=new org.json.JSONArray(
                    prefs(c).getString("recent-records","[]"));
            for(int i=0;i<history.length();i++){
                org.json.JSONObject row=history.optJSONObject(i);
                if(row!=null&&row.optLong("time")>=cutoff)
                    known.add(row.optString("id",""));
            }
        }catch(Exception ignored){}
        PlaybackContinuity.Saved checkpoint=PlaybackContinuity.read(prefs(c));
        String active=checkpoint.lastTrackIfRecent(System.currentTimeMillis());
        if(!active.isEmpty())known.add(active);
        return known;
    }
    static List<MediaItem> mix(Context c,RadioCatalog.Station station,Dial dial,
            PirateWeather.Board weather,boolean anchorFirst,long entropy){
        Map<String,String> personal=SongReactions.snapshot(c);
        List<String> ids=PirateSelector.order(station.pirateCatalog(),dial.mood,dial.balance,
                anchorFirst?dial.anchor:null, personal,
                weather==null?Collections.emptyMap():weather.tracks,
                recentlyHeard(c),entropy);
        // Resolves IDs only through the current published station catalog.
        // Never construct a media URL from a user-supplied seed or reaction.
        return station.queueFromIds(ids);
    }
}
