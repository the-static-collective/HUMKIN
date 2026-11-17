package org.abundent.humkinradio;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ComponentName;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.HapticFeedbackConstants;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.media3.common.MediaItem;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;
import com.google.common.util.concurrent.ListenableFuture;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * ORCHARD-GRAFT-001: the first little orchard action with an audible consequence.
 *
 * Choose two authorized, published songs -> press a two-song, repeating local
 * listening tape into the existing Media3 service. This changes what the
 * listener actually hears. The result is not pretend produce, a chart vote,
 * broadcast submission, global artifact, or an XP/HUM grant.
 */
public final class GraftTapeActivity extends Activity {
    private static final int INK=0xff241b32, CREAM=0xfffff6e8,
            GOLD=0xffffdc83, MINT=0xffb9d9b3, ROSE=0xffe6b7bd;
    private static final int MENU_LIMIT=240;

    private final ExecutorService network=Executors.newSingleThreadExecutor();
    private final Handler ui=new Handler(Looper.getMainLooper());
    private MediaController controller;
    private ListenableFuture<MediaController> controllerFuture;
    private RadioCatalog.Station station;
    private List<PirateSelector.Song> catalog=Collections.emptyList();
    private boolean foreground,loading,busy;
    private String aId="",bId="";
    private TextView status,receipt,sideAText,sideBText;
    private Button aButton,bButton,pressButton,surpriseButton,replayButton;
    private Runnable pendingCheck;

    private int dp(int n){return HumkinVisuals.dp(this,n);}
    private LinearLayout column(){LinearLayout result=new LinearLayout(this);result.setOrientation(LinearLayout.VERTICAL);return result;}
    private LinearLayout.LayoutParams below(int n){LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.topMargin=dp(n);return p;}
    private TextView label(LinearLayout parent,String value,int size,int color,boolean bold,int top){
        TextView t=HumkinVisuals.text(this,value,size,color,bold);
        t.setGravity(Gravity.START);
        parent.addView(t,below(top));return t;
    }
    private Button button(String title,int color,int size){
        Button b=HumkinVisuals.pill(this,title,null,color,size,false);
        b.setAllCaps(false);b.setMinHeight(dp(49));
        return b;
    }
    private LinearLayout box(LinearLayout parent,int color,int top){
        LinearLayout b=column();b.setPadding(dp(17),dp(16),dp(17),dp(18));
        b.setBackground(HumkinVisuals.panel(this,color,INK,9));
        parent.addView(b,below(top));return b;
    }
    @Override public void onCreate(Bundle state){
        super.onCreate(state);
        if(!OutpostMilestones.unlocked(OutpostMilestones.ORCHARD,SignalRpg.snapshot(this).level)){
            Toast.makeText(this,"The grafting bench opens at Outpost level 4.",Toast.LENGTH_LONG).show();
            finish();return;
        }
        try{
            SkillTreeKernel.State gate=SkillTreeBridge.current(this).get("orchard.graft");
            if(gate==null || !"AVAILABLE".equals(gate.status)){
                Toast.makeText(this,"The grafting bench is still sealed.",Toast.LENGTH_LONG).show();
                finish();return;
            }
        }catch(Exception error){
            Toast.makeText(this,"The skill tree could not be verified on this installation.",Toast.LENGTH_LONG).show();
            finish();return;
        }
        getWindow().setStatusBarColor(INK);
        getWindow().setNavigationBarColor(CREAM);
        build();
        load();
    }

    private void build(){
        ScrollView scroll=new ScrollView(this);
        scroll.setFillViewport(true);scroll.setBackgroundColor(CREAM);
        LinearLayout page=column();page.setPadding(dp(16),dp(15),dp(16),dp(30));
        scroll.addView(page);
        Button back=button("← THE ORCHARD",CREAM,12);
        back.setOnClickListener(v->finish());
        page.addView(back,below(0));

        LinearLayout intro=box(page,INK,12);
        label(intro,"THE UNREASONABLE AGRICULTURE DEPARTMENT",10,GOLD,true,0);
        label(intro,"GRAFT A\nLITTLE TAPE",34,CREAM,true,9);
        label(intro,"Take two real records. Put them together. Hear something that did not exist in that order before.",14,CREAM,false,12);
        label(intro,"NOT A NEW SONG. A NEW LISTENING EXPERIENCE.",11,GOLD,true,11);

        LinearLayout seeds=box(page,0xffffedcf,15);
        label(seeds,"SIDE A · WHAT IS ALREADY GROWING?",11,INK,true,0);
        sideAText=label(seeds,"Selecting a published record…",20,INK,true,7);
        aButton=button("CHOOSE THE FIRST RECORD",GOLD,14);
        aButton.setOnClickListener(v->choose(true));seeds.addView(aButton,below(9));

        label(seeds,"SIDE B · WHAT HAPPENS BESIDE IT?",11,INK,true,21);
        sideBText=label(seeds,"Another record is coming…",20,INK,true,7);
        bButton=button("CHOOSE THE NEXT RECORD",ROSE,14);
        bButton.setOnClickListener(v->choose(false));seeds.addView(bButton,below(9));

        surpriseButton=button("✳ CROSS-POLLINATE · FIND A STRANGE PAIR",MINT,14);
        surpriseButton.setOnClickListener(v->surprise());
        seeds.addView(surpriseButton,below(21));

        LinearLayout output=box(page,0xffdce8df,15);
        label(output,"THE PHYSICAL RESULT",11,INK,true,0);
        label(output,"Press the tape and these two records replace your phone's current listening queue. The media player really changes. The pair loops until you retune the regular radio.",14,INK,false,10);
        pressButton=button("▶ PRESS TAPE · CHANGE WHAT YOU HEAR",GOLD,16);
        pressButton.setOnClickListener(v->pressTape());
        output.addView(pressButton,below(16));
        replayButton=button("↻ REPLAY LAST CONFIRMED GRAFT",MINT,13);
        replayButton.setOnClickListener(v->replay());
        output.addView(replayButton,below(9));
        status=label(output,"Checking for approved radio recordings…",13,INK,true,14);

        LinearLayout note=box(page,0xfff6e4df,14);
        label(note,"A LITTLE BIT OF EVIDENCE",11,INK,true,0);
        receipt=label(note,"No local tape receipt yet.",13,INK,false,8);
        label(note,"A receipt means the native player accepted the changed queue. It does not prove audible minutes, create HUM or score chart plays. Your station can always return to regular radio.",11,INK,false,15);
        label(page,"EXPERIMENT 001 · NO SERVER ACCOUNT · NO MODAL · NO R2",10,INK,true,17);
        setContentView(scroll);
        refresh();
    }

    private void load(){
        if(loading)return;
        loading=true;refresh();
        network.execute(()->{
            RadioCatalog.Station loaded=null;
            String error=null;
            try{loaded=RadioCatalog.loadStation();}
            catch(Exception e){error=e.getMessage();}
            RadioCatalog.Station found=loaded;
            String failure=error;
            runOnUiThread(()->{
                if(isFinishing()||isDestroyed())return;
                loading=false;
                if(found==null){
                    status.setText("The official catalog could not load: "+(failure==null?"offline":failure)+". The normal radio is unaffected.");
                    refresh();return;
                }
                List<PirateSelector.Song> list=found.pirateCatalog();
                if(list.size()<2){
                    status.setText("Not enough published, selectable songs for a two-record graft.");
                    refresh();return;
                }
                station=found;catalog=list;
                GraftTapeStore.Snapshot saved=GraftTapeStore.snapshot(this);
                GraftTape.Tape kept=GraftTape.compose(catalog,saved.firstId,saved.secondId);
                if(kept!=null){aId=kept.firstId;bId=kept.secondId;}
                else{
                    String currentId=controller==null || controller.getCurrentMediaItem()==null?
                            "" : controller.getCurrentMediaItem().mediaId;
                    GraftTape.Tape start=GraftTape.surprise(catalog,currentId,System.nanoTime());
                    if(start!=null){aId=start.firstId;bId=start.secondId;}
                }
                refresh();
            });
        });
    }

    private PirateSelector.Song byId(String id){
        for(PirateSelector.Song song:catalog)if(song.id.equals(id))return song;
        return null;
    }
    private void refresh(){
        boolean ready=station!=null && catalog.size()>=2;
        aButton.setEnabled(ready&&!busy);
        bButton.setEnabled(ready&&!busy);
        surpriseButton.setEnabled(ready&&!busy);
        GraftTape.Tape tape=ready?GraftTape.compose(catalog,aId,bId):null;
        pressButton.setEnabled(tape!=null&&!busy&&controller!=null);
        GraftTapeStore.Snapshot saved=GraftTapeStore.snapshot(this);
        replayButton.setEnabled(ready&&!busy&&controller!=null&&
                GraftTape.compose(catalog,saved.firstId,saved.secondId)!=null);
        PirateSelector.Song first=byId(aId),second=byId(bId);
        sideAText.setText(first==null?"—":first.title);
        sideBText.setText(second==null?"—":second.title);
        if(busy)status.setText("Rewiring the local receiver…");
        else if(ready && controller==null)status.setText(catalog.size()+" published songs ready. Connecting to the native player…");
        else if(ready)status.setText(catalog.size()+" published songs available. Your current program changes only when you press tape.");
        else if(!loading && station==null && !status.getText().toString().startsWith("The official catalog") &&
                !status.getText().toString().startsWith("Not enough"))
            status.setText("Station library unavailable. Try reopening this room online.");
        if(saved.hasTape()){
            receipt.setText("CONFIRMED LOCAL QUEUE CHANGES  "+saved.queuedCount+
                    "\nLAST GRAFT ID  "+(saved.fingerprint.length()>=16?saved.fingerprint.substring(0,16):saved.fingerprint)+
                    "…\nReplay uses the current, owner-published catalog; removed records are never resurrected.");
        }
    }

    private void choose(boolean sideA){
        if(catalog.size()<2||busy)return;
        List<PirateSelector.Song> ordered=new ArrayList<>(catalog);
        ordered.sort(Comparator.comparing(s->s.title.toLowerCase(java.util.Locale.ROOT)));
        if(ordered.size()>MENU_LIMIT)ordered=new ArrayList<>(ordered.subList(0,MENU_LIMIT));
        final List<PirateSelector.Song> options=ordered;
        String[] names=new String[options.size()];
        for(int i=0;i<options.size();i++)names[i]=options.get(i).title;
        new AlertDialog.Builder(this)
                .setTitle(sideA?"SIDE A · FIRST RECORD":"SIDE B · SECOND RECORD")
                .setItems(names,(dialog,which)->{
                    String choice=options.get(which).id;
                    if((sideA && choice.equals(bId))||(!sideA && choice.equals(aId))){
                        Toast.makeText(this,"A graft needs two different records.",Toast.LENGTH_SHORT).show();
                        return;
                    }
                    if(sideA)aId=choice;else bId=choice;
                    refresh();
                })
                .setNegativeButton("CANCEL",null).show();
    }

    private void surprise(){
        GraftTape.Tape result=GraftTape.surprise(catalog,aId,System.nanoTime());
        if(result!=null){
            aId=result.firstId;bId=result.secondId;
            refresh();
            surpriseButton.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY);
        }
    }

    private void replay(){
        GraftTapeStore.Snapshot saved=GraftTapeStore.snapshot(this);
        GraftTape.Tape tape=GraftTape.compose(catalog,saved.firstId,saved.secondId);
        if(tape==null){
            Toast.makeText(this,"That recording is no longer on the approved station.",Toast.LENGTH_LONG).show();
            return;
        }
        aId=tape.firstId;bId=tape.secondId;
        pressTape();
    }

    private void pressTape(){
        if(busy || station==null || controller==null)return;
        final GraftTape.Tape tape=GraftTape.compose(catalog,aId,bId);
        if(tape==null)return;
        final List<MediaItem> pair=station.queueFromIds(Arrays.asList(tape.firstId,tape.secondId));
        if(pair.size()!=2 || !tape.firstId.equals(pair.get(0).mediaId) ||
                !tape.secondId.equals(pair.get(1).mediaId)){
            Toast.makeText(this,"The owner-approved records changed. Reopen the grafting bench.",Toast.LENGTH_LONG).show();
            return;
        }
        busy=true;refresh();
        try{
            // This explicitly leaves shared Same-Time mode. Only this phone's
            // native Media3 queue is replaced; no actual radio program changes.
            RadioPlaybackService.clearSameTime();
            controller.setMediaItems(pair);
            controller.prepare();
            controller.play();
        }catch(Exception e){
            busy=false;refresh();
            status.setText("The local receiver refused the new tape. No reward or receipt was issued.");
            return;
        }
        if(pendingCheck!=null)ui.removeCallbacks(pendingCheck);
        pendingCheck=()->{
            if(!foreground || controller==null){busy=false;return;}
            boolean accepted=controller.getMediaItemCount()==2
                    && tape.firstId.equals(controller.getMediaItemAt(0).mediaId)
                    && tape.secondId.equals(controller.getMediaItemAt(1).mediaId)
                    && controller.getPlayWhenReady();
            busy=false;
            if(accepted){
                int count=GraftTapeStore.recordQueueChanged(this,tape);
                pressButton.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY);
                refresh();
                status.setText("THE SOUND HAS CHANGED. TWO REAL RECORDS NOW OWN YOUR PHONE'S QUEUE. "+ 
                        (controller.isPlaying()?"AUDIBLE PLAYBACK IS ACTIVE.":"PLAYBACK IS STARTING.")+
                        " · GRAFT #"+count);
            }else{
                refresh();
                status.setText("The receiver did not confirm both records. No graft receipt was recorded.");
            }
            pendingCheck=null;
        };
        ui.postDelayed(pendingCheck,750L);
    }

    @Override protected void onStart(){
        super.onStart();foreground=true;
        controllerFuture=new MediaController.Builder(this,new SessionToken(this,
                new ComponentName(this,RadioPlaybackService.class))).buildAsync();
        final ListenableFuture<MediaController> pending=controllerFuture;
        pending.addListener(()->{
            try{
                MediaController connected=pending.get();
                if(!foreground)return;
                controller=connected;refresh();
            }catch(Exception e){
                if(foreground){
                    status.setText("The native receiver is unavailable. Try reopening this room.");
                    refresh();
                }
            }
        },this::runOnUiThread);
    }
    @Override protected void onStop(){
        foreground=false;
        if(pendingCheck!=null){ui.removeCallbacks(pendingCheck);pendingCheck=null;}
        busy=false;
        controller=null;
        if(controllerFuture!=null){MediaController.releaseFuture(controllerFuture);controllerFuture=null;}
        super.onStop();
    }
    @Override protected void onDestroy(){network.shutdownNow();super.onDestroy();}
}
