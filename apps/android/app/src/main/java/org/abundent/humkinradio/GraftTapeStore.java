package org.abundent.humkinradio;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * Local log of successful Media3 queue changes only.
 * This is not proof of audible listening, a signed execution, HUM, an
 * NFT, a global broadcast, or a verified cross-machine contribution.
 */
final class GraftTapeStore {
    private static final String FILE="humkin-graft-tapes-v1";
    private GraftTapeStore(){}

    static final class Snapshot {
        final String firstId,secondId,fingerprint;
        final int queuedCount;
        Snapshot(SharedPreferences p){
            firstId=p.getString("first","");
            secondId=p.getString("second","");
            fingerprint=p.getString("fingerprint","");
            queuedCount=Math.max(0,p.getInt("queued_count",0));
        }
        boolean hasTape(){return !firstId.isEmpty()&&!secondId.isEmpty();}
    }

    static Snapshot snapshot(Context context){
        return new Snapshot(context.getApplicationContext()
                .getSharedPreferences(FILE,Context.MODE_PRIVATE));
    }

    /** Caller must independently establish an accepted native Media3 queue. */
    static synchronized int recordQueueChanged(Context context,GraftTape.Tape tape){
        if(tape==null)return snapshot(context).queuedCount;
        SharedPreferences p=context.getApplicationContext()
                .getSharedPreferences(FILE,Context.MODE_PRIVATE);
        int count=p.getInt("queued_count",0);
        count=Math.min(1_000_000,count+1);
        p.edit().putString("first",tape.firstId)
                .putString("second",tape.secondId)
                .putString("fingerprint",tape.fingerprint)
                .putInt("queued_count",count)
                .apply();
        return count;
    }
}
