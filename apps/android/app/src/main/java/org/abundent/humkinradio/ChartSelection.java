package org.abundent.humkinradio;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

/** Optional, bounded daily chart airtime; chart does not own the station. */
final class ChartSelection {
    private ChartSelection() {}
    static List<Integer> bonus(List<Integer> base,List<Long> durations,
                               List<Integer> ranked,String stationDay) {
        if (base.isEmpty() || ranked.isEmpty()) return Collections.emptyList();
        long musicMs=0L;
        for(int id:base)musicMs+=durations.get(id);
        long targetMs=Math.round(musicMs*7.0/93.0);
        Random rnd=new Random(0x42a1e42L^(stationDay==null?0:stationDay.hashCode()));
        List<List<Integer>> tiers=new ArrayList<>();
        tiers.add(new ArrayList<>(ranked.subList(0,Math.min(7,ranked.size()))));
        tiers.add(new ArrayList<>(ranked.subList(Math.min(7,ranked.size()),Math.min(21,ranked.size()))));
        tiers.add(new ArrayList<>(ranked.subList(Math.min(21,ranked.size()),Math.min(42,ranked.size()))));
        for (List<Integer> tier:tiers)Collections.shuffle(tier,rnd);
        Map<Integer,Integer> used=new HashMap<>();
        List<Integer> extras=new ArrayList<>();
        long granted=0;
        int limit=(int)Math.ceil(base.size()*0.12);
        for (int attempt=0;granted<targetMs&&extras.size()<limit&&attempt<limit*14;attempt++) {
            double roll=rnd.nextDouble();
            int wanted=roll<.35?0:roll<.70?1:2;
            Integer chosen=null;
            List<Integer> chosenTier=null;
            for(int offset=0;offset<3;offset++){
                List<Integer> tier=tiers.get((wanted+offset)%3);
                for(Integer id:tier){
                    if(used.getOrDefault(id,0)<2){chosen=id;chosenTier=tier;break;}
                }
                if(chosen!=null)break;
            }
            if(chosen==null)break;
            extras.add(chosen);
            granted+=durations.get(chosen);
            used.put(chosen,used.getOrDefault(chosen,0)+1);
            chosenTier.remove(chosen);
            chosenTier.add(chosen);
        }
        return extras;
    }
}
