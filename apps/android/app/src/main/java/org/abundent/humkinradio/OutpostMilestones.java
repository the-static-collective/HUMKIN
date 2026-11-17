package org.abundent.humkinradio;

/**
 * Actual RPG progression gates: real audible Media3 playback earns the XP
 * behind these doors. No paywall, manual claim, server account, or daily reset.
 *
 * First new world opens with the Backroom Transmitter (LV4), while the
 * listener's own Bootleg Frequency is a Long Range Station discovery (LV7).
 * Unlocks are level-based so an already advanced Outpost keeps its doors.
 */
final class OutpostMilestones {
    static final int ORCHARD_LEVEL=4;
    static final int BOOTLEG_LEVEL=7;
    static final String ORCHARD="orchard";
    static final String BOOTLEG="bootleg";
    private OutpostMilestones() {}

    static int requiredLevel(String door){
        if(ORCHARD.equals(door))return ORCHARD_LEVEL;
        if(BOOTLEG.equals(door))return BOOTLEG_LEVEL;
        return Integer.MAX_VALUE;
    }
    static boolean unlocked(String door,int outpostLevel){
        return outpostLevel>=requiredLevel(door);
    }
    static int stage(int level){
        return level>=BOOTLEG_LEVEL?2:level>=ORCHARD_LEVEL?1:0;
    }
    static String nextDoor(int level){
        return stage(level)==0?ORCHARD:stage(level)==1?BOOTLEG:"";
    }
    static int remainingXp(String door,int currentXp){
        int required=requiredLevel(door);
        if(required==Integer.MAX_VALUE)return Integer.MAX_VALUE;
        return Math.max(0,SignalMath.levelFloor(required)-Math.max(0,currentXp));
    }
}
