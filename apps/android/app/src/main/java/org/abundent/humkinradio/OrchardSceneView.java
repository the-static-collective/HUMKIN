package org.abundent.humkinradio;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.os.SystemClock;
import android.view.View;
import java.util.Calendar;

/** A small, battery-conscious drawn room: no downloaded sprites or game engine. */
final class OrchardSceneView extends View {
    private final Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);
    private OrchardLedger.Snapshot state;
    private boolean playing;
    private static final int INK=0xff2b2538,CREAM=0xfffff4da,WOOD=0xffbd8d73;
    private final float[][] slots={
        {43,133},{124,129},{51,270},{116,270},
        {234,170},{313,173},{346,267},{241,289}
    };
    OrchardSceneView(Context context){super(context);setLayerType(View.LAYER_TYPE_SOFTWARE,null);}
    void update(OrchardLedger.Snapshot value,boolean isPlaying){
        state=value;playing=isPlaying;invalidate();
    }
    private void fill(int color){p.reset();p.setAntiAlias(true);p.setStyle(Paint.Style.FILL);p.setColor(color);}
    private void rect(Canvas c,float a,float b,float d,float e,int color){fill(color);c.drawRect(a,b,d,e,p);}
    private void oval(Canvas c,float a,float b,float d,float e,int color){fill(color);c.drawOval(a,b,d,e,p);}
    private void line(Canvas c,float a,float b,float d,float e,int color,float width){
        fill(color);p.setStrokeWidth(width);p.setStrokeCap(Paint.Cap.ROUND);c.drawLine(a,b,d,e,p);
    }
    private void text(Canvas c,String t,float x,float y,int size,int color){
        fill(color);p.setTextSize(size);p.setTypeface(Typeface.create("sans-serif",Typeface.BOLD));c.drawText(t,x,y,p);
    }
    private void tree(Canvas c,float x,float y,float scale,int index){
        c.save();c.translate(x,y);c.scale(scale,scale);
        rect(c,-6,-66,6,5,0xff6f5547);
        oval(c,-38,-123,39,-42,0xff648b69);
        oval(c,-33,-130,22,-69,0xff8fb28b);
        oval(c,-5,-109,43,-59,0xff709b76);
        if(index%2==0){oval(c,-12,-102,-3,-93,0xfff3adad);oval(c,20,-84,30,-73,0xffe3c784);}
        else oval(c,-18,-87,-7,-77,0xffe3c784);
        c.restore();
    }
    private void hill(Canvas c,int color,float top,float slope){
        Path h=new Path();
        h.moveTo(158,340);h.lineTo(158,top+40);
        h.cubicTo(230,top-slope,330,top+slope,420,top+8);
        h.lineTo(420,340);h.close();
        fill(color);c.drawPath(h,p);
    }
    @Override protected void onDraw(Canvas actual){
        super.onDraw(actual);
        int width=getWidth(),height=getHeight();
        if(width<1||height<1)return;
        actual.save();
        actual.scale(width/420f,height/340f);
        Canvas c=actual;
        Calendar calendar=Calendar.getInstance();
        boolean night=calendar.get(Calendar.HOUR_OF_DAY)<6||calendar.get(Calendar.HOUR_OF_DAY)>=19;
        fill(CREAM);
        p.setShader(new LinearGradient(0,0,420,340,
                night?0xff35415d:0xff95b3cf,night?0xff655c75:0xffebc8ab,Shader.TileMode.CLAMP));
        c.drawRect(0,0,420,340,p);p.setShader(null);
        oval(c,310,26,358,75,night?0xffe5e8ee:0xfff3e4ab);
        hill(c,night?0xff607e76:0xff96b79b,185,35);
        hill(c,night?0xff426f62:0xff689a7d,227,17);
        int stage=state==null?0:state.stage;
        float[][] stems={{234,240,.60f},{322,233,.72f},{364,263,.68f},{266,277,.47f},{192,246,.53f},{396,277,.55f}};
        for(int i=0;i<Math.min(6,stage);i++)
            tree(c,stems[i][0],stems[i][1],stems[i][2],i);
        // A little wooden listening room against the living outdoor world.
        rect(c,0,0,157,340,0xffdec19e);
        for(int y=8;y<340;y+=23)rect(c,0,y,157,y+2,0xffc49f87);
        rect(c,151,0,164,340,0xff695366);
        rect(c,157,276,420,290,0xffb78279);
        rect(c,157,288,420,298,0xff704f5d);
        rect(c,0,180,148,198,0xffa17568);
        rect(c,0,199,148,305,0xffad7b6c);
        rect(c,7,207,141,293,0xffd6a17e);
        rect(c,20,267,55,278,INK);
        rect(c,63,267,94,278,INK);
        rect(c,100,267,130,278,INK);
        rect(c,20,299,31,340,INK);
        rect(c,116,299,127,340,INK);
        rect(c,22,172,119,218,0xffebd1a7);
        rect(c,23,173,118,179,INK);
        // Record and turntable.
        c.save();
        c.rotate(playing?(SystemClock.uptimeMillis()%8000)*360f/8000f:0f,73,176);
        oval(c,43,145,103,207,INK);
        oval(c,59,160,88,189,0xffd9a4ad);
        oval(c,70,171,78,179,0xfff7e2b2);
        c.restore();
        line(c,121,154,96,186,0xffc0b3a4,5f);
        oval(c,114,149,126,161,INK);
        // Radio on the wall and little brass knobs.
        rect(c,31,44,125,104,0xff493a48);
        rect(c,37,50,118,93,0xffe2aa8f);
        for(int x=47;x<99;x+=7)line(c,x,54,x,90,0xff74505b,2);
        oval(c,105,69,117,81,0xffffda81);
        text(c,"HUMKIN",38,120,13,INK);
        text(c,"✳",129,122,13,0xffa76080);
        // Foreground meadow and a little station label.
        rect(c,158,313,420,340,0xff4c7a67);
        text(c,"LONG WAY HOME  /  STATION 004",176,332,10,0xffffead1);
        // Visible placed objects have no commercial/global ID at this stage.
        if(state!=null)for(int i=0;i<8;i++){
            String id=state.placed[i];
            OrchardLedger.Spec o=OrchardLedger.find(id);
            if(o==null)continue;
            float x=slots[i][0],y=slots[i][1];
            oval(c,x-19,y-23,x+24,y+19,0xe8fff4df);
            text(c,o.icon,x-15,y+8,30,INK);
        }
        if(playing)postInvalidateDelayed(550L);
        actual.restore();
    }
}
