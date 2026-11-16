package org.abundent.humkinradio;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.SystemClock;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.TimeZone;

/**
 * Signal Outpost: purely local, optional listening RPG. Only actual audible
 * Media3 time adds experience or fills the capacitor. There is deliberately
 * NO elapsed-wall-clock catch-up, background timer, score fabrication, reward
 * advertisement or extra data collection.
 */
final class SignalRpg {
    private static final String FILE="humkin-signal-outpost-v1";
    private SignalRpg() {}

    static final class Snapshot {
        final int xp,level,wallet,capacitor,capacity,tower,archive,crew,discovered,missions;
        final long totalMs,todayMs;
        final int uniqueToday,dailyClaims;
        final boolean chartVisited,missionActive,onAir;
        final int missionId,missionProgress,missionTarget;
        final String day,rank,chapter;
        Snapshot(SharedPreferences p) {
            xp=p.getInt("xp",0);
            level=SignalMath.levelFor(xp);
            wallet=p.getInt("wallet",0);
            capacitor=p.getInt("capacitor",0);
            tower=p.getInt("module_tower",0);
            archive=p.getInt("module_archive",0);
            crew=p.getInt("module_crew",0);
            capacity=SignalMath.cacheCapacity(tower,crew);
            discovered=p.getInt("discovered",0);
            missions=p.getInt("missions_completed",0);
            totalMs=p.getLong("total_ms",0);
            todayMs=p.getLong("today_ms",0);
            uniqueToday=p.getStringSet("today_tracks",java.util.Collections.emptySet()).size();
            dailyClaims=p.getInt("daily_claims",0);
            chartVisited=p.getBoolean("chart_visit",false);
            missionActive=p.getBoolean("mission_active",false);
            missionId=p.getInt("mission_id",-1);
            missionTarget=SignalMath.missionGoal(missionId);
            missionProgress=!missionActive?0:missionId==1?
                    p.getStringSet("mission_tracks",java.util.Collections.emptySet()).size():
                    (int)(p.getLong("mission_ms",0L)/60000L);
            long last=p.getLong("last_audible_elapsed",0L);
            onAir=last>0L && SystemClock.elapsedRealtime()>=last
                    && SystemClock.elapsedRealtime()-last<20_000L;
            day=p.getString("day", "");
            rank=SignalMath.rank(level);
            chapter=SignalMath.chapter(level);
        }
        boolean missionReady() {
            return missionActive && missionTarget>0 && missionProgress>=missionTarget;
        }
        boolean dailyReady(int index) {
            switch(index) {
                case 0: return todayMs>=4*60_000L;
                case 1: return uniqueToday>=3;
                case 2: return chartVisited;
                default:return false;
            }
        }
        boolean dailyClaimed(int index) {
            return (dailyClaims & (1<<index))!=0;
        }
    }

    private static SharedPreferences store(Context c) {
        return c.getApplicationContext().getSharedPreferences(FILE,Context.MODE_PRIVATE);
    }

    static String chicagoDay(long timestamp) {
        SimpleDateFormat fmt=new SimpleDateFormat("yyyy-MM-dd",Locale.US);
        fmt.setTimeZone(TimeZone.getTimeZone("America/Chicago"));
        return fmt.format(new Date(timestamp));
    }

    private static void rollDay(SharedPreferences p) {
        String day=chicagoDay(System.currentTimeMillis());
        if(!day.equals(p.getString("day",""))) {
            // Do not reset actual experience or ongoing expeditions.
            p.edit().putString("day",day)
                .putLong("today_ms",0L)
                .putStringSet("today_tracks",new HashSet<>())
                .putInt("daily_claims",0)
                .putBoolean("chart_visit",false)
                .apply();
        }
    }

    static synchronized Snapshot snapshot(Context c) {
        SharedPreferences p=store(c);
        rollDay(p);
        return new Snapshot(p);
    }

    /** The service batches real playback deltas; max one 15s batch. */
    static synchronized void audible(Context c,long deltaMs) {
        if(deltaMs<=0)return;
        SharedPreferences p=store(c);
        rollDay(p);
        long bounded=Math.min(deltaMs,15_000L);
        long before=p.getLong("total_ms",0L);
        long after=before+bounded;
        int pulses=(int)(after/SignalMath.PULSE_MS-before/SignalMath.PULSE_MS);
        int tower=p.getInt("module_tower",0);
        int archive=p.getInt("module_archive",0);
        int crew=p.getInt("module_crew",0);
        int experience=Math.min(1_900_000_000,
                p.getInt("xp",0)+pulses*SignalMath.experiencePerPulse(archive));
        int cache=Math.min(SignalMath.cacheCapacity(tower,crew),
                p.getInt("capacitor",0)+pulses*SignalMath.signalPerPulse(tower,crew));
        SharedPreferences.Editor edit=p.edit()
            .putLong("total_ms",after)
            .putLong("today_ms",p.getLong("today_ms",0L)+bounded)
            .putLong("last_audible_elapsed",SystemClock.elapsedRealtime())
            .putInt("xp",experience)
            .putInt("capacitor",cache);
        if(p.getBoolean("mission_active",false))
            edit.putLong("mission_ms",p.getLong("mission_ms",0L)+bounded);
        edit.apply();
    }

    /** A track is discovered only after >=30 seconds of its audible playback. */
    static synchronized void qualifiedTrack(Context c,String id) {
        if(id==null || !id.matches("[A-Za-z0-9:_-]{3,110}"))return;
        SharedPreferences p=store(c);
        rollDay(p);
        Set<String> today=new HashSet<>(
                p.getStringSet("today_tracks",java.util.Collections.emptySet()));
        Set<String> lifetime=new HashSet<>(
                p.getStringSet("archive_tracks",java.util.Collections.emptySet()));
        Set<String> mission=new HashSet<>(
                p.getStringSet("mission_tracks",java.util.Collections.emptySet()));
        boolean first=today.add(id);
        boolean newDiscovery=lifetime.add(id);
        int tower=p.getInt("module_tower",0),crew=p.getInt("module_crew",0);
        SharedPreferences.Editor edit=p.edit();
        if(first)edit.putStringSet("today_tracks",today);
        if(newDiscovery){
            // Permanent, unique discoveries earn XP once, not once per replay.
            edit.putInt("discovered",p.getInt("discovered",0)+1)
                .putInt("xp",p.getInt("xp",0)+8)
                .putInt("capacitor",Math.min(SignalMath.cacheCapacity(tower,crew),
                    p.getInt("capacitor",0)+10));
            // Avoid unbounded local metadata (up to first 900 unique recordings).
            if(lifetime.size()<=900)edit.putStringSet("archive_tracks",lifetime);
        }
        if(p.getBoolean("mission_active",false)&&p.getInt("mission_id",-1)==1
                &&mission.add(id))edit.putStringSet("mission_tracks",mission);
        edit.apply();
    }

    /** Collect stored signal without crediting any synthetic playing time. */
    static synchronized int collect(Context c) {
        SharedPreferences p=store(c);
        int saved=p.getInt("capacitor",0);
        if(saved>0)p.edit()
            .putInt("wallet",Math.min(1_000_000_000,p.getInt("wallet",0)+saved))
            .putInt("capacitor",0).apply();
        return saved;
    }

    /** 0 = tower, 1 = archive, 2 = night crew. Returns true on purchase. */
    static synchronized boolean upgrade(Context c,int module) {
        if(module<0||module>2)return false;
        SharedPreferences p=store(c);
        String key=module==0?"module_tower":module==1?"module_archive":"module_crew";
        int level=p.getInt(key,0);
        if(level>=SignalMath.MAX_MODULE)return false;
        int cost=SignalMath.upgradeCost(module,level);
        int wallet=p.getInt("wallet",0);
        if(wallet<cost)return false;
        p.edit().putInt("wallet",wallet-cost).putInt(key,level+1).apply();
        return true;
    }

    static synchronized boolean startMission(Context c,int id) {
        if(id<0||id>2)return false;
        SharedPreferences p=store(c);
        rollDay(p);
        if(p.getBoolean("mission_active",false))return false;
        if(id==2&&SignalMath.levelFor(p.getInt("xp",0))<4)return false;
        p.edit().putBoolean("mission_active",true)
            .putInt("mission_id",id)
            .putLong("mission_ms",0L)
            .putStringSet("mission_tracks",new HashSet<>())
            .apply();
        return true;
    }

    static synchronized boolean claimMission(Context c) {
        SharedPreferences p=store(c);
        Snapshot s=new Snapshot(p);
        if(!s.missionReady())return false;
        p.edit()
            .putInt("wallet",p.getInt("wallet",0)+SignalMath.missionReward(s.missionId))
            .putInt("xp",p.getInt("xp",0)+SignalMath.missionXp(s.missionId))
            .putInt("missions_completed",p.getInt("missions_completed",0)+1)
            .putBoolean("mission_active",false)
            .putInt("mission_id",-1)
            .putLong("mission_ms",0L)
            .putStringSet("mission_tracks",new HashSet<>())
            .apply();
        return true;
    }

    static synchronized boolean claimDaily(Context c,int id) {
        if(id<0||id>2)return false;
        SharedPreferences p=store(c);
        rollDay(p);
        Snapshot s=new Snapshot(p);
        if(s.dailyClaimed(id)||!s.dailyReady(id))return false;
        int[] money={40,50,25};
        int[] experience={15,25,12};
        p.edit().putInt("daily_claims",s.dailyClaims|(1<<id))
            .putInt("wallet",s.wallet+money[id])
            .putInt("xp",s.xp+experience[id]).apply();
        return true;
    }

    static synchronized void visitLeague(Context c) {
        SharedPreferences p=store(c);
        rollDay(p);
        p.edit().putBoolean("chart_visit",true).apply();
    }
}
