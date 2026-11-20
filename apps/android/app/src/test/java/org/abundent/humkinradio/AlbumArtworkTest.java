package org.abundent.humkinradio;

import org.junit.Test;
import static org.junit.Assert.*;

/** Regression: the approved website albums, never concept/mockup art. */
public final class AlbumArtworkTest {
    @Test public void publishedReleasesUseTheirOriginalBundledCovers() {
        assertEquals(R.drawable.album_mutant_pop, AlbumArtwork.forAlbum("MUTANT POP"));
        assertEquals(R.drawable.album_mutant_pop, AlbumArtwork.forAlbum("mutant-pop"));
        assertEquals(R.drawable.album_everywhere_near_you,
                AlbumArtwork.forAlbum("everywhere;near you"));
        assertEquals(R.drawable.album_everywhere_near_you,
                AlbumArtwork.forAlbum("everywhere-near-you"));
    }

    @Test public void unconfirmedReleasesDoNotInventAnAlbumCover() {
        assertEquals(R.drawable.ic_radio, AlbumArtwork.forAlbum("Warmth"));
        assertEquals(R.drawable.ic_radio, AlbumArtwork.forAlbum("HUMKIN RADIO · Singles"));
        assertEquals(R.drawable.ic_radio, AlbumArtwork.forAlbum(null));
    }
}
