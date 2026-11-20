package org.abundent.humkinradio;

import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Small private device-only bookmark for a radio that should not feel like
 * it starts over whenever Android kills/recreates the playback service.
 *
 * We store IDs, never trusted URLs. On restoration the app must resolve each
 * ID against the current published RadioCatalog. Same-Time Radio always tunes
 * from its shared clock on a cold start; this bookmark is for Road Shuffle.
 */
final class PlaybackContinuity {
    static final String KEY = "playback-checkpoint";
    static final long MAX_RESUME_AGE_MS = 45L * 60L * 1000L;
    static final long MAX_SOFT_PAUSE_MS = 5L * 60L * 1000L;
    static final int MAX_QUEUE_IDS = 120;

    static final class Saved {
        final String mode, currentId;
        final long savedAtMs, positionMs;
        final boolean wasPlaying;
        final List<String> remainingIds;

        Saved(String mode, String currentId, long savedAtMs,
              long positionMs, boolean wasPlaying, List<String> remainingIds) {
            this.mode = mode;
            this.currentId = currentId;
            this.savedAtMs = savedAtMs;
            this.positionMs = positionMs;
            this.wasPlaying = wasPlaying;
            this.remainingIds = Collections.unmodifiableList(new ArrayList<>(remainingIds));
        }

        boolean canResumeShuffle(long nowMs) {
            return "shuffle".equals(mode)
                    && savedAtMs > 0 && nowMs >= savedAtMs
                    && nowMs - savedAtMs <= MAX_RESUME_AGE_MS
                    && !currentId.isEmpty()
                    && !remainingIds.isEmpty()
                    && currentId.equals(remainingIds.get(0));
        }

        String lastTrackIfRecent(long nowMs) {
            return savedAtMs > 0 && savedAtMs <= nowMs
                    && nowMs - savedAtMs < FreshRotation.HOUR_MS
                    ? currentId : "";
        }
    }

    static Saved read(SharedPreferences pref) {
        try {
            JSONObject json = new JSONObject(pref.getString(KEY, "{}"));
            JSONArray ids = json.optJSONArray("remaining");
            List<String> remaining = new ArrayList<>();
            if (ids != null) for (int i = 0; i < ids.length() && i < MAX_QUEUE_IDS; i++) {
                String id = ids.optString(i, "");
                if (!id.isEmpty() && id.length() <= 160) remaining.add(id);
            }
            return new Saved(json.optString("mode", ""),
                    json.optString("current", ""),
                    json.optLong("at", 0L),
                    Math.max(0L, json.optLong("position", 0L)),
                    json.optBoolean("playing", false), remaining);
        } catch (Exception ignored) {
            return new Saved("", "", 0L, 0L, false, Collections.emptyList());
        }
    }

    static void save(SharedPreferences pref, Saved snapshot) {
        try {
            JSONArray arr = new JSONArray();
            for (int i = 0; i < snapshot.remainingIds.size() && i < MAX_QUEUE_IDS; i++)
                arr.put(snapshot.remainingIds.get(i));
            JSONObject json = new JSONObject()
                    .put("mode", snapshot.mode)
                    .put("current", snapshot.currentId)
                    .put("at", snapshot.savedAtMs)
                    .put("position", snapshot.positionMs)
                    .put("playing", snapshot.wasPlaying)
                    .put("remaining", arr);
            pref.edit().putString(KEY, json.toString()).apply();
        } catch (Exception ignored) {
            // Bookmarks must never interrupt playback.
        }
    }

    private PlaybackContinuity() {}
}
