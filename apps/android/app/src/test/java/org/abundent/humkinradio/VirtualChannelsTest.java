package org.abundent.humkinradio;

import org.junit.Test;
import static org.junit.Assert.*;

public final class VirtualChannelsTest {
    @Test public void onlyTheKnownVirtualHomeStationIsPlayable() {
        assertTrue(VirtualChannels.isPlayable(false,98.2f));
        assertTrue(VirtualChannels.isPlayable(false,98f));
        assertFalse(VirtualChannels.isPlayable(false,98.9f));
        assertFalse(VirtualChannels.isPlayable(false,101.2f));
        assertFalse(VirtualChannels.isPlayable(true,98.2f));
    }
    @Test public void tunerClampsAndRoundsPredictably() {
        assertEquals(88f,VirtualChannels.normalize(8f),.001f);
        assertEquals(108f,VirtualChannels.normalize(208f),.001f);
        assertEquals(98.2f,VirtualChannels.normalize(98.237f),.001f);
        assertEquals(98.2f,VirtualChannels.normalize(Float.NaN),.001f);
    }
    @Test public void unbuiltControlsDoNotMisstateCapability() {
        assertTrue(VirtualChannels.circuitMessage("BAND",98.2f,true).contains("not on the air"));
        assertTrue(VirtualChannels.circuitMessage("BOOST",98.2f,false).contains("genuine signal"));
        assertTrue(VirtualChannels.circuitMessage("DIAL",102.3f,false).contains("virtual FM"));
    }
}
