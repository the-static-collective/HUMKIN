package org.abundent.humkinradio;

import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;

final class HumkinVisuals {
    static final int INK=Color.rgb(78,25,58);
    static final int PLUM=Color.rgb(86,32,63);
    static final int CREAM=Color.rgb(255,248,236);
    static final int YELLOW=Color.rgb(255,216,88);
    static final int MINT=Color.rgb(193,226,193);
    static final int PINK=Color.rgb(250,185,195);
    static final int BLUSH=Color.rgb(255,232,224);
    static final int WHITE=Color.rgb(255,248,239);

    static int dp(Context ctx, float n) {
        return Math.round(n*ctx.getResources().getDisplayMetrics().density);
    }
    static GradientDrawable shape(Context ctx,int color,int radius) {
        GradientDrawable bg=new GradientDrawable();
        bg.setColor(color);bg.setCornerRadius(dp(ctx,radius));return bg;
    }
    static GradientDrawable outlined(Context ctx,int color,int radius,int stroke) {
        GradientDrawable bg=shape(ctx,color,radius);
        bg.setStroke(dp(ctx,2),stroke);
        return bg;
    }
    static TextView text(Context ctx,String value,int size,int color,boolean bold) {
        TextView t=new TextView(ctx);t.setText(value);t.setTextSize(size);
        t.setTextColor(color);t.setGravity(Gravity.CENTER);
        t.setTypeface(Typeface.create(bold?"sans-serif-black":"sans-serif",bold?Typeface.BOLD:Typeface.NORMAL));
        t.setIncludeFontPadding(true);
        return t;
    }
    static Button pill(Context ctx,String title,int fill,int foreground) {
        Button b=new Button(ctx);
        b.setText(title);b.setTextColor(foreground);b.setTextSize(15);
        b.setAllCaps(false);
        b.setTypeface(Typeface.create("sans-serif-condensed",Typeface.BOLD));
        b.setBackgroundTintList(null);
        b.setBackground(shape(ctx,fill,26));
        b.setElevation(dp(ctx,3));
        b.setMinHeight(dp(ctx,54)); b.setPadding(dp(ctx,10),dp(ctx,8),dp(ctx,10),dp(ctx,8));
        return b;
    }
    static LinearLayout vertical(Context ctx) {
        LinearLayout a=new LinearLayout(ctx);
        a.setOrientation(LinearLayout.VERTICAL);
        a.setGravity(Gravity.CENTER_HORIZONTAL);return a;
    }
    static LinearLayout horizontal(Context ctx) {
        LinearLayout a=new LinearLayout(ctx);
        a.setOrientation(LinearLayout.HORIZONTAL);a.setGravity(Gravity.CENTER_VERTICAL);return a;
    }
    static LinearLayout.LayoutParams full(Context ctx,int h,int top) {
        LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,dp(ctx,h));
        p.topMargin=dp(ctx,top);return p;
    }
    static LinearLayout.LayoutParams wrap(Context ctx,int top) {
        LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);
        p.topMargin=dp(ctx,top);return p;
    }
    static LinearLayout.LayoutParams flex(Context ctx,int weight,int left) {
        LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(0,-2,weight);
        p.leftMargin=dp(ctx,left);return p;
    }
    static FrameLayout artTile(Context ctx,int h,String coverUrl,ExecutorService worker) {
        FrameLayout box=new FrameLayout(ctx);
        box.setClipToOutline(true);
        box.setBackground(shape(ctx,PLUM,20));
        box.setElevation(dp(ctx,1));
        box.addView(new SunsetPoster(ctx),new FrameLayout.LayoutParams(-1,-1));
        if(coverUrl!=null) {
            ImageView artwork=new ImageView(ctx);
            artwork.setScaleType(ImageView.ScaleType.CENTER_CROP);
            box.addView(artwork,new FrameLayout.LayoutParams(-1,-1));
            worker.execute(()->{
                try{
                    URL source=new URL(coverUrl);
                    if(!"https".equals(source.getProtocol()) ||
                       !"humkin.abundent.org".equals(source.getHost()))return;
                    HttpURLConnection c=(HttpURLConnection)source.openConnection();
                    c.setConnectTimeout(6000);c.setReadTimeout(8000);
                    try{
                        if(c.getResponseCode()!=200)return;
                        if(c.getContentLengthLong()>3000000)return;
                        try(InputStream in=c.getInputStream()){
                            Bitmap b=BitmapFactory.decodeStream(in);
                            if(b!=null)artwork.post(()->artwork.setImageBitmap(b));
                        }
                    }finally{c.disconnect();}
                }catch(Exception ignored){/* The painted sunset is intentional fallback. */}
            });
        }
        return box;
    }
    /** Folk-radio landscape, drawn locally; no packaged image/font assets. */
    private static final class SunsetPoster extends View {
        private final Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);
        SunsetPoster(Context c){super(c);}
        @Override protected void onDraw(Canvas c) {
            super.onDraw(c);
            float w=getWidth(),h=getHeight();if(w<1||h<1)return;
            p.setShader(new LinearGradient(0,0,w,h,
                 new int[]{0xffe983aa,0xfff7a08e,0xffd66a91},null,Shader.TileMode.CLAMP));
            c.drawRect(0,0,w,h,p);p.setShader(null);
            p.setColor(0xffffd995);
            c.drawCircle(w*.27f,h*.3f,w*.14f,p);
            p.setColor(0xffffbda9);
            c.drawOval(w*.04f,h*.2f,w*.68f,h*.39f,p);
            c.drawOval(w*.5f,h*.12f,w*.95f,h*.25f,p);
            p.setColor(0xff4d2c53);
            Path hill=new Path();hill.moveTo(0,h*.78f);hill.cubicTo(w*.25f,h*.68f,w*.56f,h*.92f,w,h*.71f);
            hill.lineTo(w,h);hill.lineTo(0,h);hill.close();c.drawPath(hill,p);
            p.setColor(0xff57364c);
            for(int i=0;i<7;i++){
                float left=i*w/7f,roof=h*(.62f+.04f*(i%3));
                c.drawRect(left,roof,left+w*.12f,h,p);
            }
            p.setColor(0xffffd67b);
            for(int i=0;i<9;i++){
                float x=w*(.09f+(i%5)*.18f),y=h*(.72f+(i/5)*.1f);
                c.drawRect(x,y,x+w*.035f,y+h*.046f,p);
            }
            p.setColor(0xff45304b);p.setStrokeWidth(Math.max(2,w*.012f));
            float mast=w*.78f;
            c.drawLine(mast,h*.26f,mast,h*.81f,p);
            c.drawLine(mast-w*.09f,h*.38f,mast+w*.09f,h*.38f,p);
            p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(Math.max(1,w*.007f));
            Path wire=new Path();wire.moveTo(0,h*.37f);
            wire.quadTo(w*.36f,h*.44f,mast,h*.38f);
            c.drawPath(wire,p);p.setStyle(Paint.Style.FILL);
        }
    }
}
