package org.abundent.humkinradio;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;

/**
 * A pirate dial is a recommendation, not a popularity election.
 * Every published song remains eligible even with no Listener Weather data.
 * One seed, one mix of private responses and opt-in public aggregate weather.
 * No upload, score mutation, repeat votes or manufactured charts.
 */
final class PirateSelector {
    static final int ME=0, BOTH=1, EVERYBODY=2;
    static final String OPEN="open";
    static final String[] VIBES={"open","hope","tears","seen","laugh","move","stayed"};
    static final String[] NAMES={"Surprise me","Hope","Tears","Less alone","Laughter","Movement","Stays with me"};
    static final class Song {
        final String id,title,album;
        final boolean released,newEra;
        Song(String id,String title,String album,boolean released,boolean newEra){
            this.id=id;this.title=title;this.album=album;
            this.released=released;this.newEra=newEra;
        }
    }
    static final class Weather {
        final int total;
        final Map<String,Integer> feelings;
        Weather(int total,Map<String,Integer> feelings){
            this.total=Math.max(0,total);
            this.feelings=new HashMap<>(feelings);
        }
        int forMood(String mood){return Math.max(0,feelings.getOrDefault(mood,0));}
    }
    static final class Ranked {
        final Song song;
        final double key;
        Ranked(Song song,double key){this.song=song;this.key=key;}
    }
    static boolean validMood(String value){
        if(value==null)return false;
        for(String s:VIBES)if(s.equals(value))return true;
        return false;
    }
    static List<String> order(List<Song> songs,String vibe,int balance,
            String seed,Map<String,String> mine,Map<String,Weather> crowd,
            Set<String> recent,long entropy){
        final String mood=validMood(vibe)?vibe:OPEN;
        final int dial=Math.max(ME,Math.min(EVERYBODY,balance));
        Random random=new Random(entropy);
        String anchor=SongReactionId.canonical(seed);
        List<Ranked> ranked=new ArrayList<>();
        Set<String> known=new HashSet<>();
        for(Song s:songs){
            if(s.id==null || SongReactionId.canonical(s.id)==null || !known.add(s.id))continue;
            double weight=s.released?2.0:1.0; // Release/single priority, not votes.
            if(!OPEN.equals(mood)) {
                String personal=mine.get(s.id);
                if(personal!=null){
                    if(personal.equals(mood))weight*=dial==ME?6.0:dial==BOTH?4.0:1.35;
                    else if(dial==ME)weight*=0.7;
                }
                Weather observed=crowd.get(s.id);
                if(observed!=null && observed.total>0 && dial!=ME){
                    // Smoothed proportions with a cautious volume ramp.
                    // A song with 1 positive report never dominates 100+ tracks.
                    double p=observed.forMood(mood)/(observed.total+5.0);
                    double confidence=Math.log1p(Math.min(40,observed.total))/Math.log(41);
                    weight*=1.0+(dial==BOTH?2.8:5.0)*p*confidence;
                }
            } else if(dial!=EVERYBODY && mine.containsKey(s.id)) {
                weight*=1.8; // A remembered recording is interesting, not a win.
            }
            if(recent.contains(s.id) && !s.id.equals(anchor))weight*=0.12;
            double u=Math.max(1.0e-12,random.nextDouble());
            ranked.add(new Ranked(s,-Math.log(u)/Math.max(0.05,weight)));
        }
        Collections.sort(ranked,Comparator.comparingDouble(r->r.key));
        List<String> order=new ArrayList<>(ranked.size());
        // The founding song never disappears when the listener asks for it.
        if(anchor!=null&&known.contains(anchor))order.add(anchor);
        int lastEra=-1,run=0;
        while(order.size()<ranked.size()) {
            int pick=-1;
            for(int i=0;i<ranked.size();i++){
                Ranked r=ranked.get(i);
                if(order.contains(r.song.id))continue;
                int era=r.song.newEra?1:0;
                if(run>=2 && era==lastEra)continue;
                pick=i;break;
            }
            if(pick<0)for(int i=0;i<ranked.size();i++){
                if(!order.contains(ranked.get(i).song.id)){pick=i;break;}
            }
            if(pick<0)break;
            Ranked chosen=ranked.get(pick);
            int era=chosen.song.newEra?1:0;
            run=era==lastEra?run+1:1;
            lastEra=era;
            order.add(chosen.song.id);
        }
        return order;
    }
}
