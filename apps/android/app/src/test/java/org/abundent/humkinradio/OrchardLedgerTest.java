package org.abundent.humkinradio;

import org.junit.Test;
import static org.junit.Assert.*;
import java.util.HashSet;
import java.util.Set;

public class OrchardLedgerTest {
    @Test public void catalogHasThirtyAffordableProgressionOptions() {
        assertEquals(30,OrchardLedger.SHOP.length);
        Set<String> ids=new HashSet<>();
        for(OrchardLedger.Spec item:OrchardLedger.SHOP){
            assertTrue("duplicate id",ids.add(item.id));
            assertFalse(item.rare);
            assertTrue(item.price>0);
            assertTrue(item.level>=1);
            assertNotNull(item.lore);
            assertFalse(item.lore.isEmpty());
        }
        assertEquals(18,OrchardLedger.find("crooked-lamp").price);
        assertEquals(9,OrchardLedger.find("mystery-orchard").level);
    }
    @Test public void rareArtifactsAreNotShopPurchases() {
        assertEquals(9,OrchardLedger.RARE.length);
        Set<String> ids=new HashSet<>();
        for(OrchardLedger.Spec item:OrchardLedger.RARE){
            assertTrue(ids.add(item.id));
            assertTrue(item.rare);
            assertEquals(0,item.price);
            assertNotNull(OrchardLedger.find(item.id));
        }
        assertEquals("merit-spool",OrchardLedger.RARE[8].id);
        assertNull(OrchardLedger.find("invented-global-unique-serial"));
    }
    @Test public void earningThresholdsAreBasedOnActualMedia3Milliseconds(){
        assertEquals(18_000L,OrchardLedger.HUM_PULSE);
        assertEquals(240_000L,OrchardLedger.FIRST_FIND);
        assertEquals(720_000L,OrchardLedger.NEXT_FIND);
    }
}
