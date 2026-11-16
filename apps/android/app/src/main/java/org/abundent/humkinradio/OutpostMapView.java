package org.abundent.humkinradio;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.view.View;

/**
 * Lightweight, original procedural outpost map. No permissions, microphone,
 * user images or canvas screenshot downloads. The pulse is decorative and
 * stops when paused, offscreen or reduced-motion settings disable animation.
 */
final class OutpostMapView extends View {
    private final Paint brush=new Paint(Paint.ANTI_ALIAS_FLAG);
    private int level=1;
    private boolean onAir=false;

    OutpostMapView(Context context){
        super(context);
        setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);
    }
    void update(int level,boolean playing) {
        boolean changed=this.level!=level||this.onAir!=playing;
        this.level=level;this.onAir=playing;
        if(changed)invalidate();
    }
    private int dp(float size){return HumkinVisuals.dp(getContext(),size);}
    private void color(int c,float stroke){
        brush.setColor(c);
        brush.setStyle(stroke==0?Paint.Style.FILL:Paint.Style.STROKE);
        if(stroke>0)brush.setStrokeWidth(dp(stroke));
        brush.setStrokeCap(Paint.Cap.ROUND);
        brush.setStrokeJoin(Paint.Join.ROUND);
    }
    @Override protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        final float w=getWidth(),h=getHeight();
        if(w<=0||h<=0)return;
        color(0xff211b39,0);
        canvas.drawRoundRect(0,0,w,h,dp(9),dp(9),brush);

        // A distant range of stations mapped as a handmade radio field.
        color(0xff4d486f,1f);
        for(int k=0;k<4;k++){
            float radius=Math.min(w,h)*(.23f+k*.16f);
            canvas.drawCircle(w*.51f,h*.62f,radius,brush);
        }
        for(int i=0;i<21;i++){
            int seed=(i*557+43);
            float x=(seed%101)/101f*w;
            float y=((seed*31)%103)/103f*h*.70f;
            color(i%3==0?0xffffdc70:0xff998dab,0);
            canvas.drawCircle(x,y,dp(i%6==0?1.8f:.8f),brush);
        }

        // Uneven, moonlit roofline.
        Path skyline=new Path();
        skyline.moveTo(0,h*.85f);
        skyline.lineTo(w*.12f,h*.78f);
        skyline.lineTo(w*.21f,h*.82f);
        skyline.lineTo(w*.32f,h*.75f);
        skyline.lineTo(w*.41f,h*.80f);
        skyline.lineTo(w*.66f,h*.76f);
        skyline.lineTo(w*.72f,h*.82f);
        skyline.lineTo(w*.84f,h*.70f);
        skyline.lineTo(w,h*.79f);
        skyline.lineTo(w,h);
        skyline.lineTo(0,h);
        skyline.close();
        color(0xff393457,0);
        canvas.drawPath(skyline,brush);

        float x=w*.51f,top=h*.34f,bottom=h*.86f;
        // Coils + tall, creaking tower.
        color(0xffffdc70,2.4f);
        canvas.drawLine(x,top,x-w*.057f,bottom,brush);
        canvas.drawLine(x,top,x+w*.057f,bottom,brush);
        canvas.drawLine(x-w*.05f,h*.79f,x+w*.05f,h*.79f,brush);
        canvas.drawLine(x-w*.04f,h*.66f,x+w*.04f,h*.66f,brush);
        canvas.drawLine(x-w*.025f,h*.53f,x+w*.025f,h*.53f,brush);
        canvas.drawLine(x-w*.049f,h*.79f,x+w*.04f,h*.66f,brush);
        canvas.drawLine(x+w*.049f,h*.79f,x-w*.04f,h*.66f,brush);
        canvas.drawLine(x-w*.039f,h*.66f,x+w*.026f,h*.53f,brush);
        canvas.drawLine(x+w*.039f,h*.66f,x-w*.026f,h*.53f,brush);
        color(0xffea9bb3,0);
        canvas.drawCircle(x,top,dp(5),brush);

        boolean moving=onAir&&ValueAnimator.areAnimatorsEnabled()&&isShown();
        float pulse=moving?(android.os.SystemClock.uptimeMillis()%2600)/2600f:0.25f;
        for(int i=0;i<3;i++){
            color(0xffe4a4bd,1.5f);
            float r=dp(18+(i*.48f+pulse*.55f)*35);
            canvas.drawArc(new RectF(x-r,top-r,x+r,top+r),205,130,false,brush);
            canvas.drawArc(new RectF(x-r,top-r,x+r,top+r),25,130,false,brush);
        }
        // Satellite stations light up as the local player levels.
        int unlocked=level>=11?3:level>=7?2:level>=4?1:0;
        float[] nodesX={.20f,.78f,.85f},nodesY={.46f,.32f,.70f};
        for(int i=0;i<nodesX.length;i++){
            float px=w*nodesX[i],py=h*nodesY[i];
            color(i<unlocked?0xffffdc70:0xff807591,1);
            canvas.drawLine(x,top,px,py,brush);
            color(i<unlocked?0xffffdc70:0xff8b7c9f,0);
            canvas.drawCircle(px,py,dp(5),brush);
            color(0xff221b39,0);
            canvas.drawCircle(px,py,dp(2),brush);
        }
        brush.setTypeface(Typeface.create("sans-serif-black",Typeface.BOLD));
        brush.setTextSize(dp(11));
        color(0xffffdc70,0);
        canvas.drawText("THE LONG WAY HOME",dp(16),dp(24),brush);
        brush.setTypeface(Typeface.create("sans-serif",Typeface.NORMAL));
        brush.setTextSize(dp(10));
        color(0xfffff8e9,0);
        canvas.drawText(onAir?"● SIGNAL ACTIVE":"○ SIGNAL STANDBY",dp(16),h-dp(14),brush);

        if(moving)postInvalidateDelayed(170);
    }
}
