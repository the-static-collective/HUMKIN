package org.abundent.humkinradio;

/**
 * Progressive, evidence-grounded storylet director for the real radio Outpost.
 * A pure function: it cannot mint XP/HUM, start playback, or execute a mission.
 */
final class OutpostDirector {
    enum Verb { RADIO, CLAIM_MISSION, GRAFT, COLLECT, ANTENNA,
                ARCHIVE, CREW, START_MISSION, PERSONAL_FREQUENCY }

    static final class Facts {
        final int level,xp,bank,capacitor,antenna,archive,crew,discoveries,missions;
        final int missionId,missionProgress,missionTarget,queuedTapes;
        final long playbackMs;
        final boolean missionActive,missionReady,onAir;

        Facts(int level,int xp,int bank,int capacitor,int antenna,int archive,int crew,
              int discoveries,int missions,long playbackMs,boolean missionActive,
              boolean missionReady,int missionId,int missionProgress,int missionTarget,
              int queuedTapes,boolean onAir) {
            this.level=level;this.xp=xp;this.bank=bank;this.capacitor=capacitor;
            this.antenna=antenna;this.archive=archive;this.crew=crew;
            this.discoveries=discoveries;this.missions=missions;this.playbackMs=playbackMs;
            this.missionActive=missionActive;this.missionReady=missionReady;
            this.missionId=missionId;this.missionProgress=missionProgress;
            this.missionTarget=missionTarget;this.queuedTapes=queuedTapes;this.onAir=onAir;
        }
    }

    static final class Step {
        final Verb verb;
        final String eyebrow,title,why,button,effect;
        Step(Verb verb,String eyebrow,String title,String why,String button,String effect) {
            this.verb=verb;this.eyebrow=eyebrow;this.title=title;
            this.why=why;this.button=button;this.effect=effect;
        }
    }
    private OutpostDirector(){}

    static Step choose(Facts s) {
        if(s.missionReady)
            return new Step(Verb.CLAIM_MISSION,"A REAL RESULT HAS ARRIVED",
                    "Your expedition returned.",
                    "The listening target is complete. Settle the existing Signal and XP reward.",
                    "COLLECT EXPEDITION RESULT","Your local balance and XP will actually change.");

        if(s.antenna==0 && s.capacitor>0 && s.bank<SignalMath.upgradeCost(0,0)
                && s.bank+s.capacitor>=SignalMath.upgradeCost(0,0))
            return new Step(Verb.COLLECT,"MACHINE → NEW POSSIBILITY",
                    "Your first antenna is within reach.",
                    s.capacitor+" Signal came from real playback. Bank it to afford a radio control.",
                    "COLLECT THE CHARGE","Next: own the switch for analog radio static.");

        if(s.antenna==0 && s.bank>=SignalMath.upgradeCost(0,0))
            return new Step(Verb.ANTENNA,"YOUR FIRST REAL UPGRADE",
                    "Give the radio a new control.",
                    "The antenna changes actual Signal production and unlocks analog static control.",
                    "INSTALL THE ANTENNA","You can then control static in the radio.");

        if(s.level>=4 && s.queuedTapes==0)
            return new Step(Verb.GRAFT,"THE GARDEN LEARNS A VERB",
                    "Graft two records. Hear the change.",
                    "Choose two owner-published songs; a new A→B arrangement will actually play on your phone.",
                    "GRAFT A TWO-RECORD TAPE","You get a different listening experience, not an imaginary apple.");

        if(s.capacitor>=20)
            return new Step(Verb.COLLECT,"THE CAPACITOR HAS DONE WORK",
                    "Something is ready to collect.",
                    s.capacitor+" Signal was earned by genuine playback, not screen time.",
                    "BANK "+s.capacitor+" SIGNAL","Capacitor empties; the local bank increases.");

        if(s.antenna>0 && s.archive<2 && s.bank>=SignalMath.upgradeCost(1,s.archive))
            return new Step(Verb.ARCHIVE,"MAKE THE MACHINE SMARTER",
                    "Improve the Tape Archive.",
                    "A real change to the XP yielded by each genuine 30-second listening pulse.",
                    "UPGRADE TAPE ARCHIVE","An immediately higher XP rate, plus earned capability tiers.");

        if(s.crew<2 && s.bank>=SignalMath.upgradeCost(2,s.crew))
            return new Step(Verb.CREW,"LET THE NETWORK GROW",
                    "Improve the Night Crew.",
                    "Expand actual capacitor capacity and Signal per 30 seconds of music.",
                    "UPGRADE NIGHT CREW","Capacity and production rate increase measurably.");

        if(s.level>=7 && s.queuedTapes>0 && !s.missionActive)
            return new Step(Verb.PERSONAL_FREQUENCY,"THE STATION HAS OUTGROWN THE ROOM",
                    "Build a frequency of your own.",
                    "The full native Level 7 dial can shape a listening stream from actual songs and reactions.",
                    "OPEN BOOTLEG FREQUENCY","Your phone can play a different personalized queue.");

        if(!s.missionActive)
            return new Step(Verb.START_MISSION,"THE RECEIVER CAN REMEMBER A PURPOSE",
                    "Send the listening expedition.",
                    "Eight minutes of actual audio becomes a clear, verifiable local objective.",
                    "START THE 8-MINUTE EXPEDITION","The real listening mission starts tracking.");

        return new Step(Verb.RADIO,"REAL MUSIC, REAL PROGRESS",
                s.onAir?"The station is already playing.":"The receiver is waiting for music.",
                Math.min(s.missionProgress,s.missionTarget)+" / "+s.missionTarget+
                    (s.missionId==1?" distinct songs":" listening minutes")+
                    " observed. Only actual playback moves the target.",
                "RETURN TO THE RADIO","Listen, then return to witness what changed.");
    }

    static String witness(Facts s) {
        String proof=s.playbackMs/60000L+"m actually heard · "+
                s.discoveries+" distinct recordings";
        if(s.antenna>0)proof+=" · static control earned";
        if(s.queuedTapes>0)proof+=" · "+s.queuedTapes+" local tape grafts";
        return proof;
    }

    /** Only display after a successful native mutation and a second snapshot. */
    static String delta(Facts before,Facts after) {
        if(after.antenna>before.antenna)
            return "CONFIRMED · antenna "+before.antenna+" → "+after.antenna+
                    "; Signal/30s "+SignalMath.signalPerPulse(before.antenna,before.crew)+
                    " → "+SignalMath.signalPerPulse(after.antenna,after.crew)+
                    (before.antenna==0?"; analog static control is now available.":".");
        if(after.archive>before.archive)
            return "CONFIRMED · Tape Archive "+before.archive+" → "+after.archive+
                    "; XP/30s "+SignalMath.experiencePerPulse(before.archive)+
                    " → "+SignalMath.experiencePerPulse(after.archive)+".";
        if(after.crew>before.crew)
            return "CONFIRMED · Night Crew "+before.crew+" → "+after.crew+
                    "; capacitor "+SignalMath.cacheCapacity(before.antenna,before.crew)+
                    " → "+SignalMath.cacheCapacity(after.antenna,after.crew)+".";
        if(after.bank>before.bank && after.capacitor<before.capacitor)
            return "CONFIRMED · bank +"+(after.bank-before.bank)+
                    " Signal, capacitor "+before.capacitor+" → "+after.capacitor+".";
        if(before.missionActive && !after.missionActive && after.missions>before.missions)
            return "CONFIRMED · mission settled. XP +"+(after.xp-before.xp)+
                    ", bank +"+(after.bank-before.bank)+" Signal.";
        if(!before.missionActive && after.missionActive)
            return "CONFIRMED · a "+after.missionTarget+
                    (after.missionId==1?"-record":"-minute")+" mission is now active.";
        if(after.queuedTapes>before.queuedTapes)
            return "CONFIRMED · a new two-song Media3 queue was accepted; local graft #"+
                    after.queuedTapes+".";
        return "";
    }
}
