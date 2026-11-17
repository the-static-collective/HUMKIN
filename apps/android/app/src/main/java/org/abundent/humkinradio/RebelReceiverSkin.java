package org.abundent.humkinradio;

import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RadialGradient;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.LayerDrawable;
import android.graphics.drawable.RippleDrawable;
import android.view.Gravity;
import android.view.View;
import android.view.MotionEvent;
import android.view.KeyEvent;
import android.view.HapticFeedbackConstants;
import android.widget.Button;

/**
 * RADIO / REBEL 027. A real native Android receiver face, not a screenshot
 * with invisible hotspots. The original concept is a visual reference;
 * every recording title and cover still comes from the actual Media3 player.
 *
 * Frequencies are virtual HUMKIN channels; they are NOT terrestrial RF.
 * The large knob now physically rotates a virtual tuner and the mechanical
 * band switch opens an honest construction gate for unbuilt archive bands.
 * Real Same-Time and Shuffle buttons remain the source of playback modes.
 */
final class RebelReceiverSkin {
    static final int NAVY = 0xff102c52;
    static final int DARK = 0xff081c37;
    static final int GOLD = 0xffffd55a;
    static final int BRASS = 0xffb47a35;
    static final int PEACH = 0xffff9f88;
    static final int MINT = 0xffb4e2bc;
    static final int PAPER = 0xfffff2d7;
    static final int WHITE = 0xfffff7e9;
    private RebelReceiverSkin() {}

    private static int dp(Context c,float n){return HumkinVisuals.dp(c,n);}

    static Drawable plate(Context c,int fill,int edge,int radius) {
        GradientDrawable drop=new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
                new int[]{DARK,BRASS});
        drop.setCornerRadius(dp(c,radius));
        GradientDrawable metal=new GradientDrawable(GradientDrawable.Orientation.TL_BR,
                new int[]{edge,0xffffe5a4,edge});
        metal.setCornerRadius(dp(c,radius));
        GradientDrawable face=new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
                new int[]{fill,fill});
        face.setCornerRadius(dp(c,Math.max(2,radius-3)));
        LayerDrawable layers=new LayerDrawable(new Drawable[]{drop,metal,face});
        layers.setLayerInset(1,dp(c,1),dp(c,1),dp(c,1),dp(c,3));
        layers.setLayerInset(2,dp(c,3),dp(c,3),dp(c,3),dp(c,6));
        return layers;
    }

    private static void button(Button b,int fill,int edge,int ink) {
        b.setTextColor(ink);
        b.setBackgroundTintList(null);
        b.setBackground(new RippleDrawable(ColorStateList.valueOf(0x35ffffff),
                plate(b.getContext(),fill,edge,24),
                HumkinVisuals.shape(b.getContext(),WHITE,24)));
        b.setStateListAnimator(null);
        b.setElevation(dp(b.getContext(),2));
        b.setGravity(Gravity.CENTER);
    }

    static void mode(Button b,boolean selected) {
        button(b,selected?DARK:PAPER,selected?GOLD:BRASS,
                selected?WHITE:DARK);
    }
    static void tune(Button b) {
        button(b,GOLD,BRASS,DARK);
        b.setContentDescription("Tune in to HUMKIN Radio, or pause the current station");
    }
    static void navigation(Button b,boolean selected) {
        button(b,selected?PEACH:DARK,selected?GOLD:BRASS,
                selected?DARK:WHITE);
        b.setMinWidth(0);
        b.setMinimumWidth(0);
    }

    /** Draws two small paisley curls and starbursts around the masthead. */
    static final class HeaderFlourish extends View {
        private final Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);
        HeaderFlourish(Context c) {super(c);setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);}
        @Override protected void onDraw(Canvas c) {
            super.onDraw(c);
            float w=getWidth(),h=getHeight();
            c.save();c.scale(w/360f,h/35f);
            paisley(c,8,28,.7f);
            c.save();c.translate(360,0);c.scale(-1,1);paisley(c,8,28,.7f);c.restore();
            p.setStyle(Paint.Style.STROKE);
            p.setColor(GOLD);
            p.setStrokeWidth(2.4f);
            for(int i=0;i<8;i++){
                double a=i*Math.PI/4;
                c.drawLine(180+4*(float)Math.cos(a),17+4*(float)Math.sin(a),
                        180+11*(float)Math.cos(a),17+11*(float)Math.sin(a),p);
            }
            p.setStyle(Paint.Style.FILL);
            c.restore();
        }
        private void paisley(Canvas c,float x,float y,float s){
            c.save();c.translate(x,y);c.scale(s,s);
            p.setStyle(Paint.Style.STROKE);p.setStrokeCap(Paint.Cap.ROUND);
            p.setStrokeWidth(7);p.setColor(PEACH);
            Path path=new Path();path.moveTo(0,0);path.cubicTo(2,-30,47,-28,36,-8);
            path.cubicTo(30,5,4,-9,16,-19);c.drawPath(path,p);
            p.setStrokeWidth(3);p.setColor(MINT);c.drawArc(-7,-30,41,11,170,135,false,p);
            p.setStyle(Paint.Style.FILL);
            c.restore();
        }
    }

    /** The atmospheric, but functional, tuning desk. Knob click switches mode. */
    static final class Dial extends View {
        private final Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);
        private boolean sameTime=true,archive=false;
        private float frequency=VirtualChannels.HUMKIN_FREQUENCY;
        private String pressedCircuit="DIAL";
        private boolean handlingTouch;
        interface OnTuneListener { void onTune(String circuit,float frequency,boolean archive); }
        private OnTuneListener onTuneListener;
        Dial(Context c) {
            super(c);
            setFocusable(true);
            setClickable(true);
            updateAccessibility();
        }
        void setOnTuneListener(OnTuneListener listener){onTuneListener=listener;}
        boolean isMainStationTuned(){return VirtualChannels.isPlayable(archive,frequency);}
        boolean isArchive(){return archive;}
        float frequency(){return frequency;}
        void setSameTime(boolean same) {
            if(sameTime==same)return;
            sameTime=same;
            invalidate();
        }
        private void updateAccessibility(){
            setContentDescription((archive?"AM archive band, unbuilt. ":"Virtual FM ")
                    +String.format(java.util.Locale.US,"%.1f",frequency)
                    +". Drag the knob or use left and right arrows; center button checks the selected channel.");
        }
        private void setFrequency(float f){
            float normalized=VirtualChannels.normalize(f);
            if(normalized==frequency)return;
            frequency=normalized;updateAccessibility();invalidate();
        }
        @Override public boolean onTouchEvent(MotionEvent event){
            if(!isEnabled())return super.onTouchEvent(event);
            float x=event.getX()*360f/Math.max(1,getWidth());
            float y=event.getY()*244f/Math.max(1,getHeight());
            switch(event.getActionMasked()){
                case MotionEvent.ACTION_DOWN:
                    handlingTouch=true;pressedCircuit="DIAL";
                    if(y>=88f&&y<=140f&&x>=243f){
                        pressedCircuit=x<275?"BAND":x<310?"MONO":"BOOST";
                    }else if(y>=135f&&x<=105f)pressedCircuit="VOLUME";
                    else if(y>=145f&&x>=260f)pressedCircuit="SIGNAL";
                    if("DIAL".equals(pressedCircuit))updateFromPoint(x,y);
                    if(getParent()!=null)getParent().requestDisallowInterceptTouchEvent(true);
                    return true;
                case MotionEvent.ACTION_MOVE:
                    if(handlingTouch&&"DIAL".equals(pressedCircuit))updateFromPoint(x,y);
                    return handlingTouch;
                case MotionEvent.ACTION_UP:
                    if(!handlingTouch)return super.onTouchEvent(event);
                    if("DIAL".equals(pressedCircuit))updateFromPoint(x,y);
                    if("BAND".equals(pressedCircuit)){archive=!archive;updateAccessibility();invalidate();}
                    performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK);
                    handlingTouch=false;
                    if(getParent()!=null)getParent().requestDisallowInterceptTouchEvent(false);
                    performClick();
                    return true;
                case MotionEvent.ACTION_CANCEL:
                    handlingTouch=false;
                    if(getParent()!=null)getParent().requestDisallowInterceptTouchEvent(false);
                    return true;
                default:return super.onTouchEvent(event);
            }
        }
        private void updateFromPoint(float x,float y){
            if(y<=85f){setFrequency(88f+20f*(x-54f)/251f);return;}
            // 280 degree dial travel, upper semicircle at 98.2.
            double theta=Math.toDegrees(Math.atan2(x-180f,161f-y));
            float v=88f+(float)((Math.max(-140,Math.min(140,theta))+140d)/280d)*20f;
            setFrequency(v);
        }
        @Override public boolean onKeyDown(int keyCode,KeyEvent e){
            if(keyCode==KeyEvent.KEYCODE_DPAD_LEFT||keyCode==KeyEvent.KEYCODE_DPAD_RIGHT){
                setFrequency(frequency+(keyCode==KeyEvent.KEYCODE_DPAD_RIGHT ? 0.2f : -0.2f));
                pressedCircuit="DIAL";performClick();return true;
            }
            return super.onKeyDown(keyCode,e);
        }
        @Override public boolean performClick(){
            super.performClick();
            if(onTuneListener!=null)onTuneListener.onTune(pressedCircuit,frequency,archive);
            pressedCircuit="DIAL";
            return true;
        }
        private void fill(int color) {p.setShader(null);p.setColor(color);p.setStyle(Paint.Style.FILL);}
        private void stroke(int color,float width) {
            p.setShader(null);p.setColor(color);p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(width);
        }
        private void rect(Canvas c,float l,float t,float r,float b,float rad,int color) {
            fill(color);c.drawRoundRect(l,t,r,b,rad,rad,p);
        }
        private void label(Canvas c,String s,float x,float y,int size,int col,boolean center) {
            fill(col);p.setTypeface(android.graphics.Typeface.create("sans-serif-condensed",
                    android.graphics.Typeface.BOLD));p.setTextSize(size);
            p.setTextAlign(center?Paint.Align.CENTER:Paint.Align.LEFT);
            c.drawText(s,x,y,p);
        }
        private void screw(Canvas c,float x,float y) {
            fill(0xff1c2540);c.drawCircle(x+1,y+2,6.5f,p);
            p.setStyle(Paint.Style.FILL);
            p.setShader(new RadialGradient(x-2,y-2,9,
                    new int[]{0xffffefbb,BRASS,0xff523118},null,Shader.TileMode.CLAMP));
            c.drawCircle(x,y,5,p);p.setShader(null);
            stroke(DARK,1.5f);c.drawLine(x-2,y-2,x+2,y+2,p);
        }
        private void knob(Canvas c,float x,float y,float radius,int tint) {
            fill(DARK);c.drawCircle(x+1.5f,y+4,radius+7,p);
            p.setStyle(Paint.Style.FILL);
            p.setShader(new RadialGradient(x-radius*.4f,y-radius*.5f,radius*1.8f,
                    new int[]{0xfffff9d7,BRASS,0xff5a381f},null,Shader.TileMode.CLAMP));
            c.drawCircle(x,y,radius+2,p);p.setShader(null);
            for(int i=0;i<42;i++){
                double a=i*Math.PI*2/42;
                float x1=x+(radius-5)*(float)Math.cos(a);
                float y1=y+(radius-5)*(float)Math.sin(a);
                float x2=x+(radius+2)*(float)Math.cos(a);
                float y2=y+(radius+2)*(float)Math.sin(a);
                stroke(i%3==0?0xffffd17b:DARK,1.2f);
                c.drawLine(x1,y1,x2,y2,p);
            }
            p.setShader(new RadialGradient(x-radius*.42f,y-radius*.45f,radius*1.65f,
                    new int[]{0xfffff8d2,0xffd1bd95,0xff88704c},null,Shader.TileMode.CLAMP));
            p.setStyle(Paint.Style.FILL);c.drawCircle(x,y,radius-12,p);p.setShader(null);
            for(int i=0;i<6;i++){
                stroke(0x336b5235,.6f);
                c.drawCircle(x,y,radius-14-i*3.1f,p);
            }
            fill(tint);c.drawCircle(x,y-radius+10,2.7f,p);
        }
        @Override protected void onDraw(Canvas c) {
            super.onDraw(c);
            c.save();c.scale(getWidth()/360f,getHeight()/244f);
            rect(c,0,0,360,244,15,DARK);
            rect(c,2,2,358,242,14,NAVY);
            // Warm backlit, riveted tuner ruler.
            rect(c,9,6,351,85,15,BRASS);
            rect(c,13,9,347,81,12,0xffffe3ab);
            p.setShader(new LinearGradient(0,9,0,81,
                    new int[]{0xfff6cf82,0xfffff5d4,0xffe0b96c},null,Shader.TileMode.CLAMP));
            c.drawRoundRect(18,14,342,77,9,9,p);p.setShader(null);
            for(int i=0;i<=30;i++){
                float x=54+i*8.36f;
                stroke(0xff203047,i%5==0?1.6f:.9f);
                c.drawLine(x,49,x,i%5==0?62:56,p);
            }
            String[] marks={"88","90","94","98","102","106","108"};
            for(int i=0;i<marks.length;i++)
                label(c,marks[i],58+i*40.6f,36,14,DARK,true);
            label(c,"FM",28,36,13,DARK,true);
            label(c,"MHz",331,36,10,DARK,true);
            label(c,archive?"AM ARCHIVE · LOOSE WIRE":"VIRTUAL FM · NO RF TRANSMISSION",180,74,7,0xff6b513e,true);
            float pointer=54+(frequency-88f)/20f*251f;
            rect(c,pointer-2,38,pointer+2,66,2,0xffeb466a);
            fill(0xfffff1ce);c.drawCircle(pointer,38,2,p);
            screw(c,18,18);screw(c,342,18);screw(c,18,72);screw(c,342,72);
            // Deep-center mechanical wheel, with real mode-selection click action.
            for(int i=0;i<32;i++) {
                double a=Math.toRadians(204+i*4.3);
                float x1=180+84*(float)Math.cos(a);
                float y1=166+84*(float)Math.sin(a);
                float x2=180+(i%4==0?93:89)*(float)Math.cos(a);
                float y2=166+(i%4==0?93:89)*(float)Math.sin(a);
                stroke(i%4==0?GOLD:BRASS,i%4==0?2:1);
                c.drawLine(x1,y1,x2,y2,p);
            }
            c.save();
            c.rotate((frequency-VirtualChannels.HUMKIN_FREQUENCY)*13f,180,161);
            knob(c,180,161,62,GOLD);
            c.restore();
            label(c,archive?"AM · ARCHIVE":"TUNING  ◀  ▶",180,238,12,WHITE,true);
            label(c,"THE POCKET",16,111,12,WHITE,false);
            label(c,"RECEIVER  ✳",16,128,12,GOLD,false);
            label(c,"VOLUME",18,157,11,WHITE,false);
            knob(c,54,194,28,PEACH);
            label(c,"−",13,234,13,GOLD,false);label(c,"+",94,234,13,GOLD,false);
            label(c,"SIGNAL",298,157,11,WHITE,true);
            knob(c,305,196,25,MINT);
            fill(GOLD);c.drawCircle(345,217,5,p);
            // Three tiny surface switches are ornamental; real mode buttons below.
            for(int i=0;i<3;i++){
                float x=259+i*33;
                rect(c,x-10,100,x+10,126,6,0xffd5b276);
                fill(DARK);c.drawCircle(x,113,6,p);
                fill(0xfff3debd);c.drawCircle(x+1,109,4,p);
            }
            label(c,"AM",259,96,8,archive?PEACH:GOLD,true);
            label(c,"MON",292,96,8,GOLD,true);
            label(c,"BST",325,96,8,GOLD,true);
            screw(c,8,232);screw(c,352,232);
            c.restore();
        }
    }

    /** Speaker vents are ornamental; never hide a playback control. */
    static final class Speaker extends View {
        private final Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);
        Speaker(Context c){super(c);setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);}
        @Override protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            Canvas c=canvas;c.save();c.scale(getWidth()/360f,getHeight()/73f);
            p.setStyle(Paint.Style.FILL);p.setColor(BRASS);
            c.drawRoundRect(0,0,360,73,13,13,p);
            p.setColor(PAPER);c.drawRoundRect(4,4,356,68,10,10,p);
            for(int y=15;y<66;y+=10)for(int x=17;x<348;x+=12){
                float dx=x-180,dy=y-36;
                if(dx*dx+dy*dy<18*18)continue;
                p.setColor(DARK);c.drawCircle(x,y,2.5f,p);
            }
            p.setColor(NAVY);c.drawCircle(180,36,19,p);
            p.setColor(GOLD);p.setStrokeWidth(3);p.setStyle(Paint.Style.STROKE);
            for(int i=0;i<8;i++){
                double angle=i*Math.PI/4;
                c.drawLine(180+5*(float)Math.cos(angle),36+5*(float)Math.sin(angle),
                        180+14*(float)Math.cos(angle),36+14*(float)Math.sin(angle),p);
            }
            p.setStyle(Paint.Style.FILL);
            for(int side=0;side<2;side++){
                c.save();if(side==1){c.translate(360,0);c.scale(-1,1);}
                Path path=new Path();path.moveTo(7,58);
                path.cubicTo(20,-2,58,75,88,10);
                p.setColor(PEACH);p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(7);
                c.drawPath(path,p);p.setColor(MINT);p.setStrokeWidth(3);c.drawPath(path,p);
                p.setStyle(Paint.Style.FILL);c.restore();
            }
            for(int x:new int[]{12,348})for(int y:new int[]{12,61}){
                p.setColor(BRASS);c.drawCircle(x,y,5,p);
                p.setColor(DARK);p.setStrokeWidth(1);p.setStyle(Paint.Style.STROKE);
                c.drawLine(x-2,y-2,x+2,y+2,p);p.setStyle(Paint.Style.FILL);
            }
            c.restore();
        }
    }
}
