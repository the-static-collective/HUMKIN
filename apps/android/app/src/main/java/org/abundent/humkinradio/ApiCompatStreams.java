package org.abundent.humkinradio;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;

/** Read bounded network responses using APIs available on Android 8+.
 * InputStream.readNBytes(int) is NOT on Android 11's core-oj.jar and throws
 * an uncaught NoSuchMethodError (an Error, not an Exception).
 */
final class ApiCompatStreams {
    private ApiCompatStreams() {}

    static byte[] readAtMost(InputStream in, int limit) throws IOException {
        if(in == null) throw new IOException("Missing response stream");
        if(limit < 0) throw new IllegalArgumentException("Negative byte limit");
        ByteArrayOutputStream out=new ByteArrayOutputStream(Math.min(limit,4096));
        byte[] block=new byte[2048];
        int total=0;
        while(total<limit) {
            int count=in.read(block,0,Math.min(block.length,limit-total));
            if(count<0)break;
            if(count==0){
                int single=in.read();
                if(single<0)break;
                out.write(single);
                total++;
            }else{
                out.write(block,0,count);
                total+=count;
            }
        }
        return out.toByteArray();
    }
}
