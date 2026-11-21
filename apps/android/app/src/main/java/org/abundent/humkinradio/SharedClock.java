package org.abundent.humkinradio;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Exact Java port of the ordinary shared-clock sequence in fm/radio.js
 * (seededShuffle + autodj insertBumpers). A common catalog and epoch are
 * essential: this is a shared browser-style clock, NOT a hosted transmitter.
 */
final class SharedClock {
    static final class Cue {
        final int trackIndex;
        final long positionMs;
        final long cycle;
        final int slot;
        Cue(int trackIndex, long positionMs, long cycle, int slot) {
            this.trackIndex=trackIndex;this.positionMs=positionMs;
            this.cycle=cycle;this.slot=slot;
        }
    }

    private final List<Long> durations;
    private final List<Integer> songs;
    private final List<Integer> bumpers;
    private final int cadence;
    private final long epochMs;
    private final long cycleMs;

    SharedClock(List<Long> durations, List<Integer> songs,
                List<Integer> bumpers, int cadence, long epochMs) {
        this.durations=new ArrayList<>(durations);
        this.songs=new ArrayList<>(songs);
        this.bumpers=new ArrayList<>(bumpers);
        this.cadence=cadence>=1&&cadence<=20?cadence:0;
        this.epochMs=epochMs;
        long length=0;
        for (int i : insertBumpers(songs, bumpers, this.cadence)) {
            length+=this.durations.get(i);
        }
        this.cycleMs=length;
    }

    long cycleMs() {return cycleMs;}

    static List<Integer> insertBumpers(List<Integer> songs, List<Integer> bumpers, int cadence) {
        List<Integer> result=new ArrayList<>();
        int n=0;
        for (Integer song : songs) {
            result.add(song);
            n++;
            if (cadence>=1&&cadence<=20&&!bumpers.isEmpty()&&n%cadence==0) {
                result.add(bumpers.get((n/cadence-1)%bumpers.size()));
            }
        }
        return result;
    }

    static List<Integer> seededShuffle(List<Integer> initial, long cycle) {
        // Java 32-bit overflow/unsigned shifts reproduce browser JS bitwise
        // operations, including Math.imul and converting a long cycle to int.
        List<Integer> order=new ArrayList<>(initial);
        int state=((int)cycle)^0x9e3779b9;
        for (int i=order.size()-1;i>0;i--) {
            state+=0x6d2b79f5;
            int x=state;
            x=(x^(x>>>15))*(x|1);
            x^=x+(x^(x>>>7))*(x|61);
            long value=(x^(x>>>14))&0xffffffffL;
            int j=(int)((value*(i+1L))>>>32);
            Collections.swap(order,i,j);
        }
        return order;
    }

    List<Integer> sequence(long cycle) {
        return insertBumpers(seededShuffle(songs,cycle),bumpers,cadence);
    }

    Cue at(long stationNowMs) {
        if (cycleMs<=0||songs.isEmpty()) throw new IllegalStateException("No station clock");
        long elapsed=Math.max(0,stationNowMs-epochMs);
        long cycle=elapsed/cycleMs;
        long position=elapsed%cycleMs;
        List<Integer> order=sequence(cycle);
        long sum=0;
        for (int i=0;i<order.size();i++) {
            int track=order.get(i);
            long end=sum+durations.get(track);
            if(position<end) return new Cue(track,position-sum,cycle,i);
            sum=end;
        }
        return new Cue(order.get(0),0,cycle,0);
    }
}
