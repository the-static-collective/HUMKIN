package org.abundent.humkinradio;

import static org.junit.Assert.*;
import org.junit.Test;

/** The doors are earned, never in the home UI or an arbitrary boolean. */
public final class OutpostMilestonesTest {
    @Test public void newListenerHasOnlyTheRadioAndOutpost(){
        assertEquals(0,OutpostMilestones.stage(1));
        assertFalse(OutpostMilestones.unlocked(OutpostMilestones.ORCHARD,1));
        assertFalse(OutpostMilestones.unlocked(OutpostMilestones.BOOTLEG,1));
        assertEquals(OutpostMilestones.ORCHARD,OutpostMilestones.nextDoor(1));
    }
    @Test public void gardenRevealsWithFirstBackroomStation(){
        assertFalse(OutpostMilestones.unlocked(OutpostMilestones.ORCHARD,3));
        assertTrue(OutpostMilestones.unlocked(OutpostMilestones.ORCHARD,4));
        assertFalse(OutpostMilestones.unlocked(OutpostMilestones.BOOTLEG,4));
        assertEquals(1,OutpostMilestones.stage(4));
        assertEquals(OutpostMilestones.BOOTLEG,OutpostMilestones.nextDoor(4));
    }
    @Test public void personalFrequencyIsDeeperLongRangeStation(){
        assertFalse(OutpostMilestones.unlocked(OutpostMilestones.BOOTLEG,6));
        assertTrue(OutpostMilestones.unlocked(OutpostMilestones.BOOTLEG,7));
        assertTrue(OutpostMilestones.unlocked(OutpostMilestones.BOOTLEG,31));
        assertTrue(OutpostMilestones.unlocked(OutpostMilestones.ORCHARD,31));
        assertEquals(2,OutpostMilestones.stage(7));
        assertEquals("",OutpostMilestones.nextDoor(7));
    }
    @Test public void experienceTargetsAreActuallyReachableByTheExistingRpg(){
        int l4=SignalMath.levelFloor(OutpostMilestones.ORCHARD_LEVEL);
        int l7=SignalMath.levelFloor(OutpostMilestones.BOOTLEG_LEVEL);
        assertTrue(l4>0);
        assertTrue(l7>l4);
        assertEquals(l4,OutpostMilestones.remainingXp(OutpostMilestones.ORCHARD,0));
        assertEquals(1,OutpostMilestones.remainingXp(OutpostMilestones.ORCHARD,l4-1));
        assertEquals(0,OutpostMilestones.remainingXp(OutpostMilestones.ORCHARD,l4));
        assertEquals(0,OutpostMilestones.remainingXp(OutpostMilestones.BOOTLEG,l7+100));
    }
    @Test public void unrecognizedDoorsFailClosed(){
        assertFalse(OutpostMilestones.unlocked("not-a-feature",100));
        assertFalse(OutpostMilestones.unlocked("",100));
        assertEquals(Integer.MAX_VALUE,OutpostMilestones.requiredLevel("future"));
    }
}
