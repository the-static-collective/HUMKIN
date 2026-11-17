package org.abundent.humkinradio;

import android.app.Activity;
import android.content.Intent;
import android.app.AlertDialog;
import android.net.Uri;
import android.util.Base64;
import java.nio.charset.StandardCharsets;
import android.content.IntentFilter;
import android.os.BatteryManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Set;

/** Native listening garden built on the existing Media3-backed Signal RPG. */
public final class OrchardActivity extends Activity {
    private static final int INK=0xff241b32,CREAM=0xfffff6e8,ROSE=0xffe6b7bd,
        MINT=0xffb9d9b3,GOLD=0xffffdc83;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final Runnable redraw=new Runnable(){@Override public void run(){
        update(false);handler.postDelayed(this,3500L);
    }};
    private TextView balance,level,minutes,collectCount,status,workStatus;
    private OrchardSceneView scene;
    private LinearLayout shopList,collectionList,unlockList;
    private Button workButton;
    private Thread workThread;
    private boolean auditBusy;
    private int lastCount=-1;
    private int slotCursor;
    private int dp(float n){return HumkinVisuals.dp(this,n);}
    private LinearLayout column(){LinearLayout r=new LinearLayout(this);r.setOrientation(LinearLayout.VERTICAL);return r;}
    private LinearLayout row(){LinearLayout r=new LinearLayout(this);r.setOrientation(LinearLayout.HORIZONTAL);r.setGravity(Gravity.CENTER_VERTICAL);return r;}
    private LinearLayout.LayoutParams block(int top){
        LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.topMargin=dp(top);return p;
    }
    private TextView text(String value,int sp,int color,boolean bold){
        TextView t=new TextView(this);t.setText(value);t.setTextSize(sp);t.setTextColor(color);
        if(bold)t.setTypeface(Typeface.DEFAULT,Typeface.BOLD);return t;
    }
    private TextView add(LinearLayout p,String val,int sp,int color,boolean bold,int top){
        TextView t=text(val,sp,color,bold);p.addView(t,block(top));return t;
    }
    private Button button(String val,int background){
        Button b=new Button(this);b.setText(val);b.setTextSize(12);b.setTextColor(INK);
        b.setAllCaps(false);b.setMinHeight(dp(48));
        GradientDrawable shape=new GradientDrawable();
        shape.setCornerRadius(dp(25));shape.setColor(background);shape.setStroke(dp(2),INK);
        b.setBackground(shape);b.setPadding(dp(12),dp(7),dp(12),dp(7));
        return b;
    }
    private LinearLayout card(LinearLayout parent,int fill,int margin){
        LinearLayout box=column();box.setPadding(dp(15),dp(14),dp(15),dp(16));
        GradientDrawable shape=new GradientDrawable();
        shape.setColor(fill);shape.setCornerRadius(dp(12));shape.setStroke(dp(2),INK);
        box.setBackground(shape);parent.addView(box,block(margin));return box;
    }
    private void say(String message){
        Toast.makeText(this,message,Toast.LENGTH_SHORT).show();
    }
    @Override public void onCreate(Bundle bundle){
        super.onCreate(bundle);
        getWindow().setStatusBarColor(CREAM);getWindow().setNavigationBarColor(CREAM);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR|
            View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        build();
        update(true);
    }
    @Override protected void onResume(){
        super.onResume();
        handler.removeCallbacks(redraw);handler.post(redraw);
    }
    @Override protected void onPause(){
        handler.removeCallbacks(redraw);
        super.onPause();
    }
    @Override protected void onDestroy(){
        if(workThread!=null)workThread.interrupt();
        super.onDestroy();
    }
    private void build(){
        ScrollView scroller=new ScrollView(this);
        scroller.setFillViewport(true);scroller.setBackgroundColor(CREAM);
        setContentView(scroller);
        LinearLayout page=column();
        int wide=Math.min(getResources().getConfiguration().screenWidthDp,600);
        page.setPadding(dp(17),dp(14),dp(17),dp(50));
        LinearLayout wrap=row();wrap.setGravity(Gravity.CENTER);
        scroller.addView(wrap);
        LinearLayout.LayoutParams w=new LinearLayout.LayoutParams(dp(wide),-2);
        wrap.addView(page,w);
        LinearLayout top=row();
        Button back=button("← RADIO",GOLD);back.setOnClickListener(v->finish());
        top.addView(back,new LinearLayout.LayoutParams(dp(114),dp(51)));
        TextView station=text("   HUMKIN ✳ ORCHARD",16,INK,true);
        top.addView(station,new LinearLayout.LayoutParams(0,-2,1));
        page.addView(top,block(0));

        add(page,"A LITTLE WORLD AROUND THE DIAL",10,0xff84556d,true,31).setLetterSpacing(.12f);
        TextView headline=add(page,"THE LISTENING\nORCHARD.",44,INK,true,9);
        headline.setLineSpacing(-dp(4),1f);
        add(page,"A room that fills with curiosities. A garden that takes root. The real station plays underneath it all.",15,INK,false,12);
        LinearLayout summary=card(page,0xffffe5b5,19);
        LinearLayout stats=row();
        LinearLayout first=column(),second=column();
        balance=add(first,"42 HUM",27,INK,true,0);level=add(first,"LEVEL 1",14,INK,true,3);
        minutes=add(second,"0 MIN HEARD",15,INK,true,0);
        collectCount=add(second,"0 OBJECTS",13,INK,true,8);
        stats.addView(first,new LinearLayout.LayoutParams(0,-2,1));
        stats.addView(second,new LinearLayout.LayoutParams(0,-2,1));
        summary.addView(stats,block(0));
        scene=new OrchardSceneView(this);
        scene.setContentDescription("An illustrated wooden listening room looking onto a growing garden. The record spins while the radio is playing.");
        GradientDrawable edge=new GradientDrawable();
        edge.setColor(0xffc2c4b0);edge.setCornerRadius(dp(12));edge.setStroke(dp(3),INK);
        scene.setBackground(edge);
        LinearLayout.LayoutParams sceneParams=new LinearLayout.LayoutParams(-1,dp(350));sceneParams.topMargin=dp(24);
        page.addView(scene,sceneParams);
        status=add(page,"The radio makes the garden grow.",12,0xff654b61,true,15);
        LinearLayout actions=row();
        Button radio=button("♫ BACK TO THE RADIO",GOLD);
        radio.setOnClickListener(v->finish());
        actions.addView(radio,new LinearLayout.LayoutParams(0,dp(56),1));
        Button outpost=button("✳ SIGNAL OUTPOST",MINT);
        outpost.setOnClickListener(v->startActivity(new Intent(this,OutpostActivity.class)));
        LinearLayout.LayoutParams a2=new LinearLayout.LayoutParams(0,dp(56),1);
        a2.leftMargin=dp(9);actions.addView(outpost,a2);
        page.addView(actions,block(18));
        Button live=button("🌐 OPEN THE LIVE ORCHARD / TRADING POST",MINT);
        live.setOnClickListener(v->openNetwork(false));
        page.addView(live,block(12));
        Button carry=button("↗ CARRY MY NATIVE SCENE TO THE NETWORK",ROSE);
        carry.setOnClickListener(v->new AlertDialog.Builder(this)
            .setTitle("Share a little scene?")
            .setMessage("This will put only your garden stage, locally owned decorative item names, and total listening minutes in a temporary website link. The network page previews them first; nothing is published until you explicitly choose PUBLIC and SAVE. The temporary link can appear in browser or server logs. Your native HUM, Signal, possessions and private keys are NOT transferred.")
            .setNegativeButton("NOT NOW",null)
            .setPositiveButton("OPEN SCENE PREVIEW",(dialog,which)->openNetwork(true))
            .show());
        page.addView(carry,block(7));
        add(page,"HUM IS LOCAL-ONLY GAME CURRENCY · 1 HUM PER 18 SECONDS OF REAL MEDIA3 PLAYBACK",10,0xff795466,true,17);
        add(page,"THE CABINET OF STRANGE THINGS",26,INK,true,38);
        add(page,"Place something in four room places or four garden places. Everything is kept locally on this Android installation.",13,INK,false,7);
        collectionList=column();page.addView(collectionList,block(17));
        add(page,"THE LITTLE SHOP",26,INK,true,40);
        add(page,"Thirty odd objects to earn. Buying never makes a Top 42 play, vote, or radio spin.",13,INK,false,7);
        shopList=column();page.addView(shopList,block(9));
        add(page,"THE LITTLE ENGINE",26,INK,true,42);
        LinearLayout work=card(page,0xffdce8df,12);
        add(work,"LOCAL CATALOG WORKBENCH · LEVEL 4",10,0xff84546e,true,0);
        add(work,"A tiny voluntary radio job: check the published song-list structure and SHA-256 fingerprint. No MP3s downloaded, no hidden processing, no arbitrary code.",14,INK,false,13);
        workButton=button("✳ RUN ONE VOLUNTARY CATALOG CHECK",GOLD);
        workButton.setOnClickListener(v->runWork());
        work.addView(workButton,block(13));
        workStatus=add(work,"This is a local receipt, NOT proof of a network computation.",12,INK,true,13);
        add(page,"THE FUTURE BRANCHES",26,INK,true,36);
        unlockList=column();page.addView(unlockList,block(7));
        Button share=button("↗ SHARE A READ-ONLY LOCAL SUMMARY",ROSE);
        share.setOnClickListener(v->{
            OrchardLedger.Snapshot s=OrchardLedger.snapshot(this);
            Intent send=new Intent(Intent.ACTION_SEND);
            send.setType("text/plain");
            send.putExtra(Intent.EXTRA_TEXT,"My HUMKIN listening orchard: level "+s.level+
               ", "+s.owned.size()+" local curiosities, "+s.totalMs/60000L+
               " minutes actually heard. Explore the public orchard: https://humkin.abundent.org/fm/orchard/ . This is a summary, not a trade.");
            startActivity(Intent.createChooser(send,"Share the little listening world"));
        });
        page.addView(share,block(12));
        add(page,"LOCAL ARTIFACTS ARE NOT MONEY, GLOBALLY UNIQUE TOKENS, OR TRANSFERABLE TRADES. THE NATIVE AND WEB ORCHARDS SAVE SEPARATELY. REAL GHoT NODE TASKS AND SECURE TRADES ARE FUTURE WORK.",10,0xff735868,true,20);
    }
    private void update(boolean rebuild){
        OrchardLedger.Snapshot s=OrchardLedger.snapshot(this);
        SignalRpg.Snapshot radio=SignalRpg.snapshot(this);
        balance.setText(s.hum+" HUM");
        level.setText("LEVEL "+s.level+" · GARDEN "+(s.stage+1)+"/7");
        minutes.setText((s.totalMs/60000L)+" MIN HEARD");
        collectCount.setText(s.owned.size()+" OBJECTS");
        status.setText((radio.onAir?"ON AIR · THE RECORD IS SPINNING":"RADIO IDLE · NO LISTENING HUM WHILE PAUSED")+
            "    /    NATIVE LOCAL SAVE");
        scene.update(s,radio.onAir);
        workButton.setEnabled(!auditBusy&&s.level>=4);
        if(s.level<4)workStatus.setText("The voluntary local workbench unlocks at level 4.");
        else if(!s.hash.isEmpty())workStatus.setText("LAST LOCAL RECEIPT · "+s.workDay+
            " · "+s.receipts+" RECORDS · SHA-256 "+s.hash.substring(0,12)+"…");
        else workStatus.setText("Ready to inspect a tiny public catalog. Click to opt in.");
        if(rebuild||lastCount!=s.owned.size()){
            if(lastCount>=0&&s.owned.size()>lastCount)say("THE CABINET GREW · ANOTHER OBJECT WAS FOUND.");
            lastCount=s.owned.size();
            drawCollection(s);drawShop(s);drawUnlocks(s);
        }
    }
    private void drawShop(OrchardLedger.Snapshot s){
        shopList.removeAllViews();
        for(OrchardLedger.Spec item:OrchardLedger.SHOP){
            LinearLayout box=card(shopList,0xfffff9ef,11);
            LinearLayout horizontal=row();
            TextView glyph=text(item.icon+" ",31,INK,false);
            horizontal.addView(glyph,new LinearLayout.LayoutParams(dp(52),-2));
            LinearLayout detail=column();
            add(detail,item.name,17,INK,true,0);
            add(detail,item.lore,11,0xff806678,false,4);
            horizontal.addView(detail,new LinearLayout.LayoutParams(0,-2,1f));
            box.addView(horizontal,block(0));
            Button b=button(s.owned.contains(item.id)?"✳ OWNED":s.level<item.level?
                "LOCKED · LEVEL "+item.level:"BUY · "+item.price+" HUM",MINT);
            b.setEnabled(!s.owned.contains(item.id)&&s.level>=item.level&&s.hum>=item.price);
            b.setOnClickListener(v->{
                if(OrchardLedger.buy(this,item.id)){
                    say(item.name+" joined the little collection.");
                    update(true);
                }else say("Not enough HUM, or not unlocked yet.");
            });
            box.addView(b,block(10));
        }
    }
    private void drawCollection(OrchardLedger.Snapshot s){
        collectionList.removeAllViews();
        if(s.owned.isEmpty()){
            LinearLayout box=card(collectionList,0xfffff9ef,0);
            add(box,"THE CABINET IS EMPTY. THE SHOP IS OPEN.",14,INK,true,0);
            return;
        }
        for(OrchardLedger.Spec object:OrchardLedger.SHOP)if(s.owned.contains(object.id))
            addOwned(object,s);
        for(OrchardLedger.Spec object:OrchardLedger.RARE)if(s.owned.contains(object.id))
            addOwned(object,s);
    }
    private void addOwned(OrchardLedger.Spec object,OrchardLedger.Snapshot s){
        LinearLayout item=card(collectionList,0xfffef3e5,10);
        add(item,object.icon+"  "+object.name,17,INK,true,0);
        add(item,object.lore,12,INK,false,7);
        int occupied=-1;
        for(int i=0;i<8;i++)if(object.id.equals(s.placed[i]))occupied=i;
        final boolean isPlaced=occupied>=0;
        Button b=button(isPlaced?"✳ STOW FROM ROOM":"↗ PLACE IN "+(object.outdoors?"ORCHARD":"ROOM"),ROSE);
        b.setOnClickListener(v->{
            if(isPlaced)OrchardLedger.stow(this,object.id);
            else{
                OrchardLedger.Snapshot now=OrchardLedger.snapshot(this);
                int start=object.outdoors?4:0,free=-1;
                for(int i=start;i<start+4;i++)if(now.placed[i].isEmpty()){free=i;break;}
                if(free<0)free=start+(slotCursor++%4);
                OrchardLedger.place(this,object.id,free);
            }
            update(true);
        });
        item.addView(b,block(10));
    }
    private void drawUnlocks(OrchardLedger.Snapshot s){
        unlockList.removeAllViews();
        String[][] f={
            {"1","Listening room and native HUM","READY"},
            {"2","Growing trees and listening discoveries","READY"},
            {"4","Voluntary local catalog workbench","READY"},
            {"5","Visit other people's live orchards","BUILDING"},
            {"6","Account-backed artifact trades","BUILDING"},
            {"7","Opt-in GHoT peer work","BUILDING"},
            {"8","Shared community orchard","BUILDING"}
        };
        for(String[] part:f){
            LinearLayout box=card(unlockList,0xfff5e6df,7);
            add(box,"LEVEL "+part[0]+"  /  "+part[1],13,INK,true,0);
            boolean ready=part[2].equals("READY");
            add(box,ready?(s.level>=Integer.parseInt(part[0])?"✳ UNLOCKED":"LOCKED · KEEP LISTENING"):
                "BUILDING · NOT YET A LIVE SERVER FEATURE",10,0xff84516d,true,5);
        }
    }

    /**
     * This is explicitly a SHARE OF A DECORATIVE PROJECTION, never migration of
     * the native SignalRpg wallet or an authority claim about listened time.
     */
    private void openNetwork(boolean includeSnapshot){
        Uri.Builder link=Uri.parse("https://humkin.abundent.org/fm/orchard/network.html").buildUpon();
        if(includeSnapshot){
            try{
                OrchardLedger.Snapshot state=OrchardLedger.snapshot(this);
                JSONObject values=new JSONObject();
                values.put("v",1);
                values.put("room","Native Listening Room");
                values.put("stage",state.stage);
                values.put("minutes",Math.min(100000,state.totalMs/60000L));
                JSONArray things=new JSONArray();
                int count=0;
                for(OrchardLedger.Spec object:OrchardLedger.SHOP)
                    if(state.owned.contains(object.id)&&count++<24)things.put(object.id);
                for(OrchardLedger.Spec object:OrchardLedger.RARE)
                    if(state.owned.contains(object.id)&&count++<24)things.put(object.id);
                values.put("things",things);
                String encoded=Base64.encodeToString(
                    values.toString().getBytes(StandardCharsets.UTF_8),
                    Base64.URL_SAFE|Base64.NO_PADDING|Base64.NO_WRAP);
                link.appendQueryParameter("native",encoded);
            }catch(Exception e){
                say("Couldn't prepare the public scene preview.");return;
            }
        }
        try{startActivity(new Intent(Intent.ACTION_VIEW,link.build()));}
        catch(Exception e){say("No browser was available for the living network.");}
    }

    private void runWork(){
        if(auditBusy)return;
        OrchardLedger.Snapshot s=OrchardLedger.snapshot(this);
        if(s.level<4){say("Level 4 opens the bench.");return;}
        if(SignalRpg.chicagoDay(System.currentTimeMillis()).equals(s.workDay)){
            say("Today's local catalog receipt already exists.");return;
        }
        Intent battery=registerReceiver(null,new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        if(battery!=null){
            int level=battery.getIntExtra(BatteryManager.EXTRA_LEVEL,-1);
            int scale=battery.getIntExtra(BatteryManager.EXTRA_SCALE,100);
            int plugged=battery.getIntExtra(BatteryManager.EXTRA_PLUGGED,0);
            if(level>=0&&scale>0&&plugged==0&&(level*100/scale)<25){
                say("Battery below 25%. Keeping the Little Engine off.");return;
            }
        }
        auditBusy=true;workButton.setEnabled(false);
        workStatus.setText("Local work accepted · checking the published manifest...");
        workThread=new Thread(()->{
            String error=null,hash="";int count=0;
            HttpURLConnection connection=null;
            try{
                URL target=new URL("https://humkin.abundent.org/fm/rotation.json");
                connection=(HttpURLConnection)target.openConnection();
                connection.setConnectTimeout(8000);connection.setReadTimeout(8000);
                connection.setRequestProperty("Accept","application/json");
                if(connection.getResponseCode()!=200)throw new Exception("Catalog endpoint unavailable.");
                try(InputStream in=connection.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){
                    byte[] data=new byte[2048];int size,total=0;
                    while((size=in.read(data))!=-1){
                        if(Thread.currentThread().isInterrupted())throw new InterruptedException();
                        total+=size;if(total>100000)throw new Exception("Catalog exceeds the work limit.");
                        out.write(data,0,size);
                    }
                    byte[] bytes=out.toByteArray();
                    JSONObject catalog=new JSONObject(new String(bytes,StandardCharsets.UTF_8));
                    JSONArray tracks=catalog.getJSONArray("tracks");
                    count=tracks.length();
                    if(count<1||count>1000)throw new Exception("Catalog size invalid.");
                    Set<String> seen=new HashSet<>();
                    for(int i=0;i<count;i++){
                        JSONObject track=tracks.getJSONObject(i);
                        String id=track.getString("id"),title=track.getString("title");
                        URL media=new URL(target,track.getString("src"));
                        if(id.isEmpty()||title.isEmpty()||!seen.add(id)||
                           !media.getHost().equalsIgnoreCase(target.getHost())||
                           !media.getProtocol().equals("https"))
                           throw new Exception("Catalog has a duplicate or invalid media path.");
                    }
                    byte[] digest=MessageDigest.getInstance("SHA-256").digest(bytes);
                    StringBuilder hex=new StringBuilder();
                    for(byte b:digest)hex.append(String.format(java.util.Locale.US,"%02x",b&255));
                    hash=hex.toString();
                }
            }catch(Exception e){error=e instanceof InterruptedException?"Cancelled.":e.getMessage();}
            finally{if(connection!=null)connection.disconnect();}
            final String resultHash=hash,fail=error;final int countTracks=count;
            handler.post(()->{
                auditBusy=false;
                if(isFinishing()||isDestroyed())return;
                if(fail!=null){workStatus.setText("WORK HELD · "+fail);update(false);return;}
                boolean rewarded=OrchardLedger.recordLocalAudit(this,resultHash,countTracks);
                update(true);
                workStatus.setText(rewarded?
                    "LOCAL CHECK COMPLETE · "+countTracks+" entries · +28 HUM · spool in cabinet. NOT a network receipt.":
                    "This local day already has a receipt; no new reward.");
                if(rewarded)say("THE LITTLE ENGINE WORKED.");
            });
        },"humkin-local-catalog-audit");
        workThread.start();
    }
}
