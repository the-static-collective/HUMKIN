package org.abundent.humkinradio;

import org.junit.Test;
import java.util.Arrays;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import static org.junit.Assert.*;

public final class FreshRotationTest {
    @Test public void oldAndNewRecordsStillJumbleButRecentOnesWait() {
        long now = 2_000_000_000L;
        List<String> ids = Arrays.asList("new", "2000s", "old", "earlier", "other");
        List<Integer> order = new ArrayList<>(Arrays.asList(0, 3, 2, 1, 4));
        Map<String,Long> played = new HashMap<>();
        played.put("new",now-1000);
        played.put("old",now-120000);
        played.put("earlier",now-9000000);
        FreshRotation.preferFresh(order,ids,played,now);
        assertEquals(Arrays.asList(3,1,4,2,0),order);
    }
    @Test public void emptyMemoryPreservesRandomShuffle() {
        List<Integer> order = new ArrayList<>(Arrays.asList(2,0,1));
        FreshRotation.preferFresh(order,Arrays.asList("a","b","c"),
                new HashMap<>(),System.currentTimeMillis());
        assertEquals(Arrays.asList(2,0,1),order);
    }
    @Test public void whenEverythingIsRecentLeastRecentlyHeardGoesFirst() {
        long now = 4_000_000L;
        List<Integer> order = new ArrayList<>(Arrays.asList(2,0,1));
        Map<String,Long> played = new HashMap<>();
        played.put("a",now-5000);
        played.put("b",now-7000);
        played.put("c",now-1000);
        FreshRotation.preferFresh(order,Arrays.asList("a","b","c"),played,now);
        assertEquals(Arrays.asList(1,0,2),order);
    }
}
