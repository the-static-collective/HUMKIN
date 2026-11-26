package org.abundent.humkinradio;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Rect;
import android.graphics.RectF;
import android.view.View;

/**
 * Multiband nine-patch-inspired chassis for the user-approved illustrated radio.
 *
 * The original stays unmodified: A/B/C/D fixed bands are copied 1:1 in source
 * coordinates. Three INSERTS expand between the major hardware sections.
 * Each insert repeats a cloned enamel texture whose left/right rail pixels
 * come from the original edge, while the center is a seeded, low-contrast
 * inpaint of original blue enamel. NOTHING (dials, screws, letterforms, buttons)
 * is vertically stretched or duplicated in the expansion strips.
 */
final class SlicedReceiverSkin extends View {
    private static final int W=864, H=1536, TILE_H=96;
    private static final int RAIL=23;
    private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG|Paint.FILTER_BITMAP_FLAG);
    private final Bitmap source;
    private final Bitmap[] blueGaskets=new Bitmap[ReceiverSliceGeometry.SEAMS.length];
    private final Rect srcRect=new Rect();
    private final RectF destRect=new RectF();

    SlicedReceiverSkin(Context context) {
        super(context);
        source=BitmapFactory.decodeResource(getResources(),R.drawable.living_receiver_face);
        if(source==null)throw new IllegalStateException("Missing HUMKIN receiver chassis artwork");
        for(int i=0;i<blueGaskets.length;i++)
            blueGaskets[i]=makeGasket(ReceiverSliceGeometry.SEAMS[i]);
        setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);
    }

    private static int between(int value,int lo,int hi){
        return Math.max(lo,Math.min(hi,value));
    }
    private static boolean enamel(int pixel){
        int r=Color.red(pixel),g=Color.green(pixel),b=Color.blue(pixel);
        return b>r*1.25f&&b>g*1.12f&&r<78&&g<105;
    }
    /**
     * Reconstruct a repeatable enamel spacer from genuine photo samples.
     * The outer 23px rails are cloned separately, preserving the worn
     * physical rim; the wide center samples only navy pixels (never printed
     * lightning, numbers, metal or album art), with seeded small grain.
     */
    private Bitmap makeGasket(int sourceSeam){
        Bitmap tile=Bitmap.createBitmap(W,TILE_H,Bitmap.Config.ARGB_8888);
        int[] row=new int[W];
        source.getPixels(row,0,W,0,sourceSeam,W,1);
        int count=0,red=0,green=0,blue=0;
        for(int x=RAIL;x<W-RAIL;x++){
            if(enamel(row[x])){
                red+=Color.red(row[x]);green+=Color.green(row[x]);blue+=Color.blue(row[x]);
                count++;
            }
        }
        final int avgR=count>0?red/count:10;
        final int avgG=count>0?green/count:31;
        final int avgB=count>0?blue/count:55;
        int[] pixels=new int[W*TILE_H];
        for(int y=0;y<TILE_H;y++){
            for(int x=0;x<W;x++){
                if(x<RAIL||x>=W-RAIL){
                    // Keep this exact edge of the original radio continuous.
                    // This genuinely tiles vertically, including its scuffs.
                    int oldY=between(710+(y*2)%165,0,source.getHeight()-1);
                    pixels[y*W+x]=source.getPixel(x,oldY);
                    continue;
                }
                int here=row[x];
                float r=avgR,g=avgG,b=avgB;
                if(enamel(here)){
                    r=.72f*Color.red(here)+.28f*avgR;
                    g=.72f*Color.green(here)+.28f*avgG;
                    b=.72f*Color.blue(here)+.28f*avgB;
                }
                int sx=(30+(x*7+y*19)%(W-60));
                int sy=400+((y*11+x*3)%280);
                int sample=source.getPixel(sx,sy);
                if(enamel(sample)){
                    r=.85f*r+.15f*Color.red(sample);
                    g=.85f*g+.15f*Color.green(sample);
                    b=.85f*b+.15f*Color.blue(sample);
                }
                int grain=((((x*7349+y*9151+sourceSeam*7133)^(x*y*193))&31)-15);
                r+=grain*.126f;g+=grain*.18f;b+=grain*.198f;
                pixels[y*W+x]=Color.rgb(between(Math.round(r),0,255),
                    between(Math.round(g),0,255),between(Math.round(b),0,255));
            }
        }
        tile.setPixels(pixels,0,W,0,0,W,TILE_H);
        return tile;
    }
    private void drawFixed(Canvas canvas,int top,int bottom,float shift){
        if(bottom<=top)return;
        srcRect.set(0,top,W,bottom);
        destRect.set(0,top+shift,W,bottom+shift);
        canvas.drawBitmap(source,srcRect,destRect,paint);
    }
    private void drawExpansion(Canvas canvas,Bitmap tile,float top,float length){
        if(length<=0f)return;
        float written=0f;
        while(written<length-.001f){
            float span=Math.min(TILE_H,length-written);
            srcRect.set(0,0,W,Math.max(1,Math.min(TILE_H,(int)Math.ceil(span))));
            destRect.set(0,top+written,W,top+written+span);
            canvas.drawBitmap(tile,srcRect,destRect,paint);
            written+=span;
        }
    }
    @Override protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        if(getWidth()<=0||getHeight()<=0)return;
        final float factor=getWidth()/ReceiverSliceGeometry.WIDTH;
        float available=ReceiverSliceGeometry.expansion(getWidth(),getHeight());
        canvas.save();
        canvas.scale(factor,factor);
        int previous=0;
        float shifted=0f;
        for(int i=0;i<ReceiverSliceGeometry.SEAMS.length;i++){
            int seam=ReceiverSliceGeometry.SEAMS[i];
            drawFixed(canvas,previous,seam,shifted);
            float added=ReceiverSliceGeometry.insert(i,available);
            drawExpansion(canvas,blueGaskets[i],seam+shifted,added);
            shifted+=added;
            previous=seam;
        }
        drawFixed(canvas,previous,H,shifted);
        canvas.restore();
    }

    @Override protected void onDetachedFromWindow(){
        super.onDetachedFromWindow();
        // Drawables are retained while this View exists; no off-main-thread
        // jobs or per-frame bitmap allocations.
    }
}
