package org.abundent.humkinradio;

import org.junit.Test;
import static org.junit.Assert.*;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Pure JVM selection logic; never depends on network, Android UI or scoring. */
public final class PirateSelectorTest {
    private static List<PirateSelector.Song> crate(int n){
        List<PirateSelector.Song> rows=new ArrayList<>();
        for(int i=0;i<n;i++)rows.add(new PirateSelector.Song(
            "crate-"+i,"Track "+i,"Radio",i%4==0,i%2==0));
        return rows;
    }
    @Test public void foundingSongAndPublishedRosterOnly(){
        List<PirateSelector.Song> rows=crate(72);
        List<String> ids=PirateSelector.order(rows,"hope",PirateSelector.BOTH,
            "crate-10",new HashMap<>(),new HashMap<>(),new HashSet<>(),241L);
        assertEquals(72,ids.size());
        assertEquals("crate-10",ids.get(0));
        assertEquals(72,new HashSet<>(ids).size());
        assertFalse(ids.contains("crate-999"));
    }
    @Test public void personalResponsesActuallyMatter(){
        List<PirateSelector.Song> rows=crate(30);
        Map<String,String> mine=new HashMap<>();
        mine.put("crate-11","hope");
        int closeToFront=0;
        for(int seed=1;seed<=100;seed++){
            List<String> order=PirateSelector.order(rows,"hope",PirateSelector.ME,
                null,mine,new HashMap<>(),new HashSet<>(),seed);
            if(order.indexOf("crate-11")<10)closeToFront++;
        }
        assertTrue("My declared hope should raise its chance, not guarantee it",closeToFront>55);
    }
    @Test public void communityResponsesActuallyMatter(){
        List<PirateSelector.Song> rows=crate(30);
        Map<String,PirateSelector.Weather> crowd=new HashMap<>();
        Map<String,Integer> values=new HashMap<>();values.put("seen",30);
        crowd.put("crate-11",new PirateSelector.Weather(30,values));
        int seenNearFront=0,without=0;
        for(int seed=1;seed<=100;seed++){
            List<String> signal=PirateSelector.order(rows,"seen",PirateSelector.EVERYBODY,
                null,new HashMap<>(),crowd,new HashSet<>(),seed);
            List<String> baseline=PirateSelector.order(rows,"seen",PirateSelector.EVERYBODY,
                null,new HashMap<>(),new HashMap<>(),new HashSet<>(),seed);
            if(signal.indexOf("crate-11")<10)seenNearFront++;
            if(baseline.indexOf("crate-11")<10)without++;
        }
        assertTrue("Crowd is meaningful, but not a winner-take-all mandate",
            seenNearFront>without);
        assertTrue("The unsignalled recordings are still present",
            PirateSelector.order(rows,"seen",PirateSelector.EVERYBODY,
                null,new HashMap<>(),crowd,new HashSet<>(),15).contains("crate-13"));
    }
    @Test public void oldNewAreInterleavedWherePossible(){
        List<PirateSelector.Song> rows=crate(50);
        List<String> order=PirateSelector.order(rows,"open",PirateSelector.BOTH,
            null,new HashMap<>(),new HashMap<>(),new HashSet<>(),55);
        int run=1;
        for(int i=1;i<order.size();i++){
            boolean next=Integer.parseInt(order.get(i).substring(6))%2==0;
            boolean prev=Integer.parseInt(order.get(i-1).substring(6))%2==0;
            run=next==prev?run+1:1;
            assertTrue("Too many consecutive songs from one era",run<=3);
        }
    }
    @Test public void unavailableMoodFallsBackRatherThanFilteringEverything(){
        List<String> ids=PirateSelector.order(crate(12),"NOT A MOOD",PirateSelector.BOTH,
            "crate-999",new HashMap<>(),new HashMap<>(),new HashSet<>(),1);
        assertEquals(12,ids.size());
        assertFalse(PirateSelector.validMood("like"));
        assertTrue(PirateSelector.validMood("tears"));
    }
}
