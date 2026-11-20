package org.abundent.humkinradio;

import org.junit.Test;
import static org.junit.Assert.*;

/** Regression: R2 migration removed every old Supabase LIVE object. */
public final class RadioSourceUrlTest {
    private static final String ID="720778a0-f76f-46d4-b139-8f4eb90dd096";
    private static final String OWNER="e0b5228c-818c-431b-9bb4-08a289d52751";
    private static final String HASH="3b9e287699f677833ccc463cb3b33b56739a1f4c952b1d24ebf6bd51c577ffdb";

    @Test public void migratedRecordPlaysFromCloudflareNotDeletedSupabase(){
        String url=RadioSourceUrl.published("r2",OWNER+"/"+HASH+".mp3",
                "tracks/"+ID+"/"+HASH+".mp3");
        assertEquals("https://media.abundent.org/tracks/"+ID+"/"+HASH+".mp3",url);
        assertFalse(url.contains("humkin-radio-live"));
    }

    @Test public void existingSupabaseRecordStillSupported(){
        assertEquals("https://kbhqacsdvjsstzyplqij.supabase.co/storage/v1/object/public/humkin-radio-live/"
                +OWNER+"/"+HASH+".mp3",
                RadioSourceUrl.published("supabase",OWNER+"/"+HASH+".mp3",null));
        // Older catalog rows without provider still behave as legacy.
        assertNotNull(RadioSourceUrl.published("",OWNER+"/"+HASH+".mp3",null));
    }

    @Test public void badR2PathMustNotFallBackToDeletedSupabase(){
        assertNull(RadioSourceUrl.published("r2",OWNER+"/"+HASH+".mp3",null));
        assertNull(RadioSourceUrl.published("r2",OWNER+"/"+HASH+".mp3","../../secret.mp3"));
        assertNull(RadioSourceUrl.published("r2",OWNER+"/"+HASH+".mp3","https://evil.example/file.mp3"));
        assertNull(RadioSourceUrl.published("other",OWNER+"/"+HASH+".mp3",null));
    }

    @Test public void reviewedSeasonalR2TrackHasEncodedSource(){
        assertEquals("https://media.abundent.org/tracks/Blue%20At%20The%20Tip.mp3",
                RadioSourceUrl.approvedManifestObject("tracks/Blue At The Tip.mp3"));
        assertNull(RadioSourceUrl.approvedManifestObject("tracks/../private.mp3"));
        assertNull(RadioSourceUrl.approvedManifestObject("tracks/name?bad.mp3"));
        assertNull(RadioSourceUrl.approvedManifestObject("https://untrusted.example/tracks.mp3"));
    }
}
