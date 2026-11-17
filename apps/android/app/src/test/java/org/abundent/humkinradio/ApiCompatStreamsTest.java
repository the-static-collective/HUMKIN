package org.abundent.humkinradio;

import static org.junit.Assert.*;
import org.junit.Test;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.io.IOException;

public final class ApiCompatStreamsTest {
    @Test public void returnsShortResponse() throws IOException {
        assertArrayEquals(new byte[]{1,2,3},
            ApiCompatStreams.readAtMost(new ByteArrayInputStream(new byte[]{1,2,3}),12000));
    }
    @Test public void stopsExactlyAtLimit() throws IOException {
        byte[] large=new byte[50000];
        for(int i=0;i<large.length;i++)large[i]=(byte)(i%231);
        byte[] data=ApiCompatStreams.readAtMost(new ByteArrayInputStream(large),12000);
        assertEquals(12000,data.length);
        assertEquals(large[11999],data[11999]);
    }
    @Test public void emptyAndZeroLimit() throws IOException {
        assertEquals(0,ApiCompatStreams.readAtMost(new ByteArrayInputStream(new byte[0]),12000).length);
        assertEquals(0,ApiCompatStreams.readAtMost(new ByteArrayInputStream(new byte[]{2,4}),0).length);
    }
    @Test public void worksWithSingleByteReads() throws IOException {
        InputStream source=new ByteArrayInputStream(new byte[]{5,6,7,8}){
            @Override public synchronized int read(byte[] b,int off,int len) {
                return 0;
            }
        };
        assertArrayEquals(new byte[]{5,6,7},ApiCompatStreams.readAtMost(source,3));
    }
    @Test(expected=IllegalArgumentException.class)
    public void rejectsNegativeLimit() throws IOException {
        ApiCompatStreams.readAtMost(new ByteArrayInputStream(new byte[]{1}),-1);
    }
}
