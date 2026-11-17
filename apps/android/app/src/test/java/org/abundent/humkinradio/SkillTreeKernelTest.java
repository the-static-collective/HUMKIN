package org.abundent.humkinradio;

import static org.junit.Assert.*;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/** Native JVM parity proof for the same exact JSON the browser kernel loads. */
public final class SkillTreeKernelTest {
    private static final Path ROOT=Paths.get("../../../game/skill-tree/v1");

    private static JSONObject load(String path) throws Exception {
        return new JSONObject(new String(Files.readAllBytes(ROOT.resolve(path)),StandardCharsets.UTF_8));
    }
    private static SkillTreeKernel.Tree tree() throws Exception {
        JSONObject catalog=load("catalog.json");
        JSONArray names=catalog.getJSONArray("slices");
        Map<String,JSONObject> parts=new LinkedHashMap<>();
        for(int i=0;i<names.length();i++) {
            String name=names.getString(i);
            parts.put(name,load(name));
        }
        return SkillTreeKernel.compile(catalog,parts);
    }
    private static Map<String,Integer> facts(int level,int tower,int archive,int crew) {
        Map<String,Integer> values=new HashMap<>();
        values.put("level",level);
        values.put("module_tower",tower);
        values.put("module_archive",archive);
        values.put("module_crew",crew);
        return values;
    }
    private static SkillTreeKernel.Projection evaluate(int level,int tower,int archive,int crew)
            throws Exception {
        return SkillTreeKernel.project(tree(),facts(level,tower,archive,crew),Collections.emptySet());
    }
    @Test public void brandNewListenerIsNotSpoiledByDeeperWorlds() throws Exception {
        SkillTreeKernel.Projection p=evaluate(1,0,0,0);
        assertEquals("AVAILABLE",p.get("radio.receiver").status);
        assertEquals("AVAILABLE",p.get("radio.outpost").status);
        assertEquals("LOCKED",p.get("outpost.orchard").status);
        assertEquals("HIDDEN",p.get("outpost.bootleg").status);
        assertEquals("HIDDEN",p.get("world.jubilee").status);
        assertEquals("HELD",p.get("radio.weather").status);
        assertNull(p.get("radio.weather").capability);
        for (SkillTreeKernel.State item:p.visible)
            assertNotEquals("world.jubilee",item.id);
    }
    @Test public void orchardAndBootlegExactlyMatchExistingMilestones() throws Exception {
        for(int level=1;level<=15;level++) {
            SkillTreeKernel.Projection p=evaluate(level,0,0,0);
            assertEquals(OutpostMilestones.unlocked(OutpostMilestones.ORCHARD,level),
                    "AVAILABLE".equals(p.get("outpost.orchard").status));
            assertEquals(level>=4, "AVAILABLE".equals(p.get("orchard.graft").status));
            assertEquals(OutpostMilestones.unlocked(OutpostMilestones.BOOTLEG,level),
                    "AVAILABLE".equals(p.get("outpost.bootleg").status));
        }
    }
    @Test public void threeIndependentSpecialtiesPreserveExistingTierRequirements() throws Exception {
        SkillTreeKernel.Projection p=evaluate(4,2,1,0);
        assertEquals("AVAILABLE",p.get("outpost.antenna.beacon").status);
        assertEquals("AVAILABLE",p.get("outpost.archive").status);
        assertEquals("LOCKED",p.get("outpost.archive.press").status);
        assertEquals("LOCKED",p.get("outpost.crew").status);
    }
    @Test public void forgedAdmissionsDoNotEnablePilotOrPlannedActions() throws Exception {
        Set<String> fake=new HashSet<>();
        fake.add("humkin.orchard.network.owner-admit.v1");
        fake.add("humkin.frequency.relay.owner-admit.v1");
        fake.add("relatte.humkin.world.owner-admit.v1");
        SkillTreeKernel.Projection p=SkillTreeKernel.project(tree(),facts(99,9,9,9),fake);
        for(String id:new String[]{"orchard.network","frequency.relay","world.junction","radio.weather"}) {
            assertEquals("HELD",p.get(id).status);
            assertNull(p.get(id).capability);
        }
        for(String id:new String[]{"outpost.antenna.community","outpost.archive.trade","outpost.crew.relay"}) {
            assertEquals("PLANNED",p.get(id).status);
            assertNull(p.get(id).capability);
        }
        assertEquals("HIDDEN",p.get("world.webz").status);
    }
    @Test public void badParentFailsClosed() throws Exception {
        JSONObject catalog=load("catalog.json");
        Map<String,JSONObject> sources=new LinkedHashMap<>();
        JSONArray names=catalog.getJSONArray("slices");
        for(int i=0;i<names.length();i++){
            String name=names.getString(i);
            sources.put(name,load(name));
        }
        sources.get("slices/orchard.json").getJSONArray("nodes").getJSONObject(0)
                .put("parent","unrecognized.branch");
        try {
            SkillTreeKernel.compile(catalog,sources);
            fail("Unknown parent must fail");
        }catch(IllegalArgumentException expected){
            assertTrue(expected.getMessage().contains("ORPHAN") ||
                    expected.getMessage().contains("CROSS_SLICE_PARENT"));
        }
    }
}
