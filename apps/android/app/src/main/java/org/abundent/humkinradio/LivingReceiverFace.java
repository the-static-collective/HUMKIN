package org.abundent.humkinradio;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.PixelFormat;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.text.TextUtils;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewOutlineProvider;
import android.graphics.Outline;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.ScrollView;

/**
 * HUMKIN's new native front panel: the approved radio image supplies the
 * illustrated chassis, not UI behavior. Every operating control is a separate
 * accessible Android touch target. Actual playback stays in Media3.
 *
 * Coordinates are relative to the 864x1536 approved mockup; this View scales
 * the complete illustrated instrument to phone/tablet width.
 */
final class LivingReceiverFace extends FrameLayout {
    interface Operations {
        void tuneIn();
        void mode(boolean sameTime);
        void records();
        void outpost();
        void signal();
        void unbuilt(String circuit,float frequency,boolean archive);
        void volume(float level);
        void frequencyChanged(boolean playable);
    }
    private static final float W=864f,H=1536f;
    private final Operations commands;
    private final FacePaint painter;
    private final SlicedReceiverSkin chassis;
    private int viewportHeightPx=0;
    private View boundViewport;
    private final View.OnLayoutChangeListener viewportListener=(v,l,t,r,b,ol,ot,oright,ob)->{
        int actual=b-t;
        if(actual>0&&actual!=viewportHeightPx){
            viewportHeightPx=actual;
            requestLayout();
        }
    };
    private final ImageView realArt;
    private final TextView title,artist;
    private final View dialTouch;
    private final Bitmap tuningWheel,volumeWheel;
    private boolean archive=false,playing=false,sameTime=true;
    private float frequency=98.2f,volume=.75f;
    private float gestureX,gestureY;
    private boolean dialMoved;
    private View[] controls;
    private static final int PAPER=0xfff6e3bf,INK=0xff08274c,GOLD=0xffffd251;

    LivingReceiverFace(Context c, Operations ops){
        super(c);
        commands=ops;
        setClipChildren(false);
        setClipToPadding(false);
        setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_YES);
        setContentDescription("HUMKIN Living Receiver. Interactive virtual radio, not terrestrial RF.");
        // Source art remains fixed-size in every hardware band. Between them
        // the navy enamel and worn edge rails genuinely repeat, never scale.
        chassis=new SlicedReceiverSkin(c);
        addView(chassis,new FrameLayout.LayoutParams(-1,-1));
        painter=new FacePaint(c);
        addView(painter,new FrameLayout.LayoutParams(-1,-1));

        Bitmap art=BitmapFactory.decodeResource(getResources(),R.drawable.living_receiver_face);
        // The active objects are cut out of the exact uploaded picture, so they
        // preserve its scratches and texture while physically rotating.
        tuningWheel=cutCircle(art,433,506,135);
        volumeWheel=cutCircle(art,157,615,63);
        if(art!=null)art.recycle();

        title=new TextView(c);
        title.setTypeface(Typeface.create("sans-serif-condensed",Typeface.BOLD));
        title.setTextColor(INK);
        title.setGravity(Gravity.TOP|Gravity.START);
        title.setAllCaps(true);
        title.setIncludeFontPadding(false);
        title.setMaxLines(2);
        title.setEllipsize(TextUtils.TruncateAt.END);
        title.setText("READY TO TUNE IN");
        addView(title);

        artist=new TextView(c);
        artist.setTypeface(Typeface.create("sans-serif-condensed",Typeface.BOLD));
        artist.setTextColor(INK);
        artist.setSingleLine(true);
        artist.setEllipsize(TextUtils.TruncateAt.END);
        artist.setText("HUMKIN · RADIO");
        artist.setIncludeFontPadding(false);
        addView(artist);

        realArt=new ImageView(c);
        realArt.setImageResource(R.drawable.ic_radio);
        realArt.setScaleType(ImageView.ScaleType.CENTER_CROP);
        realArt.setOutlineProvider(new ViewOutlineProvider(){
            @Override public void getOutline(View view,Outline outline){
                outline.setOval(0,0,view.getWidth(),view.getHeight());
            }
        });
        realArt.setClipToOutline(true);
        realArt.setContentDescription("Actual album artwork for the record now playing");
        addView(realArt);

        dialTouch=new View(c){
            @Override public boolean onKeyDown(int keyCode,KeyEvent event){
                if(keyCode==KeyEvent.KEYCODE_DPAD_LEFT||keyCode==KeyEvent.KEYCODE_DPAD_RIGHT){
                    setFrequency(frequency+(keyCode==KeyEvent.KEYCODE_DPAD_LEFT?-.2f:.2f));
                    return true;
                }
                return super.onKeyDown(keyCode,event);
            }
            @Override public boolean performClick(){
                super.performClick();
                if(!playable())commands.unbuilt("DIAL",frequency,archive);
                return true;
            }
            @Override public boolean onTouchEvent(MotionEvent e){
                if(e.getActionMasked()==MotionEvent.ACTION_DOWN){
                    gestureX=e.getX();gestureY=e.getY();dialMoved=false;
                    if(getParent()!=null)getParent().requestDisallowInterceptTouchEvent(true);
                    return true;
                }
                if(e.getActionMasked()==MotionEvent.ACTION_MOVE || e.getActionMasked()==MotionEvent.ACTION_UP){
                    if(Math.abs(e.getX()-gestureX)>5 || Math.abs(e.getY()-gestureY)>5)dialMoved=true;
                    if(dialMoved){
                        float x=(e.getX()/(float)Math.max(1,getWidth()))*360f-180f;
                        float y=180f-(e.getY()/(float)Math.max(1,getHeight()))*360f;
                        double angle=Math.toDegrees(Math.atan2(x,y));
                        setFrequency(88f+(float)((Math.max(-140,Math.min(140,angle))+140)/280d*20d));
                    }
                    if(e.getActionMasked()==MotionEvent.ACTION_UP){
                        if(!dialMoved)performClick();
                        else if(!playable())commands.unbuilt("DIAL",frequency,archive);
                        if(getParent()!=null)getParent().requestDisallowInterceptTouchEvent(false);
                    }
                    return true;
                }
                if(e.getActionMasked()==MotionEvent.ACTION_CANCEL){
                    if(getParent()!=null)getParent().requestDisallowInterceptTouchEvent(false);
                    return true;
                }
                return super.onTouchEvent(e);
            }
        };
        dialTouch.setClickable(true);
        dialTouch.setFocusable(true);
        dialTouch.setContentDescription("Virtual FM tuning knob. Drag to change channel. 98.2 is HUMKIN.");
        addView(dialTouch);

        View volTouch=new View(c){
            @Override public boolean onTouchEvent(MotionEvent e){
                if(e.getActionMasked()==MotionEvent.ACTION_DOWN||
                   e.getActionMasked()==MotionEvent.ACTION_MOVE||
                   e.getActionMasked()==MotionEvent.ACTION_UP){
                    float level=Math.max(0f,Math.min(1f,(e.getX() / Math.max(1f,getWidth()))));
                    volume=level;commands.volume(level);painter.invalidate();
                    return true;
                }
                return super.onTouchEvent(e);
            }
        };
        volTouch.setContentDescription("Volume knob. Slide left or right to control actual playback volume.");
        volTouch.setClickable(true);volTouch.setFocusable(true);
        addView(volTouch);

        controls=new View[11];
        controls[0]=hit("TUNE IN or pause radio",()->commands.tuneIn());
        controls[1]=hit("Same-Time Radio",()->{sameTime=true;commands.mode(true);painter.invalidate();});
        controls[2]=hit("Road Shuffle",()->{sameTime=false;commands.mode(false);painter.invalidate();});
        controls[3]=hit("AM and FM band switch",()->{
            archive=!archive;
            painter.invalidate();commands.frequencyChanged(playable());
            if(archive)commands.unbuilt("BAND",frequency,true);
        });
        controls[4]=hit("Stereo and mono workshop circuit",()->commands.unbuilt("MONO",frequency,archive));
        controls[5]=hit("Signal boost workshop circuit",()->commands.unbuilt("BOOST",frequency,archive));
        controls[6]=hit("Radio tab",()->{});
        controls[7]=hit("Records shelf",()->commands.records());
        controls[8]=hit("Signal Outpost",()->commands.outpost());
        controls[9]=hit("Signal controls",()->commands.signal());
        controls[10]=hit("Signal indicator and station status",()->commands.signal());
        realArt.setOnClickListener(v->commands.records());
        realArt.setFocusable(true);
        // Keep old native screen's optional peripheral operations in its
        // existing album/signal menus; avoid overloading the physical face.
        updateUi(false,true,"READY TO TUNE IN","HUMKIN · RADIO",null);
    }

    private View hit(String label,Runnable click){
        View v=new View(getContext());
        v.setClickable(true);v.setFocusable(true);
        v.setContentDescription(label);
        v.setOnClickListener(view->click.run());
        addView(v);
        return v;
    }

    private static Bitmap cutCircle(Bitmap source,int centerX,int centerY,int radius){
        if(source==null)return null;
        int size=radius*2;
        Bitmap out=Bitmap.createBitmap(size,size,Bitmap.Config.ARGB_8888);
        Canvas canvas=new Canvas(out);
        Paint p=new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
        canvas.drawCircle(radius,radius,radius-1,p);
        p.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.SRC_IN));
        Rect src=new Rect(centerX-radius,centerY-radius,centerX+radius,centerY+radius);
        canvas.drawBitmap(source,src,new Rect(0,0,size,size),p);
        p.setXfermode(null);
        return out;
    }

    private void setFrequency(float next){
        float normalized=VirtualChannels.normalize(next);
        if(normalized==frequency)return;
        frequency=normalized;
        commands.frequencyChanged(playable());
        dialTouch.setContentDescription("Virtual "+(archive?"AM archive":"FM")+" "
            +VirtualChannels.frequencyLabel(frequency)+". Drag to tune; press to check channel.");
        painter.invalidate();
    }

    boolean playable(){return VirtualChannels.isPlayable(archive,frequency);}
    float frequency(){return frequency;}
    boolean archive(){return archive;}
    void setVolume(float level){volume=Math.max(0f,Math.min(1f,level));painter.invalidate();}
    void updateUi(boolean isPlaying,boolean selectedSameTime,String track,String performer,Drawable cover){
        playing=isPlaying;sameTime=selectedSameTime;
        String t=(track==null||track.trim().isEmpty())?"READY TO TUNE IN":track;
        title.setText(t.toUpperCase(java.util.Locale.ROOT));
        artist.setText((performer==null||performer.trim().isEmpty())?"HUMKIN · RADIO":performer);
        if(cover!=null && cover!=realArt.getDrawable())realArt.setImageDrawable(cover);
        float fontSize=t.length()>25?37:t.length()>18?43:t.length()>11?49:53;
        // Stored nominal font size is applied in onSizeChanged as view width changes.
        nominalTitleSize=fontSize;
        if(getWidth()>0)positionChildren(getWidth());
        painter.invalidate();
    }
    private float nominalTitleSize=49;
    private float scale=1f;

    /**
     * Ask the containing ScrollView how much visible height the phone really
     * offers. This avoids inventing status/navigation bar dimensions and
     * removes the giant blank navy rectangle on tall Android 11 handsets.
     */
    @Override protected void onAttachedToWindow(){
        super.onAttachedToWindow();
        post(()->{
            if(getParent()==null)return;
            View candidate=this;
            while(candidate.getParent() instanceof View){
                candidate=(View)candidate.getParent();
                if(candidate instanceof ScrollView){
                    if(boundViewport!=candidate){
                        if(boundViewport!=null)boundViewport.removeOnLayoutChangeListener(viewportListener);
                        boundViewport=candidate;
                        boundViewport.addOnLayoutChangeListener(viewportListener);
                    }
                    viewportListener.onLayoutChange(candidate,0,0,candidate.getWidth(),
                            candidate.getHeight(),0,0,0,0);
                    break;
                }
            }
        });
    }
    @Override protected void onDetachedFromWindow(){
        if(boundViewport!=null)boundViewport.removeOnLayoutChangeListener(viewportListener);
        boundViewport=null;
        super.onDetachedFromWindow();
    }
    @Override protected void onMeasure(int widthMeasureSpec,int heightMeasureSpec){
        int w=MeasureSpec.getSize(widthMeasureSpec);
        if(w<=0)w=864;
        int originalHeight=Math.round(w*H/W);
        // In a short/landscape viewport we scroll rather than crushing knobs.
        int desired=Math.max(originalHeight,viewportHeightPx);
        super.onMeasure(MeasureSpec.makeMeasureSpec(w,MeasureSpec.EXACTLY),
                MeasureSpec.makeMeasureSpec(desired,MeasureSpec.EXACTLY));
    }
    private int px(float design){return Math.round(design*scale);}
    private void put(View v,int x,int y,int w,int h){
        FrameLayout.LayoutParams lp=new FrameLayout.LayoutParams(px(w),px(h));
        lp.leftMargin=px(x);
        float extra=ReceiverSliceGeometry.expansion(getWidth(),getHeight());
        lp.topMargin=px(ReceiverSliceGeometry.mapY(y,extra));
        v.setLayoutParams(lp);
    }
    private void positionChildren(int actualWidth){
        scale=actualWidth/W;
        put(title,430,750,345,100);
        title.setTextSize(TypedValue.COMPLEX_UNIT_PX,nominalTitleSize*scale);
        put(artist,433,852,335,35);
        artist.setTextSize(TypedValue.COMPLEX_UNIT_PX,26*scale);
        put(realArt,186,775,108,108);
        put(dialTouch,276,355,320,330);
        put(findVolumeView(),79,546,167,146);
        put(controls[0],166,1041,544,125);
        put(controls[1],79,970,350,60);
        put(controls[2],445,970,346,60);
        put(controls[3],605,401,76,122);
        put(controls[4],683,401,76,122);
        put(controls[5],762,401,81,122);
        put(controls[6],66,1380,189,102);
        put(controls[7],255,1380,190,102);
        put(controls[8],445,1380,187,102);
        put(controls[9],632,1380,192,102);
        put(controls[10],636,535,143,147);
    }
    private View volumeView;
    private View findVolumeView(){
        if(volumeView!=null)return volumeView;
        // The volume target was added immediately after the tuning target.
        int idx=indexOfChild(dialTouch);
        volumeView=getChildAt(idx+1);
        return volumeView;
    }
    @Override protected void onSizeChanged(int w,int h,int oldW,int oldH){
        super.onSizeChanged(w,h,oldW,oldH);
        positionChildren(w);
    }

    private final class FacePaint extends View {
        private final Paint p=new Paint(Paint.ANTI_ALIAS_FLAG|Paint.FILTER_BITMAP_FLAG);
        private final RectF rect=new RectF();
        FacePaint(Context c){super(c);setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);}
        @Override protected void onDraw(Canvas original){
            super.onDraw(original);
            Canvas c=original;
            c.save();
            // Never stretch the artwork vertically: use the same geometry as
            // the sliced chassis and every interactive hit target.
            c.scale(getWidth()/W,getWidth()/W);
            float extra=ReceiverSliceGeometry.expansion(getWidth(),getHeight());
            float upper=ReceiverSliceGeometry.shiftBefore(743f,extra);
            c.save();c.translate(0,upper);
            // The mockup's original fake track title is covered with a paper
            // insert. Its artwork, speaker grille and chrome stay intact.
            p.setShader(new LinearGradient(421,744,780,931,
                    new int[]{0xfffaedcd,0xfff7e8c8,0xfff0d9ab},
                    null,Shader.TileMode.CLAMP));
            p.setStyle(Paint.Style.FILL);
            rect.set(424,743,784,936);
            c.drawRoundRect(rect,4f,4f,p);p.setShader(null);
            p.setColor(0xffef467f);c.drawCircle(439,727,8,p);
            // Play-status waveform: animated only when Media3 reports audio.
            for(int i=0;i<24;i++){
                int[] colors={0xff3575a8,0xfff2b63e,0xffee799b};
                p.setColor(colors[i%3]);
                float tall=playing?((i*19+System.currentTimeMillis()/130)%28+10):(i*7%23+10);
                rect.set(445+i*13.3f,904-tall/2,449+i*13.3f,904+tall/2);
                c.drawRoundRect(rect,3,3,p);
            }
            c.restore();
            // Actual station state sits on the existing little lamps.
            if(playing){
                p.setColor(0x66ffe270);c.drawCircle(760,661,22,p);
                p.setColor(0xffffec92);c.drawCircle(760,661,11,p);
            }
            c.save();c.translate(0,upper);
            if(!sameTime){p.setColor(0xffffe47e);c.drawCircle(479,996,9,p);}
            else{p.setColor(0xffffe47e);c.drawCircle(143,996,9,p);}
            c.restore();
            // Physically rotating, cropped hardware layers from the reference.
            if(tuningWheel!=null){
                c.save();c.rotate((frequency-98.2f)*13f,433,506);
                p.setColor(0xffffffff);p.setAlpha(255);
                c.drawBitmap(tuningWheel,null,new RectF(298,371,568,641),p);
                c.restore();
            }
            if(volumeWheel!=null){
                c.save();c.rotate(-130+volume*260,157,615);
                p.setColor(0xffffffff);p.setAlpha(255);
                c.drawBitmap(volumeWheel,null,new RectF(94,552,220,678),p);
                c.restore();
            }
            if(archive){
                p.setColor(0xfff39c83);p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(6);
                c.drawRoundRect(new RectF(598,398,680,519),10,10,p);p.setStyle(Paint.Style.FILL);
            }
            if(playing){
                c.save();c.translate(0,upper);
                // Cover the baked TUNE IN label with a dynamic physical placard.
                p.setShader(new LinearGradient(0,1071,0,1138,
                        new int[]{0xffffe47e,0xfff8c340,0xfff5b83d},null,Shader.TileMode.CLAMP));
                rect.set(339,1065,636,1145);c.drawRoundRect(rect,15,15,p);p.setShader(null);
                p.setTypeface(Typeface.create("sans-serif-black",Typeface.BOLD_ITALIC));
                p.setTextSize(64);p.setTextAlign(Paint.Align.CENTER);p.setColor(INK);
                c.drawText("PAUSE",485,1123,p);
                c.restore();
            }
            c.restore();
            if(playing)postInvalidateDelayed(220);
        }
    }
}
