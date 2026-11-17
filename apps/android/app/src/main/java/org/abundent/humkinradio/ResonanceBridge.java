package org.abundent.humkinradio;

import android.content.Context;
import org.json.JSONObject;
import java.io.OutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Opt-in, anonymous provisional listener weather, completely outside Top42 plays. */
final class ResonanceBridge {
    private static final String ENDPOINT=
        "https://kbhqacsdvjsstzyplqij.supabase.co/functions/v1/humkin-resonance";
    private ResonanceBridge() {}
    static boolean submit(Context context,String track,String feeling) throws Exception {
        if(!SongReactions.valid(feeling)||SongReactionId.canonical(track)==null)
            throw new IllegalArgumentException("Unrecognized response");
        JSONObject body=new JSONObject()
            .put("action","react").put("track_id",track).put("feeling",feeling)
            .put("listener",LeagueBridge.listener(context));
        byte[] payload=body.toString().getBytes(StandardCharsets.UTF_8);
        HttpURLConnection connection=(HttpURLConnection)new URL(ENDPOINT).openConnection();
        try {
            connection.setConnectTimeout(4500);
            connection.setReadTimeout(6000);
            connection.setRequestMethod("POST");
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type","application/json");
            connection.setFixedLengthStreamingMode(payload.length);
            try(OutputStream stream=connection.getOutputStream()){stream.write(payload);}
            int status=connection.getResponseCode();
            if(status<200||status>=300)return false;
            try(InputStream stream=connection.getInputStream()){
                String reply=new String(ApiCompatStreams.readAtMost(stream,4096),StandardCharsets.UTF_8);
                return new JSONObject(reply).optBoolean("accepted");
            }
        }finally {connection.disconnect();}
    }
}
