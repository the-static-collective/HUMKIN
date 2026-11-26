package org.abundent.humkinradio;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ComponentName;
import android.content.Intent;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.Gravity;
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
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * The listener is a little radio tower.
 * Offline-friendly local station composition, made from real published tracks,
 * private song feelings and optional public anonymous Listener Weather.
 * Same Media3 receiver and lock-screen controls as the rest of HUMKIN.
 * Zero WebViews, social accounts, fabricated chart points or FM transmissions.
 */
public final class PirateRadioActivity extends Activity {
    static final String EXTRA_ANCHOR="founding_song";
    private final ExecutorService network=Executors.newSingleThreadExecutor();
    private MediaController controller;
    private ListenableFuture<MediaController> controllerFuture;
    private boolean active,fetching;
    private RadioCatalog.Station station;
    private PirateWeather.Board weather;
    private PirateFrequency.Dial current;
    private List<MediaItem> preview=new ArrayList<>();
    private long entropy=System.currentTimeMillis();
    private String anchor="",incomingAnchor="";
    private Button moodButton,balanceButton,anchorButton,tuneButton,shuffleButton;
    private TextView situation,example,explain,weatherCount;

    private int dp(int size){return HumkinVisuals.dp(this,size);}
    private LinearLayout vertical(){
        LinearLayout parent=new LinearLayout(this);
        parent.setOrientation(LinearLayout.VERTICAL);return parent;
    }
    private LinearLayout.LayoutParams margin(int top){
        LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);
        lp.topMargin=dp(top);return lp;
    }
    private TextView text(String value,int size,int color,boolean bold){
        TextView t=HumkinVisuals.text(this,value,size,color,bold);
        t.setGravity(Gravity.START);
        return t;
    }
    private TextView label(LinearLayout parent,String value,int size,int color,boolean bold,int top){
        TextView view=text(value,size,color,bold);
        parent.addView(view,margin(top));return view;
    }
    private Button button(String text,int color,int size){
        Button b=HumkinVisuals.pill(this,text,null,color,size,false);
        b.setAllCaps(false);
        b.setMinHeight(dp(49));
        b.setMaxLines(3);
        return b;
    }
    @Override public void onCreate(Bundle bundle){
        super.onCreate(bundle);
        if(!OutpostMilestones.unlocked(OutpostMilestones.BOOTLEG,
                SignalRpg.snapshot(this).level)){
            Toast.makeText(this,"Bootleg Frequency opens through Outpost level 7.",
                    Toast.LENGTH_LONG).show();
            finish();return;
        }
        getWindow().setStatusBarColor(HumkinVisuals.INK);
        getWindow().setNavigationBarColor(HumkinVisuals.CREAM);
        current=PirateFrequency.last(this);
        String incoming=SongReactionId.canonical(getIntent().getStringExtra(EXTRA_ANCHOR));
        incomingAnchor=incoming==null?"":incoming;
        anchor=incoming==null?(current.anchor==null?"":current.anchor):incoming;
        current=new PirateFrequency.Dial(current.mood,current.balance,anchor);
        build();
        load();
    }
    private String moodName(){
        for(int i=0;i<PirateSelector.VIBES.length;i++)
            if(PirateSelector.VIBES[i].equals(current.mood))return PirateSelector.NAMES[i];
        return "Surprise me";
    }
    private String blendName(){
        return current.balance==PirateSelector.ME?"MY RECORDS"
                :current.balance==PirateSelector.EVERYBODY?"THE NEIGHBORHOOD":"BOTH SIDES OF THE DIAL";
    }
    private void build(){
        ScrollView scroll=new ScrollView(this);
        scroll.setBackgroundColor(HumkinVisuals.CREAM);
        scroll.setFillViewport(true);
        scroll.setVerticalScrollBarEnabled(false);
        LinearLayout stack=vertical();
        stack.setPadding(dp(16),dp(16),dp(16),dp(33));
        scroll.addView(stack);

        Button back=button("← BACK TO HUMKIN",HumkinVisuals.CREAM,12);
        back.setOnClickListener(v->finish());
        stack.addView(back,margin(0));

        LinearLayout mast=vertical();
        mast.setPadding(dp(18),dp(22),dp(18),dp(24));
        mast.setBackground(HumkinVisuals.panel(this,0xff211b3a,0xff38304f,8));
        label(mast,"✳ THE UNLICENSED IMAGINATION DEPARTMENT",10,HumkinVisuals.YELLOW,true,0);
        label(mast,"BOOTLEG\nFREQUENCY",36,HumkinVisuals.WHITE,true,9);
        label(mast,"BUILD YOUR OWN LITTLE PIECE OF THE DIAL.",12,HumkinVisuals.YELLOW,true,10);
        label(mast,"Not a broadcast tower. A station that follows what the records did to you—and what they did to everybody else.",13,HumkinVisuals.WHITE,false,9);
        stack.addView(mast,margin(11));

        label(stack,"01 / WHAT SHOULD IT FEEL LIKE?",11,HumkinVisuals.PLUM,true,20);
        moodButton=button("",HumkinVisuals.YELLOW,18);
        moodButton.setOnClickListener(v->new AlertDialog.Builder(this)
                .setTitle("WHAT ARE YOU TUNING TOWARD?")
                .setItems(PirateSelector.NAMES,(d,n)->{
                    current=new PirateFrequency.Dial(PirateSelector.VIBES[n],current.balance,anchor);
                    entropy=System.nanoTime();refreshControls();drawPreview();
                }).setNegativeButton("Never mind",null).show());
        stack.addView(moodButton,margin(5));

        label(stack,"02 / WHO'S IN THE CONTROL ROOM?",11,HumkinVisuals.PLUM,true,15);
        balanceButton=button("",HumkinVisuals.MINT,15);
        balanceButton.setOnClickListener(v->{
            current=new PirateFrequency.Dial(current.mood,(current.balance+1)%3,anchor);
            entropy=System.nanoTime();refreshControls();drawPreview();
        });
        stack.addView(balanceButton,margin(4));
        explain=label(stack,"",12,HumkinVisuals.PLUM,false,5);

        label(stack,"03 / THE FIRST RECORD",11,HumkinVisuals.PLUM,true,16);
        anchorButton=button("",HumkinVisuals.CREAM,13);
        anchorButton.setOnClickListener(v->chooseAnchor());
        stack.addView(anchorButton,margin(4));
        label(stack,"Pick a first record from the dial or one of your own remembered songs.",11,HumkinVisuals.PLUM,false,4);

        situation=label(stack,"FINDING THE PUBLISHED RECORDS…",13,HumkinVisuals.INK,true,18);
        weatherCount=label(stack,"",11,HumkinVisuals.PLUM,false,4);

        LinearLayout card=vertical();
        card.setPadding(dp(14),dp(12),dp(14),dp(12));
        card.setBackground(HumkinVisuals.shape(this,0xfffffdf7,9));
        label(card,"A PEEK AT THE NEXT FEW",12,HumkinVisuals.PLUM,true,0);
        example=label(card,"The crates are being brought up from the basement.",14,HumkinVisuals.INK,false,7);
        stack.addView(card,margin(14));

        tuneButton=button("✳  GO ON THE AIR",HumkinVisuals.YELLOW,20);
        tuneButton.setEnabled(false);
        tuneButton.setMinHeight(dp(64));
        tuneButton.setOnClickListener(v->broadcast());
        stack.addView(tuneButton,margin(17));
        shuffleButton=button("↻  ANOTHER TAKE",HumkinVisuals.CREAM,12);
        shuffleButton.setEnabled(false);
        shuffleButton.setOnClickListener(v->{entropy=System.nanoTime();drawPreview();});
        stack.addView(shuffleButton,margin(8));

        label(stack,"Your song responses live on your phone. Only responses you choose to share enter Listener Weather. Community numbers are anonymous self-reports, not verified individuals. This station never purchases, invents or votes in Top 42 chart plays.",11,HumkinVisuals.PLUM,false,20);
        setContentView(scroll);
        refreshControls();
    }
    private void refreshControls(){
        moodButton.setText("♪  "+moodName().toUpperCase()+"  ▾");
        balanceButton.setText("◉  "+blendName()+"  ↻");
        explain.setText(current.balance==PirateSelector.ME
                ?"The music follows your own six song responses. New discoveries are still welcome."
                :current.balance==PirateSelector.EVERYBODY
                ?"The whole listener room whispers its feelings into this mix. Even unheard songs get a chance."
                :"Your feelings meet the room's. Nobody gets to own the dial.");
        String name=anchor;
        if(station!=null&&!anchor.isEmpty()){
            for(PirateSelector.Song song:station.pirateCatalog())
                if(song.id.equals(anchor)){name=song.title;break;}
        }
        anchorButton.setText(anchor.isEmpty()
                ?"FIRST RECORD · LET THE DIAL CHOOSE  ▾"
                :"FIRST RECORD · "+name+"  ▾");
    }
    private void chooseAnchor(){
        List<String> options=new ArrayList<>();
        List<String> ids=new ArrayList<>();
        options.add("◉  Let the dial choose");
        ids.add("");
        if(!incomingAnchor.isEmpty()){
            options.add("♫  Current radio song");
            ids.add(incomingAnchor);
        }
        if(station!=null){
            Map<String,String> mine=SongReactions.snapshot(this);
            Map<String,PirateSelector.Song> byId=new HashMap<>();
            for(PirateSelector.Song song:station.pirateCatalog())
                byId.put(song.id,song);
            int count=0;
            for(Map.Entry<String,String> entry:mine.entrySet()){
                PirateSelector.Song song=byId.get(entry.getKey());
                if(song==null||song.id.equals(incomingAnchor))continue;
                options.add("✳  "+song.title+" · "+SongReactions.phrase(entry.getValue()));
                ids.add(song.id);
                if(++count>=25)break;
            }
        }
        new AlertDialog.Builder(this).setTitle("CHOOSE THE FIRST RECORD")
            .setItems(options.toArray(new String[0]),(dialog,chosen)->{
                anchor=ids.get(chosen);
                current=new PirateFrequency.Dial(current.mood,current.balance,anchor);
                entropy=System.nanoTime();
                refreshControls();drawPreview();
            }).setNegativeButton("Never mind",null).show();
    }
    private void load(){
        if(fetching)return;
        fetching=true;
        network.execute(()->{
            RadioCatalog.Station available=null;
            String problem=null;
            try{available=RadioCatalog.loadStation();}
            catch(Exception error){problem=error.getMessage();}
            PirateWeather.Board signal=PirateWeather.fetch(getApplicationContext());
            final RadioCatalog.Station ready=available;
            final String error=problem;
            runOnUiThread(()->{
                if(!active&&!isFinishing()){
                    // onCreate may finish downloading before onStart; keep data.
                }
                if(isFinishing()||isDestroyed())return;
                fetching=false;
                station=ready;weather=signal;
                if(ready==null){
                    situation.setText("THIS FREQUENCY CAN'T FIND THE MUSIC: "+error);
                    Button retry=tuneButton;
                    retry.setText("↻  TRY THE SIGNAL AGAIN");
                    retry.setEnabled(true);
                    retry.setOnClickListener(v->{retry.setEnabled(false);load();});
                    return;
                }
                situation.setText(ready.pirateCatalog().size()+" PUBLISHED SONGS · YOUR OWN FREQUENCY");
                refreshControls();
                int myWeather=SongReactions.snapshot(this).size();
                weatherCount.setText(myWeather+" PRIVATE SONG MEMORIES · "+
                    (signal.total==0?"NO COMMUNITY RESPONSES YET"
                     :signal.total+" OPT-IN COMMUNITY RESPONSES · "+
                        (signal.live?"LIVE":"CACHED / MAY BE STALE")));
                tuneButton.setEnabled(true);
                shuffleButton.setEnabled(true);
                drawPreview();
            });
        });
    }
    private void drawPreview(){
        if(station==null)return;
        PirateFrequency.Dial dial=new PirateFrequency.Dial(current.mood,current.balance,anchor);
        preview=PirateFrequency.mix(this,station,dial,weather,true,entropy);
        if(preview.isEmpty()){
            example.setText("No published songs are ready for the dial.");
            tuneButton.setEnabled(false);return;
        }
        StringBuilder lines=new StringBuilder();
        int shown=Math.min(preview.size(),5);
        for(int i=0;i<shown;i++){
            MediaItem item=preview.get(i);
            CharSequence title=item.mediaMetadata.title;
            if(i>0)lines.append("\n");
            lines.append(String.format(java.util.Locale.US,"%02d",i+1))
                .append("  ").append(title==null?"HUMKIN":title);
            String id=SongReactionId.canonical(item.mediaId);
            String mine=id==null?null:SongReactions.get(this,id);
            PirateSelector.Weather crowd=id==null||weather==null?null:weather.tracks.get(id);
            if(mine!=null && !PirateSelector.OPEN.equals(current.mood)
                    && current.mood.equals(mine)) {
                lines.append("  ·  YOUR ").append(feelingShort(mine));
            }else if(crowd!=null && !PirateSelector.OPEN.equals(current.mood)
                    && crowd.forMood(current.mood)>0) {
                lines.append("  ·  ROOM ")
                    .append(crowd.forMood(current.mood)).append(" ")
                    .append(feelingShort(current.mood));
            }
        }
        example.setText(lines.toString());
    }
    private String feelingShort(String code) {
        switch(code){
            case "hope":return "HOPE";
            case "tears":return "TEARS";
            case "seen":return "LESS ALONE";
            case "laugh":return "LAUGHTER";
            case "move":return "MOVEMENT";
            case "stayed":return "STAYED";
            default:return "FEELING";
        }
    }
    @Override protected void onStart(){
        super.onStart();active=true;
        controllerFuture=new MediaController.Builder(this,new SessionToken(this,
                new ComponentName(this,RadioPlaybackService.class))).buildAsync();
        controllerFuture.addListener(()->{
            try{
                MediaController c=controllerFuture.get();
                if(!active)return;
                controller=c;
            }catch(Exception ignored){
                if(active)Toast.makeText(this,"Receiver unavailable; try the station again.",Toast.LENGTH_LONG).show();
            }
        },this::runOnUiThread);
    }
    private void broadcast(){
        if(station==null||preview.isEmpty()||controller==null){
            Toast.makeText(this,"The native receiver isn't connected yet.",Toast.LENGTH_LONG).show();
            return;
        }
        PirateFrequency.Dial dial=new PirateFrequency.Dial(current.mood,current.balance,anchor);
        PirateFrequency.save(this,dial);
        RadioPlaybackService.armPirateStation(station,dial,weather);
        controller.setMediaItems(preview);
        controller.prepare();
        controller.play();
        Toast.makeText(this,"BOOTLEG FREQUENCY · NOW ON YOUR PHONE",Toast.LENGTH_SHORT).show();
        finish();
    }
    @Override protected void onStop(){
        active=false;controller=null;
        if(controllerFuture!=null){
            MediaController.releaseFuture(controllerFuture);controllerFuture=null;
        }
        super.onStop();
    }
    @Override protected void onDestroy(){network.shutdownNow();super.onDestroy();}
}
