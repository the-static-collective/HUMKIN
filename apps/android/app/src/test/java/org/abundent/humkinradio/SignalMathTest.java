package org.abundent.humkinradio;

import static org.junit.Assert.*;
import org.junit.Test;

/** Pure economy regressions: no fake off-air progress, wager, or chart votes. */
public class SignalMathTest {
    @Test public void transparentProgressionHasNondecreasingThresholds() {
        assertEquals(0, SignalMath.levelFloor(1));
        assertEquals(40, SignalMath.levelFloor(2));
        assertEquals(160, SignalMath.levelFloor(3));
        assertEquals(1, SignalMath.levelFor(0));
        assertEquals(1, SignalMath.levelFor(39));
        assertEquals(2, SignalMath.levelFor(40));
        assertEquals(3, SignalMath.levelFor(160));
        for(int level=1;level<99;level++){
            assertTrue(SignalMath.levelFloor(level+1)>SignalMath.levelFloor(level));
        }
    }
    @Test public void growthIsCappedAndCostsMoreWithLevel() {
        for(int module=0;module<3;module++){
            int old=0;
            for(int level=0;level<SignalMath.MAX_MODULE;level++){
                int cost=SignalMath.upgradeCost(module,level);
                assertTrue(cost>0);
                if(level>0)assertTrue(cost>=old);
                old=cost;
            }
        }
        assertEquals(3,SignalMath.signalPerPulse(0,0));
        assertEquals(2,SignalMath.experiencePerPulse(0));
        assertEquals(120,SignalMath.cacheCapacity(0,0));
        assertEquals(5,SignalMath.signalPerPulse(1,0));
        assertEquals(3,SignalMath.experiencePerPulse(1));
        assertTrue(SignalMath.cacheCapacity(1,1)>SignalMath.cacheCapacity(1,0));
    }
    @Test public void antennaUpgradeEarnsControlOfRadioStatic() {
        assertFalse(SignalMath.canControlRadioStatic(0));
        assertTrue(SignalMath.canControlRadioStatic(1));
        assertTrue(SignalMath.canControlRadioStatic(9));
        // XP level alone never unlocks hardware settings.
        assertFalse(SignalMath.canControlRadioStatic(0));
    }

    @Test public void expeditionsHaveLegibleFiniteGoals() {
        assertEquals(8,SignalMath.missionGoal(0));
        assertEquals(4,SignalMath.missionGoal(1));
        assertEquals(25,SignalMath.missionGoal(2));
        assertEquals(0,SignalMath.missionGoal(100));
        for(int i=0;i<3;i++){
            assertTrue(SignalMath.missionReward(i)>0);
            assertTrue(SignalMath.missionXp(i)>0);
        }
        assertEquals("NEW ARRIVAL",SignalMath.rank(1));
        assertEquals("THE OLD TOWER",SignalMath.chapter(12));
    }
}