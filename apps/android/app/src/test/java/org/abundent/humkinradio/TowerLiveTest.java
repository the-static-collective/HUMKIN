package org.abundent.humkinradio;

import static org.junit.Assert.*;
import org.junit.Test;

/** Pure URL contract for the real station, before Android playback tests. */
public final class TowerLiveTest {
    @Test public void stationOneMapsToTheExistingLivePublicRelay(){
        assertEquals("https://humkin-long-wave.joyvolcanomusic.workers.dev/hls/live.m3u8",
                TowerLive.stream("station-one"));
    }
    @Test public void secondaryStationUsesItsOwnFrequencyPrefix(){
        assertEquals("https://humkin-long-wave.joyvolcanomusic.workers.dev/hls/talk/live.m3u8",
                TowerLive.stream("talk"));
    }
    @Test public void invalidFrequencyNeverBecomesAnArbitraryUrl(){
        assertNull(TowerLive.stream(null));
        assertNull(TowerLive.stream("../private"));
        assertNull(TowerLive.stream("Station One"));
        assertNull(TowerLive.stream("talk?token=secret"));
        assertNull(TowerLive.stream(""));
    }
}
