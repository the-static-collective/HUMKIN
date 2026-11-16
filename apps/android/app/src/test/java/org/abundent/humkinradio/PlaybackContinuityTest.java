package org.abundent.humkinradio;

import org.junit.Test;
import java.util.Arrays;
import java.util.Collections;

import static org.junit.Assert.*;

public final class PlaybackContinuityTest {
    @Test public void shortRestartKeepsUnplayedShuffleQueueAndPosition() {
        long savedAt = 1_000_000L;
        PlaybackContinuity.Saved saved = new PlaybackContinuity.Saved(
                "shuffle", "track-5", savedAt, 126_000L, true,
                Arrays.asList("track-5", "track-11", "track-1"));
        assertTrue(saved.canResumeShuffle(savedAt + 120_000L));
        assertEquals(126_000L, saved.positionMs);
        assertEquals("track-5", saved.remainingIds.get(0));
        assertEquals("track-5", saved.lastTrackIfRecent(savedAt + 120_000L));
    }

    @Test public void hoursOldQueueStartsFreshInsteadOfResumingFromBeginning() {
        long now = 20_000_000L;
        PlaybackContinuity.Saved old = new PlaybackContinuity.Saved(
                "shuffle", "track-5", now - 3 * 60 * 60 * 1000L,
                50_000L, false, Arrays.asList("track-5", "track-8"));
        assertFalse(old.canResumeShuffle(now));
        assertEquals("", old.lastTrackIfRecent(now));
    }

    @Test public void sameTimeNeverResumesPrivateQueueOrOverridesLiveClock() {
        long now = 5_000_000L;
        PlaybackContinuity.Saved air = new PlaybackContinuity.Saved(
                "radio", "track-3", now, 60_000L, true,
                Arrays.asList("track-3", "track-9"));
        assertFalse(air.canResumeShuffle(now));
        assertEquals("track-3", air.lastTrackIfRecent(now));
    }

    @Test public void damagedOrIncompleteQueueCannotRepeatWrongRecord() {
        PlaybackContinuity.Saved incomplete = new PlaybackContinuity.Saved(
                "shuffle", "track-2", 1000L, 12_000L, true,
                Arrays.asList("track-7", "track-2"));
        assertFalse(incomplete.canResumeShuffle(1100L));
        PlaybackContinuity.Saved empty = new PlaybackContinuity.Saved(
                "shuffle", "track-2", 1000L, 12_000L, true,
                Collections.emptyList());
        assertFalse(empty.canResumeShuffle(1100L));
    }

    @Test public void backwardsClockNeverTreatsFutureBookmarkAsCurrent() {
        PlaybackContinuity.Saved saved = new PlaybackContinuity.Saved(
                "shuffle", "track-9", 15000L, 0L, false,
                Arrays.asList("track-9"));
        assertFalse(saved.canResumeShuffle(14000L));
        assertEquals("", saved.lastTrackIfRecent(14000L));
    }
}
