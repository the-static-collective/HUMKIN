package org.abundent.humkinradio;

import android.content.Context;
import android.content.SharedPreferences;
import java.io.PrintWriter;
import java.io.StringWriter;

/**
 * Private, opt-in diagnostic note for a real phone crash.
 * Does NOT upload exceptions, device IDs or song history. A person can
 * explicitly copy a bounded stack trace through the Radio's ⋯ menu.
 */
final class HumCrashNote {
    private static final String FILE="humkin-crash-note-v1";
    private static boolean installed=false;
    private HumCrashNote(){}

    static synchronized void install(Context context) {
        if(installed)return;
        installed=true;
        final Context app=context.getApplicationContext();
        final Thread.UncaughtExceptionHandler prior=Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread,cause)->{
            try {
                StringWriter buffer=new StringWriter();
                cause.printStackTrace(new PrintWriter(buffer));
                String stack=buffer.toString();
                if(stack.length()>6000)stack=stack.substring(0,6000);
                SharedPreferences p=app.getSharedPreferences(FILE,Context.MODE_PRIVATE);
                p.edit().putString("stack",stack)
                    .putLong("at",System.currentTimeMillis()).commit();
            }catch(Throwable ignored){/* Always leave OS crash handling intact. */}
            if(prior!=null)prior.uncaughtException(thread,cause);
            else android.os.Process.killProcess(android.os.Process.myPid());
        });
    }
    static String report(Context c){
        return c.getApplicationContext().getSharedPreferences(FILE,Context.MODE_PRIVATE)
                .getString("stack","");
    }
    static void clear(Context c){
        c.getApplicationContext().getSharedPreferences(FILE,Context.MODE_PRIVATE)
                .edit().remove("stack").apply();
    }
}
