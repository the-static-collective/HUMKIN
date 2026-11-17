package org.abundent.humkinradio;

import static org.junit.Assert.*;
import org.junit.Test;

/** Flow tests cover real consequences; no generated XP, fake charts or server. */
public final class OutpostDirectorTest {
    private OutpostDirector.Facts state(int level,int xp,int bank,int capacitor,
           int antenna,int archive,int crew,boolean active,boolean complete,
           int missionProgress,int tapeCount,boolean onAir){
        return new OutpostDirector.Facts(level,xp,bank,capacitor,antenna,archive,crew,
                4,0,10*60000L,active,complete,0,missionProgress,8,tapeCount,onAir);
    }
    private OutpostDirector.Verb choose(OutpostDirector.Facts s){
        return OutpostDirector.choose(s).verb;
    }
    @Test public void absoluteFirstInteractionIsStillJustTheMusic(){
        OutpostDirector.Facts first=new OutpostDirector.Facts(
                1,0,0,0,0,0,0,0,0,0L,false,false,-1,0,0,0,false);
        assertEquals(OutpostDirector.Verb.RADIO,choose(first));
        assertTrue(OutpostDirector.choose(first).why.contains("actually hear"));
    }
    @Test public void firstRewardIsARealRadioControlNotAnImaginaryHarvest(){
        assertEquals(OutpostDirector.Verb.ANTENNA,
                choose(state(1,80,35,0,0,0,0,false,false,0,0,false)));
        assertEquals(OutpostDirector.Verb.COLLECT,
                choose(state(1,80,14,21,0,0,0,false,false,0,0,true)));
        OutpostDirector.Facts before=state(1,80,35,0,0,0,0,false,false,0,0,false);
        OutpostDirector.Facts after=state(1,80,0,0,1,0,0,false,false,0,0,false);
        String proof=OutpostDirector.delta(before,after);
        assertTrue(proof.contains("static control"));
        assertTrue(proof.contains("3 → 5"));
    }
    @Test public void finishingActualMissionTakesPrecedenceOverOtherMenus(){
        assertEquals(OutpostDirector.Verb.CLAIM_MISSION,
                choose(state(4,800,0,80,1,0,0,true,true,8,0,true)));
    }
    @Test public void orchardGraftRequiresExistingLevelFourAndRealUnreadResult(){
        assertNotEquals(OutpostDirector.Verb.GRAFT,
                choose(state(3,500,0,0,1,0,0,false,false,0,0,false)));
        assertEquals(OutpostDirector.Verb.GRAFT,
                choose(state(4,800,0,0,1,0,0,false,false,0,0,false)));
        assertNotEquals(OutpostDirector.Verb.GRAFT,
                choose(state(4,800,0,0,1,0,0,false,false,0,1,false)));
    }
    @Test public void anActiveMissionSendsListenerBackToActuallyPlayingMusic(){
        OutpostDirector.Facts underway=state(4,800,0,0,1,0,0,true,false,4,1,false);
        assertEquals(OutpostDirector.Verb.RADIO,choose(underway));
        assertTrue(OutpostDirector.choose(underway).why.contains("4 / 8"));
    }
    @Test public void futureFrequencyRequiresExistingEarnedLevelSeven(){
        assertNotEquals(OutpostDirector.Verb.PERSONAL_FREQUENCY,
                choose(state(6,1300,0,0,1,0,0,false,false,0,1,true)));
        assertEquals(OutpostDirector.Verb.PERSONAL_FREQUENCY,
                choose(state(7,1440,0,0,1,0,0,false,false,0,1,true)));
    }
    @Test public void archiveImprovesRealListeningRate(){
        OutpostDirector.Facts before=state(4,600,80,0,1,0,0,false,false,0,1,true);
        OutpostDirector.Facts after=state(4,600,35,0,1,1,0,false,false,0,1,true);
        assertEquals(OutpostDirector.Verb.ARCHIVE,choose(before));
        assertTrue(OutpostDirector.delta(before,after).contains("XP/30s 2 → 3"));
        assertTrue(OutpostDirector.witness(after).contains("10m actually heard"));
    }
    @Test public void localTapeCountCannotBeMisrepresentedAsAudibleMinutes(){
        OutpostDirector.Facts old=state(4,600,0,0,1,0,0,false,false,0,0,false);
        OutpostDirector.Facts updated=state(4,600,0,0,1,0,0,false,false,0,1,false);
        assertTrue(OutpostDirector.delta(old,updated).contains("two-song Media3 queue"));
        assertEquals(old.playbackMs,updated.playbackMs);
        assertEquals(old.xp,updated.xp);
    }
}
