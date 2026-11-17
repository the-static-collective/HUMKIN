package org.abundent.humkinradio;

import org.junit.Test;
import static org.junit.Assert.*;

/** The receipt gates depend on actual playable milliseconds, never idle time. */
public final class NativeNightWatchTest {
    @Test public void recordingNeedsThirtySecondsOfObservedAudio(){
        assertFalse(NativeNightWatch.qualified(0));
        assertFalse(NativeNightWatch.qualified(29_999L));
        assertTrue(NativeNightWatch.qualified(30_000L));
    }
    @Test public void aWatchClosesAfterThirtyQuietMinutes(){
        long last=1_000_000L;
        assertFalse(NativeNightWatch.closed(last,last+NativeNightWatch.QUIET_MS-1));
        assertTrue(NativeNightWatch.closed(last,last+NativeNightWatch.QUIET_MS));
        assertFalse(NativeNightWatch.closed(last,last-100L));
        assertFalse(NativeNightWatch.closed(0,last+NativeNightWatch.QUIET_MS));
    }
    @Test public void inProgressReportsNeedFiveMinutesOfActualProgress(){
        assertEquals(300_000L,NativeNightWatch.PREVIEW_MS);
        assertTrue(NativeNightWatch.PREVIEW_MS>NativeNightWatch.QUALIFIED_MS);
    }
}
