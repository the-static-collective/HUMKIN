package org.abundent.humkinradio;

import java.util.List;
import java.util.Map;

/** Local-first Road Shuffle freshness without ranking tracks by their release age.
 * Fresh songs retain their initial randomized order, so new and old recordings
 * remain mixed. Only tracks heard on this device during the past hour move back.
 */
final class FreshRotation {
    static final long HOUR_MS = 60 * 60 * 1000L;

    static void preferFresh(List<Integer> shuffledIndexes, List<String> ids,
                            Map<String, Long> lastHeard, long nowMs) {
        if (lastHeard.isEmpty()) return;
        // Collections.sort is stable: never disturb randomized order among
        // fresh songs. Recently played tracks go last, oldest first.
        shuffledIndexes.sort((a, b) -> {
            long seenA = lastHeard.getOrDefault(ids.get(a), 0L);
            long seenB = lastHeard.getOrDefault(ids.get(b), 0L);
            boolean freshA = isFresh(seenA, nowMs);
            boolean freshB = isFresh(seenB, nowMs);
            if (freshA != freshB) return freshA ? -1 : 1;
            if (!freshA) return Long.compare(seenA, seenB);
            return 0;
        });
    }

    private static boolean isFresh(long lastPlayMs, long nowMs) {
        return lastPlayMs <= 0 || nowMs < lastPlayMs
                || nowMs - lastPlayMs >= HOUR_MS;
    }
}
