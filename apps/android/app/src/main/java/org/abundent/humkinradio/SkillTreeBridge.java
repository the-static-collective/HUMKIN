package org.abundent.humkinradio;

import android.content.Context;
import android.content.res.AssetManager;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Read-only boundary to the existing native Outpost. Shared slices are
 * packaged as Android assets from the same Git tree that the web reads.
 * No new balance, save file, network request, or player action is introduced.
 */
final class SkillTreeBridge {
    private static volatile SkillTreeKernel.Tree cached;
    private SkillTreeBridge(){}

    private static String readBounded(AssetManager assets,String path) throws IOException {
        if (!path.equals("catalog.json") && !path.matches("slices/[a-z0-9_-]+\\.json")) {
            throw new IOException("Untrusted skill slice path");
        }
        try(InputStream in=assets.open(path);
            ByteArrayOutputStream out=new ByteArrayOutputStream()){
            byte[] bytes=new byte[2048];
            int total=0,count;
            while((count=in.read(bytes))!=-1){
                total+=count;
                if(total>65536)throw new IOException("Skill slice exceeds size limit");
                out.write(bytes,0,count);
            }
            return new String(out.toByteArray(),StandardCharsets.UTF_8);
        }
    }

    static SkillTreeKernel.Tree load(Context context) throws IOException,JSONException {
        SkillTreeKernel.Tree result=cached;
        if(result!=null)return result;
        synchronized(SkillTreeBridge.class){
            if(cached!=null)return cached;
            AssetManager assets=context.getApplicationContext().getAssets();
            JSONObject manifest=new JSONObject(readBounded(assets,"catalog.json"));
            JSONArray names=manifest.getJSONArray("slices");
            Map<String,JSONObject> slices=new LinkedHashMap<>();
            for(int i=0;i<names.length();i++){
                String name=names.getString(i);
                slices.put(name,new JSONObject(readBounded(assets,name)));
            }
            cached=SkillTreeKernel.compile(manifest,slices);
            return cached;
        }
    }

    /** A snapshot of existing, audible-playback-backed Outpost facts only.
     * External signed candidates are NOT silently admitted by this bridge.
     */
    static SkillTreeKernel.Projection current(Context context) throws IOException,JSONException {
        SignalRpg.Snapshot s=SignalRpg.snapshot(context);
        Map<String,Integer> facts=new HashMap<>();
        facts.put("level",s.level);
        facts.put("module_tower",s.tower);
        facts.put("module_archive",s.archive);
        facts.put("module_crew",s.crew);
        facts.put("discovered",s.discovered);
        return SkillTreeKernel.project(load(context),facts,Collections.emptySet());
    }
}
