package org.abundent.humkinradio;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;

/**
 * THE GRAFT: combine two real owner-published songs into an A→B listening tape.
 * A tape is a PLAYABLE QUEUE, not a virtual collectible or claimed rebroadcast.
 * No network, balance, XP, file creation or playback occurs in this pure class.
 */
final class GraftTape {
    private GraftTape() {}

    static final class Tape {
        final String firstId,secondId,firstTitle,secondTitle,fingerprint;
        Tape(PirateSelector.Song first,PirateSelector.Song second) {
            firstId=first.id;secondId=second.id;
            firstTitle=first.title;secondTitle=second.title;
            fingerprint=fingerprint(firstId,secondId);
        }
        String title(){return firstTitle+"  →  "+secondTitle;}
    }

    static Tape compose(List<PirateSelector.Song> approved,String firstId,String secondId) {
        if(approved==null || firstId==null || secondId==null || firstId.equals(secondId))return null;
        PirateSelector.Song first=null,second=null;
        Set<String> seen=new HashSet<>();
        for(PirateSelector.Song song:approved) {
            if(song==null || song.id==null || !seen.add(song.id))continue;
            if(song.id.equals(firstId))first=song;
            if(song.id.equals(secondId))second=song;
        }
        if(first==null || second==null ||
                !firstId.matches("[a-zA-Z0-9:_-]{3,110}") ||
                !secondId.matches("[a-zA-Z0-9:_-]{3,110}"))return null;
        return new Tape(first,second);
    }

    /** Favor a genuine new pairing from different albums or eras when available.
     * Explicit human action and entropy only; never fabricate a source record.
     */
    static Tape surprise(List<PirateSelector.Song> approved,String preferred,long entropy) {
        if(approved==null)return null;
        List<PirateSelector.Song> unique=new ArrayList<>();
        Set<String> ids=new HashSet<>();
        for(PirateSelector.Song song:approved) {
            if(song!=null && song.id!=null && song.id.matches("[a-zA-Z0-9:_-]{3,110}")
                    && ids.add(song.id))unique.add(song);
        }
        if(unique.size()<2)return null;
        Collections.sort(unique,Comparator.comparing(s->s.id));
        Random random=new Random(entropy);
        PirateSelector.Song first=null;
        if(preferred!=null)for(PirateSelector.Song song:unique)
            if(song.id.equals(preferred)){first=song;break;}
        if(first==null)first=unique.get(random.nextInt(unique.size()));

        List<PirateSelector.Song> alternates=new ArrayList<>();
        int best=-1;
        for(PirateSelector.Song song:unique) {
            if(song.id.equals(first.id))continue;
            int score=(song.released!=first.released?3:0)+
                    (!song.album.equals(first.album)?2:0)+
                    (song.newEra!=first.newEra?1:0);
            if(score>best){best=score;alternates.clear();}
            if(score==best)alternates.add(song);
        }
        if(alternates.isEmpty())return null;
        return new Tape(first,alternates.get(random.nextInt(alternates.size())));
    }

    static String fingerprint(String a,String b) {
        try {
            MessageDigest hash=MessageDigest.getInstance("SHA-256");
            byte[] bytes=hash.digest(("humkin-graft/v1|"+a+"|"+b).getBytes(StandardCharsets.UTF_8));
            StringBuilder sb=new StringBuilder();
            for(byte x:bytes)sb.append(String.format(java.util.Locale.ROOT,"%02x",x&255));
            return sb.toString();
        }catch(Exception impossible){throw new IllegalStateException("SHA-256 unavailable",impossible);}
    }
}
