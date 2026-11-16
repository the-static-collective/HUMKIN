package org.abundent.humkinradio;
import org.junit.Test;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import static org.junit.Assert.*;

public class SignalFeaturesTest {
 @Test public void unlocksAreConcreteAndNoRoadmapDoorIsFake(){
   for(SignalFeatures.Door door:SignalFeatures.DOORS){
     assertFalse(SignalFeatures.unlocked(door,0,0,0));
     if(door.implemented){
       int[] ranks={0,0,0};ranks[door.module]=door.tier;
       assertTrue(door.title,SignalFeatures.unlocked(door,ranks[0],ranks[1],ranks[2]));
       ranks[door.module]=door.tier-1;
       assertFalse(door.title,SignalFeatures.unlocked(door,ranks[0],ranks[1],ranks[2]));
     }else{
       assertFalse(door.title,SignalFeatures.unlocked(door,9,9,9));
     }
   }
 }
 @Test public void moduleTierOpensSpecificAbilities(){
   assertEquals("radar",SignalFeatures.justUnlocked(0,0,1).get(0).id);
   assertEquals("beacon",SignalFeatures.justUnlocked(0,1,2).get(0).id);
   assertEquals("crate",SignalFeatures.justUnlocked(1,0,1).get(0).id);
   assertEquals("press",SignalFeatures.justUnlocked(1,1,2).get(0).id);
   assertEquals("challenge",SignalFeatures.justUnlocked(2,0,1).get(0).id);
   assertEquals("bulletin",SignalFeatures.justUnlocked(2,1,2).get(0).id);
   assertEquals(0,SignalFeatures.justUnlocked(2,3,4).size());
 }
 @Test public void scoutPressNeverInventsARecordingOrWrongQuota(){
   List<SignalFeatures.Song> all=Arrays.asList(
     t("radio-a",false,0),t("radio-b",false,2),
     t("radio-c",false,0),t("radio-d",false,8),
     t("radio-e",false,0),t("radio-f",false,1),
     t("album-a",true,3),t("album-b",true,0),
     t("album-c",true,0));
   Set<String> watched=new HashSet<>(Arrays.asList("radio-d","album-a"));
   List<SignalFeatures.Song> draft=SignalFeatures.proposeEp(all,watched,0);
   assertEquals(6,draft.size());
   assertEquals(4,draft.stream().filter(x->!x.released).count());
   assertEquals(2,draft.stream().filter(x->x.released).count());
   assertEquals(6,new HashSet<>(Arrays.asList(draft.get(0).id,draft.get(1).id,draft.get(2).id,
     draft.get(3).id,draft.get(4).id,draft.get(5).id)).size());
   assertEquals("radio-d",draft.get(0).id);
   assertEquals("album-a",draft.get(4).id);
   assertTrue(SignalFeatures.proposeEp(all,watched,1).size()==6);
   assertTrue(SignalFeatures.proposeEp(Arrays.asList(t("a",false,0)),watched,0).isEmpty());
 }
 private static SignalFeatures.Song t(String id,boolean released,int plays){
   return new SignalFeatures.Song(id,id,"HUMKIN",released,plays,0,plays);
 }
}