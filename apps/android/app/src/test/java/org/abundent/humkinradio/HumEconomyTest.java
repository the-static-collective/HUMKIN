package org.abundent.humkinradio;

import static org.junit.Assert.*;
import org.junit.Test;

/** Independent rules for audible-time rewards and public media redemption. */
public final class HumEconomyTest {
    @Test public void firstTenMinutesYieldThreeWithNoRepeatedClaims() {
        assertEquals(0,HumEconomy.newAwards(0,9*60_000L));
        assertEquals(3,HumEconomy.newAwards(0,10*60_000L));
        int mask=HumEconomy.newMask(0,10*60_000L);
        assertEquals(0,HumEconomy.newAwards(mask,12*60_000L));
        assertEquals(1,HumEconomy.newAwards(mask,30*60_000L));
    }
    @Test public void allMilestonesSumToSixAndCannotRepeat() {
        assertEquals(6,HumEconomy.newAwards(0,99*60_000L));
        assertEquals(15,HumEconomy.newMask(0,99*60_000L));
        assertEquals(0,HumEconomy.newAwards(15,400*60_000L));
        assertEquals(1,HumEconomy.newAwards(7,80*60_000L));
        assertEquals(6,HumEconomy.MAX_DAILY_LISTEN_HUM);
    }
    @Test public void currentSinglesCostTwoAndOrdinaryTracksOne() {
        assertEquals(1,HumEconomy.price(false));
        assertEquals(2,HumEconomy.price(true));
    }
    @Test public void knownPublishedUrlsOnly() {
        assertTrue(HumEconomy.approvedAudio(
            "https://humkin.abundent.org/releases/everywhere-near-you/audio/01.mp3"));
        assertTrue(HumEconomy.approvedAudio(
            "https://kbhqacsdvjsstzyplqij.supabase.co/storage/v1/object/public/humkin-radio-live/"+
            "12345678-1234-1234-1234-123456789012/"+
            "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899.mp3"));
        assertFalse(HumEconomy.approvedAudio("http://humkin.abundent.org/a.mp3"));
        assertFalse(HumEconomy.approvedAudio("https://evil.example/a.mp3"));
        assertFalse(HumEconomy.approvedAudio("https://humkin.abundent.org/a.mp3?token=secret"));
        assertFalse(HumEconomy.approvedAudio("https://humkin.abundent.org/../hidden.mp3"));
        assertFalse(HumEconomy.approvedAudio("https://kbhqacsdvjsstzyplqij.supabase.co/storage/v1/object/sign/private/secret.mp3"));
    }
    @Test public void canonicalSongIdsDoNotBecomeBumperOrLibraryCurrency() {
        assertNull(HumEconomy.canonicalId("bumper-001"));
        assertNull(HumEconomy.canonicalId("field-fm-002"));
        assertNull(HumEconomy.canonicalId("library:mutant-pop-01"));
        assertEquals("mutant-pop-01",HumEconomy.canonicalId("album:mutant-pop:1"));
        assertEquals("album:future-release:1",HumEconomy.canonicalId("album:future-release:1"));
    }
}
