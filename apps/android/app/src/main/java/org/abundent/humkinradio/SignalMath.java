package org.abundent.humkinradio;

/**
 * Transparent, offline-only RPG economy. A point on the HUMKIN Top 42 is NOT
 * an Outpost resource: league points remain real qualifying song listens.
 * These functions have no clocks, network requests or Android dependencies.
 */
final class SignalMath {
    static final long PULSE_MS=30_000L;
    static final int MAX_MODULE=9;
    private SignalMath() {}

    static int levelFloor(int level) {
        long x=Math.max(0L,Math.min(100L,level-1L));
        return (int)Math.min(Integer.MAX_VALUE,40L*x*x);
    }
    static int levelFor(int experience) {
        int level=1;
        while(level<100&&experience>=levelFloor(level+1))level++;
        return level;
    }
    static int upgradeCost(int module,int currentLevel) {
        int base=module==0?35:module==1?45:60;
        int cost=base;
        for(int i=1;i<currentLevel;i++)cost=Math.min(999_999,(int)Math.ceil(cost*1.8));
        return cost;
    }
    static int cacheCapacity(int tower,int crew) {
        return 120 + tower*110 + crew*45;
    }
    static int signalPerPulse(int tower,int crew) {
        return 3 + tower*2 + crew;
    }
    static int experiencePerPulse(int archive) {
        return 2 + archive;
    }
    static int missionGoal(int missionId) {
        if(missionId==0)return 8; // minutes
        if(missionId==1)return 4; // distinct qualified songs
        if(missionId==2)return 25; // minutes
        return 0;
    }
    static int missionReward(int id) {
        if(id==0)return 85;
        if(id==1)return 110;
        if(id==2)return 300;
        return 0;
    }
    static int missionXp(int id) {
        if(id==0)return 28;
        if(id==1)return 50;
        if(id==2)return 100;
        return 0;
    }
    static String rank(int level) {
        if(level>=18)return "FREQUENCY LEGEND";
        if(level>=11)return "CHIEF OF THE NIGHT";
        if(level>=7)return "TOWER KEEPER";
        if(level>=4)return "NIGHT OPERATOR";
        if(level>=2)return "JUNIOR ENGINEER";
        return "NEW ARRIVAL";
    }
    static String chapter(int level) {
        if(level>=18)return "THE LIGHTHOUSE";
        if(level>=11)return "THE OLD TOWER";
        if(level>=7)return "THE LONG RANGE STATION";
        if(level>=4)return "THE BACKROOM TRANSMITTER";
        return "THE BASEMENT BOOTH";
    }
}
