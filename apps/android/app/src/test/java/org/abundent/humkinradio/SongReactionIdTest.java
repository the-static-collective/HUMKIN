package org.abundent.humkinradio;

import org.junit.Test;
import static org.junit.Assert.*;

public final class SongReactionIdTest {
    @Test public void mapsAlbumItemToRealStationId() {
        assertEquals("mutant-pop-01",SongReactionId.canonical("album:mutant-pop:1"));
        assertEquals("mutant-pop-12",SongReactionId.canonical("album:mutant-pop:12"));
        assertEquals("everywhere-near-you-07",SongReactionId.canonical("album:everywhere-near-you:7"));
        assertEquals("crate-abcde",SongReactionId.canonical("crate-abcde"));
    }
    @Test public void refusesUnknownOrNonSongIDs() {
        assertNull(SongReactionId.canonical(null));
        assertNull(SongReactionId.canonical("album:mutant-pop:0"));
        assertNull(SongReactionId.canonical("album:mutant-pop:13"));
        assertNull(SongReactionId.canonical("album:everywhere-near-you:9"));
        assertNull(SongReactionId.canonical("album:unknown:1"));
        assertNull(SongReactionId.canonical("field-fm-001"));
        assertNull(SongReactionId.canonical("bumper-002"));
        assertNull(SongReactionId.canonical("a?admin=1"));
        assertNull(SongReactionId.canonical("https://example.org"));
    }
    @Test public void reactionLanguageIsHumanAndCapped() {
        assertEquals(6,SongReactions.CODES.length);
        assertEquals("hope",SongReactions.codeAt(0));
        assertEquals("stayed",SongReactions.codeAt(5));
        assertNull(SongReactions.codeAt(6));
        assertTrue(SongReactions.valid("tears"));
        assertFalse(SongReactions.valid("like"));
        assertTrue(SongReactions.phrase("seen").contains("less alone"));
    }
}
