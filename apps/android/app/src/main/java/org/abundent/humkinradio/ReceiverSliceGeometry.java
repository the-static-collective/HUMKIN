package org.abundent.humkinradio;

/**
 * Structural band map for the 864×1536 HUMKIN instrument illustration.
 *
 * Objects and screws remain pixel-proportional; only the navy enamel between
 * hardware modules expands. Expansion is allocated proportionally across
 * three quiet body seams. Rendering and hitboxes must use the same transform.
 */
final class ReceiverSliceGeometry {
    static final float WIDTH=864f, HEIGHT=1536f;
    static final int[] SEAMS={681,1197,1369};
    static final float[] SHARE={.35f,.42f,.23f};

    private ReceiverSliceGeometry(){}

    static float expansion(int renderedWidth,int renderedHeight){
        if(renderedWidth<=0||renderedHeight<=0)return 0f;
        return Math.max(0f,renderedHeight*(WIDTH/(float)renderedWidth)-HEIGHT);
    }
    static float insert(int seam,float expansion){
        return Math.max(0f,expansion)*SHARE[seam];
    }
    static float mapY(float original,float expansion){
        float result=original;
        for(int i=0;i<SEAMS.length;i++){
            if(original>=SEAMS[i])result+=insert(i,expansion);
        }
        return result;
    }
    static float shiftBefore(float original,float expansion){
        return mapY(original,expansion)-original;
    }
}
