package org.abundent.humkinradio;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Capability graph: buying a station upgrade opens an actual interaction.
 * The three station modules remain about production, but now have explicit
 * participant affordances; deeper proposed doors are visibly NOT shipped.
 */
final class SignalFeatures {
    private SignalFeatures() {}

    static final class Door {
        final String id,title,description;
        final int module,tier;
        final boolean implemented;
        Door(String id,String title,String description,int module,int tier,boolean implemented){
            this.id=id;this.title=title;this.description=description;
            this.module=module;this.tier=tier;this.implemented=implemented;
        }
    }
    static final Door[] DOORS={
        new Door("radar","CHART RADAR","Actual daily Top 42 readings and overlooked sleepers.",0,1,true),
        new Door("beacon","REQUEST BEACON","Nominate one real song for today's public Request Desk.",0,2,true),
        new Door("frequency","COMMUNITY FREQUENCIES","Future: dedicated listener-programmed radio windows.",0,4,false),
        new Door("crate","THE SCOUT'S CRATE","Save the recordings you believe deserve another hearing.",1,1,true),
        new Door("press","THE LITTLE PRESS","Compose a valid six-track EP from your discoveries.",1,2,true),
        new Door("trade","RECORD TRADING POST","Future: exchange listener-created compilations.",1,4,false),
        new Door("challenge","FIELD CHALLENGES","Send friends real song-discovery challenges.",2,1,true),
        new Door("bulletin","THE NIGHT EDITOR","Write a shareable station bulletin using actual charts.",2,2,true),
        new Door("relay","CO-OP RELAY STATIONS","Future: listener crews with shared expedition goals.",2,4,false)
    };
    static boolean unlocked(Door door,int tower,int archive,int crew){
        if(!door.implemented)return false;
        return (door.module==0?tower:door.module==1?archive:crew)>=door.tier;
    }
    static Door byId(String id){
        for(Door door:DOORS)if(door.id.equals(id))return door;
        return null;
    }
    static int required(String id){
        Door door=byId(id);
        return door==null?-1:door.tier;
    }
    static int[] moduleLevels(int tower,int archive,int crew){
        return new int[]{tower,archive,crew};
    }
    static List<Door> justUnlocked(int module,int before,int after){
        List<Door> result=new ArrayList<>();
        for(Door door:DOORS)
            if(door.module==module&&door.implemented&&
               door.tier>before&&door.tier<=after)result.add(door);
        return result;
    }
    static final class Song {
        final String id,title,album;
        final boolean released;
        final int plays,radio,playlist;
        Song(String id,String title,String album,boolean released,int plays,int radio,int playlist){
            this.id=id;this.title=title;this.album=album;this.released=released;
            this.plays=plays;this.radio=radio;this.playlist=playlist;
        }
    }
    /**
     * The proposal is always 4 radio-only + 2 released, never a forged
     * public record. It is only a seed for the existing editable builder.
     * Watchlisted tracks go first; then truly overlooked eligible songs.
     */
    static List<Song> proposeEp(List<Song> catalog,Set<String> watched,int variation) {
        List<Song> radio=new ArrayList<>(),releases=new ArrayList<>();
        Set<String> seen=new HashSet<>();
        for(Song song:catalog){
            if(song==null||song.id==null||!seen.add(song.id))continue;
            if(song.released)releases.add(song);
            else radio.add(song);
        }
        Comparator<Song> rank=(a,b)->{
            int wa=watched.contains(a.id)?0:1, wb=watched.contains(b.id)?0:1;
            if(wa!=wb)return Integer.compare(wa,wb);
            if(a.plays!=b.plays)return Integer.compare(a.plays,b.plays);
            return a.id.compareTo(b.id);
        };
        Collections.sort(radio,rank);
        Collections.sort(releases,rank);
        if(radio.size()<4||releases.size()<2)return Collections.emptyList();
        int offset=Math.max(0,variation);
        List<Song> result=new ArrayList<>();
        for(int i=0;i<4;i++)result.add(radio.get((offset+i)%radio.size()));
        for(int i=0;i<2;i++)result.add(releases.get((offset+i)%releases.size()));
        return result;
    }
}
