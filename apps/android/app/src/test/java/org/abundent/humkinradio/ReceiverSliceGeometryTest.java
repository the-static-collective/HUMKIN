package org.abundent.humkinradio;

import org.junit.Test;
import static org.junit.Assert.*;

public final class ReceiverSliceGeometryTest {
    @Test public void originalPortraitIsUnchanged(){
        assertEquals(0f,ReceiverSliceGeometry.expansion(864,1536),.001f);
        for(float y:new float[]{0,175,505,681,752,1200,1536})
            assertEquals(y,ReceiverSliceGeometry.mapY(y,0f),.001f);
    }
    @Test public void tallPhoneFillsWholeInstrumentNotPlainBottom(){
        float extra=ReceiverSliceGeometry.expansion(432,911);
        assertEquals(286f,extra,.001f);
        assertEquals(1536f+extra,ReceiverSliceGeometry.mapY(1536f,extra),.001f);
        assertEquals(681f,ReceiverSliceGeometry.mapY(680f,extra)+1f,.001f);
        assertTrue(ReceiverSliceGeometry.mapY(700f,extra)>700f);
        assertTrue(ReceiverSliceGeometry.mapY(1220f,extra)>ReceiverSliceGeometry.mapY(950f,extra));
    }
    @Test public void eachHardwareBandKeepsItsPhysicalHeight(){
        float e=270f;
        assertEquals(180f,
            ReceiverSliceGeometry.mapY(950f,e)-ReceiverSliceGeometry.mapY(770f,e),.001f);
        assertEquals(120f,
            ReceiverSliceGeometry.mapY(1160f,e)-ReceiverSliceGeometry.mapY(1040f,e),.001f);
        assertEquals(145f,
            ReceiverSliceGeometry.mapY(1350f,e)-ReceiverSliceGeometry.mapY(1205f,e),.001f);
    }
    @Test public void allocationTotalsHundredPercent(){
        float value=241.25f,sum=0f;
        for(int i=0;i<ReceiverSliceGeometry.SHARE.length;i++)
            sum+=ReceiverSliceGeometry.insert(i,value);
        assertEquals(value,sum,.001f);
    }
    @Test public void shortAndLandscapeDoNotSquash(){
        assertEquals(0f,ReceiverSliceGeometry.expansion(864,700),.001f);
        assertEquals(0f,ReceiverSliceGeometry.expansion(0,200),.001f);
    }
}
