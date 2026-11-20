package org.abundent.humkinradio;

import org.junit.Test;
import static org.junit.Assert.*;

public class StationSeedUrlTest {
    @Test public void validPublishedIdBecomesOnlyOneBoundedSeed() {
        assertEquals("https://humkin.abundent.org/fm/signal/?seed=mutant-pop-01",
                StationSeedUrl.forTrack("mutant-pop-01"));
        assertEquals("https://humkin.abundent.org/fm/signal/?seed=blue_sky",
                StationSeedUrl.forTrack("blue_sky"));
    }
    @Test public void untrustedIdsNeverBecomeQueryOrHost() {
        String base=StationSeedUrl.STUDIO;
        assertEquals(base,StationSeedUrl.forTrack(null));
        assertEquals(base,StationSeedUrl.forTrack(""));
        assertEquals(base,StationSeedUrl.forTrack("bumper.wav?name=foo"));
        assertEquals(base,StationSeedUrl.forTrack("a&admin=1"));
        assertEquals(base,StationSeedUrl.forTrack("a".repeat(91)));
        assertEquals(base,StationSeedUrl.forTrack("https://evil.example/"));
    }
}
