package org.abundent.humkinradio;

import static org.junit.Assert.*;

import org.junit.Test;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/** Evidence-first music pairing rules, without fake time or reward simulation. */
public final class GraftTapeTest {
    private PirateSelector.Song song(String id,String name,String album,boolean released){
        return new PirateSelector.Song(id,name,album,released,false);
    }
    private List<PirateSelector.Song> songs(){
        return Arrays.asList(
                song("static-old-a","Old A","Weathered Acetates",false),
                song("album-new-b","New B","Tomorrow's Songs",true),
                song("static-old-c","Old C","Weathered Acetates",false));
    }
    @Test public void actualTwoSongsMakeAStableIdentifiableQueue(){
        GraftTape.Tape tape=GraftTape.compose(songs(),"static-old-a","album-new-b");
        assertNotNull(tape);
        assertEquals("Old A  →  New B",tape.title());
        assertEquals("static-old-a",tape.firstId);
        assertEquals("album-new-b",tape.secondId);
        assertEquals(64,tape.fingerprint.length());
        assertEquals(tape.fingerprint,GraftTape.fingerprint("static-old-a","album-new-b"));
        assertNotEquals(tape.fingerprint,GraftTape.fingerprint("album-new-b","static-old-a"));
    }
    @Test public void sameSongOrNonPublishedRecordIsNotComposable(){
        assertNull(GraftTape.compose(songs(),"static-old-a","static-old-a"));
        assertNull(GraftTape.compose(songs(),"static-old-a","draft-private-record"));
        assertNull(GraftTape.compose(songs(),"draft-private-record","static-old-a"));
        assertNull(GraftTape.compose(Collections.emptyList(),"a","b"));
        assertNull(GraftTape.compose(null,"a","b"));
    }
    @Test public void surprisingGraftNeverDuplicatesAndPreservesAudibleSeed(){
        List<PirateSelector.Song> approved=songs();
        for(int i=0;i<120;i++){
            GraftTape.Tape tape=GraftTape.surprise(approved,"static-old-a",i*1337L);
            assertNotNull(tape);
            assertEquals("static-old-a",tape.firstId);
            assertEquals("album-new-b",tape.secondId);
        }
    }
    @Test public void shortCatalogCannotFakeMoreRecords(){
        assertNull(GraftTape.surprise(Collections.emptyList(),"not-available",3));
        assertNull(GraftTape.surprise(Collections.singletonList(
                song("static-only","Only","Only Album",true)),"static-only",3));
        List<PirateSelector.Song> duplicates=Arrays.asList(
                song("static-only","Only","Only Album",true),
                song("static-only","Fake duplicate","Only Album",true));
        assertNull(GraftTape.surprise(duplicates,null,14));
    }
    @Test public void reorderingIsARealNewArrangementNotARewardMint(){
        GraftTape.Tape a=GraftTape.compose(songs(),"static-old-a","album-new-b");
        GraftTape.Tape b=GraftTape.compose(songs(),"album-new-b","static-old-a");
        assertNotNull(a);assertNotNull(b);
        assertNotEquals(a.title(),b.title());
        assertNotEquals(a.fingerprint,b.fingerprint);
    }
}
