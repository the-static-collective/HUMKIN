package org.abundent.humkinradio;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** Actual unencrypted MP3s in the phone's Music/HUMKIN collection.
 * No DRM, timed license, private application media format or login dependency. */
final class MusicLibrary {
    private static final long MAX_BYTES=90L*1024*1024;
    private MusicLibrary(){}

    static boolean exists(Context context,String uriText) {
        if(uriText==null||uriText.isEmpty())return false;
        try{
            Uri uri=Uri.parse(uriText);
            if("file".equals(uri.getScheme()))
                return uri.getPath()!=null&&new File(uri.getPath()).isFile();
            try(android.os.ParcelFileDescriptor fd=context.getContentResolver()
                    .openFileDescriptor(uri,"r")){return fd!=null;}
        }catch(Exception ignored){return false;}
    }

    private static String filename(HumWallet.Record record){
        String readable=record.title.replaceAll("[^\\p{L}\\p{N} ._-]"," ")
                .replaceAll(" +"," ").trim();
        if(readable.isEmpty())readable="HUMKIN";
        if(readable.length()>72)readable=readable.substring(0,72);
        return readable+" - "+record.id.replace(':','-')+".mp3";
    }

    /** Do not execute this on the main/UI thread. */
    static Uri download(Context context,HumWallet.Record record) throws Exception {
        if(record==null||!HumEconomy.approvedAudio(record.audioUrl))
            throw new IllegalArgumentException("Not an approved public HUMKIN MP3");
        HttpURLConnection connection=(HttpURLConnection)new URL(record.audioUrl).openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(16000);
        connection.setRequestProperty("Accept","audio/mpeg,application/octet-stream");
        Uri target=null;
        File legacy=null;
        try{
            if(connection.getResponseCode()!=200)
                throw new java.io.IOException("The published recording is unavailable");
            long declared=connection.getContentLengthLong();
            if(declared>MAX_BYTES)throw new java.io.IOException("Recording exceeds 90 MB");
            ContentResolver resolver=context.getContentResolver();
            if(Build.VERSION.SDK_INT>=29){
                ContentValues values=new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME,filename(record));
                values.put(MediaStore.MediaColumns.MIME_TYPE,"audio/mpeg");
                values.put(MediaStore.MediaColumns.RELATIVE_PATH,
                        Environment.DIRECTORY_MUSIC+"/HUMKIN/");
                values.put(MediaStore.MediaColumns.IS_PENDING,1);
                target=resolver.insert(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,values);
                if(target==null)throw new java.io.IOException("Couldn't open shared music storage");
            } else {
                File dir=new File(context.getExternalFilesDir(Environment.DIRECTORY_MUSIC),"HUMKIN");
                if(!dir.exists()&&!dir.mkdirs())throw new java.io.IOException("Music folder unavailable");
                legacy=new File(dir,filename(record));
                target=Uri.fromFile(legacy);
            }
            long total=0;
            try(InputStream in=connection.getInputStream();
                OutputStream out=legacy!=null?new FileOutputStream(legacy):
                    resolver.openOutputStream(target,"w")){
                if(out==null)throw new java.io.IOException("Can't write song");
                byte[] buf=new byte[32768];int n;
                while((n=in.read(buf))!=-1){
                    total+=n;
                    if(total>MAX_BYTES)throw new java.io.IOException("Song exceeds 90 MB");
                    out.write(buf,0,n);
                }
                out.flush();
            }
            if(total<1024)throw new java.io.IOException("Recording is incomplete");
            if(Build.VERSION.SDK_INT>=29){
                ContentValues finish=new ContentValues();
                finish.put(MediaStore.MediaColumns.IS_PENDING,0);
                if(resolver.update(target,finish,null,null)<1)
                    throw new java.io.IOException("Couldn't finish saving song");
            }
            return target;
        }catch(Exception e){
            if(legacy!=null)legacy.delete();
            else if(target!=null)try{context.getContentResolver().delete(target,null,null);}
                                  catch(Exception ignored){}
            throw e;
        }finally{connection.disconnect();}
    }

    static boolean delete(Context context,String uriText){
        if(uriText==null||uriText.isEmpty())return true;
        Uri uri=Uri.parse(uriText);
        try {
            if("file".equals(uri.getScheme())) {
                File file=new File(uri.getPath());
                return !file.exists()||file.delete();
            }
            return context.getContentResolver().delete(uri,null,null)>0 ||
                   !exists(context,uriText);
        }catch(Exception ignored){return false;}
    }
}
