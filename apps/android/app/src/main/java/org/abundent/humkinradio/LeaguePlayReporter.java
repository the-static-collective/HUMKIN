package org.abundent.humkinradio;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONObject;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/** Sends only a random local listener key, public track ID and qualified seconds.
 * A no-login, best-effort station signal. Never blocks Media3 or stores an email.
 * Server hashes the random key before persisting a provisional point.
 */
final class LeaguePlayReporter {
    private static final String ENDPOINT =
            "https://kbhqacsdvjsstzyplqij.supabase.co/functions/v1/humkin-league";
    private LeaguePlayReporter() {}

    static void report(Context context,String id,long seconds) {
        if (id == null || !id.matches("[a-zA-Z0-9-]{3,90}") || seconds < 30L) return;
        try {
            SharedPreferences settings=context.getSharedPreferences("humkin-radio",Context.MODE_PRIVATE);
            String key=settings.getString("league-listener-v1","");
            if (!key.matches("[0-9a-fA-F-]{36}")) {
                key=UUID.randomUUID().toString();
                settings.edit().putString("league-listener-v1",key).apply();
            }
            JSONObject body=new JSONObject();
            body.put("action","play");
            body.put("source","radio");
            body.put("track_id",id);
            body.put("seconds",seconds);
            body.put("listener",key);
            byte[] bytes=body.toString().getBytes(StandardCharsets.UTF_8);
            HttpURLConnection conn=(HttpURLConnection)new URL(ENDPOINT).openConnection();
            try {
                conn.setRequestMethod("POST");
                conn.setConnectTimeout(4500);
                conn.setReadTimeout(4500);
                conn.setDoOutput(true);
                conn.setRequestProperty("Content-Type","application/json");
                conn.setFixedLengthStreamingMode(bytes.length);
                try(OutputStream out=conn.getOutputStream()) {out.write(bytes);}
                // A rate-limited or offline backend must never interrupt audio.
                conn.getResponseCode();
            } finally {conn.disconnect();}
        } catch (Exception ignored) {
            // Playback success never depends on leaderboard availability.
        }
    }
}
