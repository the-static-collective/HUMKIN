package org.abundent.humkinradio;

import static org.junit.Assert.*;
import org.junit.Test;
import java.util.Arrays;
import java.util.List;

public final class SharedClockTest {
    @Test public void insertCartEveryThreeIncludingLast() {
        assertEquals(Arrays.asList(0,1,2,8,3,4,5,9),
             SharedClock.insertBumpers(Arrays.asList(0,1,2,3,4,5),
                                      Arrays.asList(8,9),3));
    }
    @Test public void selectionAtBoundaryPreservesExactTiming() {
        SharedClock clock=new SharedClock(Arrays.asList(1000L,2000L,300L),
                Arrays.asList(0,1),Arrays.asList(2),2,100L);
        assertEquals(3300,clock.cycleMs());
        assertEquals(0,clock.at(100L).positionMs);
        assertEquals(1,clock.at(100L+3300).cycle);
        assertEquals(0,clock.at(100L+3300).positionMs);
        assertEquals(2,clock.at(100L+3000).trackIndex);
    }
    @Test public void shuffleIsDeterministicAndPermutation() {
        List<Integer> originals=Arrays.asList(0,1,2,3,4,5,6);
        assertEquals(SharedClock.seededShuffle(originals,42),
                     SharedClock.seededShuffle(originals,42));
        List<Integer> result=SharedClock.seededShuffle(originals,42);
        assertTrue(result.containsAll(originals));
        assertEquals(7,result.size());
        assertNotEquals(SharedClock.seededShuffle(originals,42),
                        SharedClock.seededShuffle(originals,43));
    }
}
