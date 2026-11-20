package org.abundent.humkinradio;

import org.junit.Test;
import java.util.List;
import static org.junit.Assert.*;

/** Release shelf order and publication gate; never require an internet request. */
public final class AlbumCatalogTest {
    private static String entry(String id,String title,String status) {
        String prefix="mutant-pop".equals(id)?"/":"/releases/"+id+"/";
        return "{\"id\":\""+id+"\",\"title\":\""+title+"\",\"detail\":\"Listening\","
                +"\"status\":\""+status+"\",\"manifest\":\""+prefix+"tracks.json\","
                +"\"cover\":\""+prefix+"cover.jpg\",\"page\":\""+prefix+"\"}";
    }
    private static String index(String items) {
        return "{\"version\":1,\"albums\":["+items+"]}";
    }

    @Test public void newestPublishedFirstAndPlayablePaths() throws Exception {
        List<AlbumCatalog.Album> albums=AlbumCatalog.parsePublished(index(
                entry("next-release","New Album","published")+","+
                entry("everywhere-near-you","everywhere;near you","published")));
        assertEquals(2,albums.size());
        assertEquals("next-release",albums.get(0).id);
        assertEquals("https://humkin.abundent.org/releases/next-release/tracks.json",
                albums.get(0).manifestUrl);
        assertEquals("everywhere;near you",albums.get(1).title);
    }

    @Test public void draftsNeverAppearInPublicShelf() throws Exception {
        List<AlbumCatalog.Album> albums=AlbumCatalog.parsePublished(index(
                entry("not-yet","Unreleased","draft")+","+
                entry("mutant-pop","MUTANT POP","published")));
        assertEquals(1,albums.size());
        assertEquals("mutant-pop",albums.get(0).id);
    }

    @Test public void emptyOrAllDraftIndexDoesNotEraseBuiltInShelf() {
        assertThrows(Exception.class,()->AlbumCatalog.parsePublished(index(
                entry("secret","Secret","draft"))));
        assertEquals("everywhere-near-you",AlbumCatalog.builtIn().get(0).id);
        assertEquals(2,AlbumCatalog.builtIn().size());
    }

    @Test public void rejectsCrossReleasePathsAndDuplicateIds() {
        String changed=entry("next-release","New Album","published")
                .replace("/releases/next-release/cover.jpg", "/releases/other/cover.jpg");
        assertThrows(Exception.class,()->AlbumCatalog.parsePublished(index(changed)));
        String repeat=entry("next-release","New Album","published");
        assertThrows(Exception.class,()->AlbumCatalog.parsePublished(index(repeat+","+repeat)));
    }
}
