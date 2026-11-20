package org.abundent.humkinradio;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Fetch public, release-approved covers on a background worker.
 * Bundled known covers remain instant/offline. Never load unknown hosts,
 * private content, or an unbounded full-resolution image into the UI.
 */
final class AlbumCoverLoader {
    private AlbumCoverLoader() {}
    private static final int MAX_BYTES=4_000_000;

    static Bitmap fetch(String address) throws IOException {
        URL url=new URL(address);
        String path=url.getPath();
        if(!"https".equals(url.getProtocol()) ||
                !"humkin.abundent.org".equals(url.getHost()) ||
                url.getUserInfo()!=null || url.getQuery()!=null || url.getRef()!=null ||
                !path.startsWith("/releases/") ||
                !(path.endsWith("/cover.jpg") || path.endsWith("/cover.jpeg") ||
                        path.endsWith("/cover.png") || path.endsWith("/cover.webp")))
            throw new IOException("Untrusted album artwork");
        HttpURLConnection c=(HttpURLConnection)url.openConnection();
        c.setConnectTimeout(9000);c.setReadTimeout(9000);
        c.setInstanceFollowRedirects(false);
        try{
            if(c.getResponseCode()!=200)throw new IOException("Cover not published");
            if(c.getContentLengthLong()>MAX_BYTES)throw new IOException("Cover too large");
            byte[] bytes;
            try(InputStream stream=c.getInputStream();ByteArrayOutputStream data=new ByteArrayOutputStream()){
                byte[] buffer=new byte[8192];int read;
                while((read=stream.read(buffer))!=-1){
                    if(data.size()+read>MAX_BYTES)throw new IOException("Cover too large");
                    data.write(buffer,0,read);
                }
                bytes=data.toByteArray();
            }
            BitmapFactory.Options bounds=new BitmapFactory.Options();
            bounds.inJustDecodeBounds=true;
            BitmapFactory.decodeByteArray(bytes,0,bytes.length,bounds);
            if(bounds.outWidth<1 || bounds.outHeight<1)throw new IOException("Invalid cover");
            BitmapFactory.Options scaled=new BitmapFactory.Options();
            scaled.inSampleSize=1;
            while(Math.max(bounds.outWidth,bounds.outHeight)/scaled.inSampleSize>640)
                scaled.inSampleSize*=2;
            Bitmap bitmap=BitmapFactory.decodeByteArray(bytes,0,bytes.length,scaled);
            if(bitmap==null)throw new IOException("Cannot decode cover");
            return bitmap;
        }finally{c.disconnect();}
    }
}
