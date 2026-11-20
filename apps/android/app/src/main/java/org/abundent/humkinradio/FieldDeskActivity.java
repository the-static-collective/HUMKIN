package org.abundent.humkinradio;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** One native interaction deck for newly unlocked Outpost abilities.
 * The active HUMKIN Media3 service is never replaced or paused here.
 * No score is fabricated; requests and chart readings come from the API.
 */
public final class FieldDeskActivity extends Activity {
    private final ExecutorService network=Executors.newSingleThreadExecutor();
    private LeagueBridge.Board board;
    private SignalFeatures.Door ability;
    private LinearLayout main,results;
    private TextView status,subtitle;
    private EditText search;
    private int variation=0;
    private boolean saving=false;
    private String searchQuery="";

    private int dp(int x){return HumkinVisuals.dp(this,x);}
    private TextView label(String s,int size,int color,boolean bold){
        TextView t=HumkinVisuals.text(this,s,size,color,bold);
        t.setGravity(Gravity.START);
        t.setMaxLines(6);
        return t;
    }
    private LinearLayout vertical(){
        LinearLayout l=new LinearLayout(this);
        l.setOrientation(LinearLayout.VERTICAL);l.setGravity(Gravity.START);return l;
    }
    private LinearLayout row(){
        LinearLayout l=new LinearLayout(this);
        l.setOrientation(LinearLayout.HORIZONTAL);l.setGravity(Gravity.CENTER_VERTICAL);return l;
    }
    private LinearLayout.LayoutParams full(int top){
        LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);
        p.topMargin=dp(top);return p;
    }
    private TextView add(LinearLayout parent,String s,int size,int color,boolean bold,int top){
        TextView t=label(s,size,color,bold);
        parent.addView(t,full(top));return t;
    }
    private Button button(String text,int color){
        Button b=HumkinVisuals.pill(this,text,null,color,12,false);
        b.setMinHeight(dp(43));b.setMaxLines(3);return b;
    }
    private LinearLayout panel(LinearLayout parent,int color,int top){
        LinearLayout l=vertical();
        l.setPadding(dp(14),dp(13),dp(14),dp(13));
        GradientDrawable box=HumkinVisuals.shape(this,color,10);
        box.setStroke(dp(2),HumkinVisuals.INK);
        l.setBackground(box);parent.addView(l,full(top));return l;
    }
    private void feedback(String value){
        Toast.makeText(this,value,Toast.LENGTH_LONG).show();
        status.setText(value);
    }
    private void share(String text){
        Intent send=new Intent(Intent.ACTION_SEND);
        send.setType("text/plain");
        send.putExtra(Intent.EXTRA_TEXT,text);
        startActivity(Intent.createChooser(send,"Transmit from HUMKIN"));
    }

    @Override public void onCreate(Bundle saved){
        super.onCreate(saved);
        String id=getIntent().getStringExtra("ability");
        ability=SignalFeatures.byId(id);
        SignalRpg.Snapshot profile=SignalRpg.snapshot(this);
        if(ability==null||!SignalFeatures.unlocked(ability,profile.tower,profile.archive,profile.crew)){
            finish();return;
        }
        getWindow().setStatusBarColor(HumkinVisuals.CREAM);
        getWindow().setNavigationBarColor(HumkinVisuals.CREAM);
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR|View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        build();
        fetch();
    }
    private void build(){
        ScrollView scroll=new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setVerticalScrollBarEnabled(false);
        scroll.setBackgroundColor(HumkinVisuals.CREAM);
        FrameLayout frame=new FrameLayout(this);scroll.addView(frame);
        main=vertical();
        int width=getResources().getConfiguration().screenWidthDp;
        frame.addView(main,new FrameLayout.LayoutParams(dp(Math.min(width,520)),-2,
            Gravity.TOP|Gravity.CENTER_HORIZONTAL));
        LinearLayout toolbar=row();
        toolbar.setPadding(dp(12),dp(11),dp(12),dp(11));
        toolbar.setBackgroundColor(HumkinVisuals.INK);
        Button back=button("← OUTPOST",HumkinVisuals.CREAM);
        back.setOnClickListener(v->finish());
        toolbar.addView(back,new LinearLayout.LayoutParams(dp(117),dp(45)));
        TextView heading=label("✳ FIELD DESK",16,HumkinVisuals.YELLOW,true);
        heading.setGravity(Gravity.END|Gravity.CENTER_VERTICAL);
        toolbar.addView(heading,new LinearLayout.LayoutParams(0,-2,1f));
        main.addView(toolbar,full(0));
        LinearLayout hero=vertical();
        hero.setPadding(dp(20),dp(27),dp(20),dp(25));
        hero.setBackgroundColor(HumkinVisuals.INK);
        String[] modules={"ANTENNA","TAPE ARCHIVE","NIGHT CREW"};
        add(hero,"UNLOCKED / "+modules[ability.module]+" · TIER "+ability.tier,
            10,HumkinVisuals.YELLOW,true,0).setLetterSpacing(.1f);
        add(hero,ability.title,35,HumkinVisuals.WHITE,true,11);
        subtitle=add(hero,ability.description,14,HumkinVisuals.YELLOW,false,13);
        main.addView(hero,full(0));
        LinearLayout inner=vertical();inner.setPadding(dp(15),dp(15),dp(15),dp(38));
        main.addView(inner,full(0));
        status=add(inner,"CONTACTING THE STATION…",12,HumkinVisuals.PLUM,true,0);
        search=new EditText(this);
        search.setSingleLine(true);search.setTextSize(16);
        search.setHint("Find a title, artist or album");
        search.setPadding(dp(13),dp(11),dp(13),dp(11));
        search.setBackground(HumkinVisuals.shape(this,0xfffffdf6,8));
        search.addTextChangedListener(new TextWatcher(){
            @Override public void beforeTextChanged(CharSequence s,int a,int count,int after){}
            @Override public void onTextChanged(CharSequence s,int start,int before,int count){
                searchQuery=s.toString().trim().toLowerCase(Locale.ROOT);
                drawResults();
            }
            @Override public void afterTextChanged(Editable e){}
        });
        inner.addView(search,full(13));
        search.setVisibility(View.GONE);
        results=vertical();inner.addView(results,full(10));
        add(inner,"Every song here is from the actual HUMKIN catalog. "+
            "Your local upgrades never buy Top 42 plays or guarantee airplay.",
            11,HumkinVisuals.PLUM,false,20);
        setContentView(scroll);
    }
    private void fetch(){
        network.execute(()->{
            try{
                LeagueBridge.Board snapshot=LeagueBridge.readBoard();
                runOnUiThread(()->{
                    if(isFinishing()||isDestroyed())return;
                    board=snapshot;
                    status.setText("✳ LIVE BOARD  /  "+snapshot.day+
                        "  /  "+snapshot.catalog.size()+" RECORDINGS");
                    drawResults();
                });
            }catch(Exception error){
                runOnUiThread(()->{
                    if(isFinishing()||isDestroyed())return;
                    status.setText("THE FIELD DESK IS OFF THE AIR: "+error.getMessage());
                    results.removeAllViews();
                    Button retry=button("↻ TRY AGAIN",HumkinVisuals.YELLOW);
                    retry.setOnClickListener(v->fetch());results.addView(retry,full(6));
                });
            }
        });
    }
    private void drawResults(){
        if(results==null)return;
        results.removeAllViews();
        if(board==null){add(results,"The switchboard is finding the crate.",14,HumkinVisuals.INK,false,12);return;}
        switch(ability.id){
            case "radar": drawRadar();break;
            case "crate": drawCrate();break;
            case "beacon": drawBeacon();break;
            case "press": drawPress();break;
            case "challenge": drawChallenge();break;
            case "bulletin": drawBulletin();break;
            default:add(results,"This equipment is still in the repair shop.",14,HumkinVisuals.INK,false,9);
        }
    }
    private void headings(String title,String note){
        add(results,title,24,HumkinVisuals.INK,true,7);
        add(results,note,12,HumkinVisuals.PLUM,false,5);
    }
    private void songRow(SignalFeatures.Song song,String context,String action,Runnable click){
        LinearLayout card=panel(results,0xfffffdf6,8);
        LinearLayout horizontal=row();
        LinearLayout labels=vertical();
        add(labels,song.title,16,HumkinVisuals.INK,true,0).setMaxLines(3);
        add(labels,song.album+" · "+context,11,HumkinVisuals.PLUM,false,5);
        horizontal.addView(labels,new LinearLayout.LayoutParams(0,-2,1f));
        if(action!=null){
            Button button=button(action,HumkinVisuals.MINT);
            button.setOnClickListener(v->click.run());
            LinearLayout.LayoutParams right=new LinearLayout.LayoutParams(dp(105),dp(50));
            right.leftMargin=dp(8);
            horizontal.addView(button,right);
        }
        card.addView(horizontal,full(0));
    }
    private boolean match(SignalFeatures.Song song) {
        return searchQuery.isEmpty()||
            (song.title+" "+song.album+" "+song.id)
                .toLowerCase(Locale.ROOT).contains(searchQuery);
    }
    private void drawRadar(){
        search.setVisibility(View.GONE);
        headings("WHO IS MOVING?","Live qualified plays, not imaginary chart positions.");
        if(board.ranked.isEmpty()){
            add(results,"The dial hasn't collected qualified plays today. "+
                "The uncharted crate is wide open.",14,HumkinVisuals.INK,false,12);
        }else{
            for(int i=0;i<Math.min(9,board.ranked.size());i++){
                SignalFeatures.Song song=board.ranked.get(i);
                songRow(song,"#"+(i+1)+" · "+song.plays+" PLAYS ("+
                    song.radio+" RADIO / "+song.playlist+" RECORDS)",null,null);
            }
        }
        headings("THE SLEEPER SECTION",
            "These public recordings have no charted plays today. Scouting is listening, not buying exposure.");
        Set<String> charted=new HashSet<>();
        for(SignalFeatures.Song song:board.ranked)charted.add(song.id);
        List<SignalFeatures.Song> sleeping=new ArrayList<>();
        for(SignalFeatures.Song song:board.catalog)
            if(!charted.contains(song.id)&&!song.released)sleeping.add(song);
        Collections.sort(sleeping,(a,b)->a.id.compareTo(b.id));
        int offset=sleeping.isEmpty()?0:Math.floorMod(board.day.hashCode(),sleeping.size());
        for(int i=0;i<Math.min(8,sleeping.size());i++){
            SignalFeatures.Song song=sleeping.get((offset+i)%sleeping.size());
            boolean canSave=SignalRpg.snapshot(this).archive>=1;
            songRow(song,"RADIO ONLY · UNCHARTED",canSave?"☆ SAVE":null,
                ()->{LeagueBridge.toggleWatch(this,song.id);feedback("Scouting note saved locally.");});
        }
        Button league=button("OPEN THE TOP 42 ↗",HumkinVisuals.YELLOW);
        league.setOnClickListener(v->openLeague(null));
        results.addView(league,full(15));
    }
    private void drawCrate(){
        search.setVisibility(View.VISIBLE);
        Set<String> saved=LeagueBridge.watched(this);
        headings("THE SCOUT'S CRATE",saved.size()+" / 42 SAVED RECORDINGS · LOCAL ONLY");
        add(results,"Keep a private shortlist of overlooked songs. The Little Press "+
            "can later arrange these into a playable EP.",12,HumkinVisuals.PLUM,false,5);
        List<SignalFeatures.Song> tracks=new ArrayList<>(board.catalog);
        Collections.sort(tracks,(a,b)->{
            if(saved.contains(a.id)!=saved.contains(b.id))return saved.contains(a.id)?-1:1;
            if(a.plays!=b.plays)return Integer.compare(a.plays,b.plays);
            return a.title.compareToIgnoreCase(b.title);
        });
        int shown=0;
        for(SignalFeatures.Song song:tracks){
            if(!match(song))continue;
            if(++shown>65)break;
            boolean on=saved.contains(song.id);
            songRow(song,(on?"IN YOUR CRATE · ":"")+
                (song.released?"RELEASED":"RADIO ONLY")+" · "+song.plays+" CHART POINTS",
                on?"★ SAVED":"☆ WATCH",
                ()->{
                    if(!LeagueBridge.watched(this).contains(song.id)&&LeagueBridge.watched(this).size()>=42){
                        feedback("The crate holds 42 recordings. Remove one to make room.");return;
                    }
                    LeagueBridge.toggleWatch(this,song.id);drawResults();
                });
        }
        if(shown==0)add(results,"Nothing on the dial matches that search.",13,HumkinVisuals.PLUM,false,12);
    }
    private void drawBeacon(){
        search.setVisibility(View.VISIBLE);
        boolean sent=LeagueBridge.beaconSent(this,board.day);
        headings("THE REQUEST BEACON",board.requestCount+" NOMINATIONS ON THE PUBLIC BOARD");
        add(results,"File ONE song nomination for this Central-time day. "+
            "Requests do not generate chart points or automatically change the radio.",12,
            HumkinVisuals.PLUM,false,7);
        if(sent){
            add(results,"✳ YOUR REQUEST IS FILED. THE DESK REOPENS TOMORROW.",
                14,HumkinVisuals.INK,true,15);
        }
        if(!board.requests.isEmpty()){
            add(results,"CURRENT REQUESTS",13,HumkinVisuals.INK,true,20);
            for(int i=0;i<Math.min(6,board.requests.size());i++){
                LeagueBridge.Request request=board.requests.get(i);
                add(results,(i+1)+". "+request.title+" · "+request.nominations+" REQUEST"+
                    (request.nominations==1?"":"S"),13,HumkinVisuals.PLUM,true,9);
            }
        }
        add(results,"CHOOSE A SONG",19,HumkinVisuals.INK,true,23);
        List<SignalFeatures.Song> options=new ArrayList<>(board.catalog);
        options.sort((a,b)->a.title.compareToIgnoreCase(b.title));
        int shown=0;
        for(SignalFeatures.Song song:options){
            if(!match(song))continue;
            if(++shown>55)break;
            songRow(song,song.released?"RELEASED":"RADIO ONLY",
                sent?"FILED":"REQUEST",()->confirmBeacon(song));
        }
    }
    private void confirmBeacon(SignalFeatures.Song song) {
        if(saving||LeagueBridge.beaconSent(this,board.day)){
            feedback("You've already sent today's request.");return;
        }
        new AlertDialog.Builder(this)
            .setTitle("REQUEST "+song.title+"?")
            .setMessage("One nomination per day. This will appear on the public Request Desk. "+
                "It does not create a chart play or guarantee a spin.")
            .setNegativeButton("NOT YET",null)
            .setPositiveButton("TRANSMIT",(dialog,which)->{
                if(saving)return;
                saving=true;status.setText("SENDING "+song.title+"…");
                network.execute(()->{
                    try{
                        String result=LeagueBridge.sendBeacon(this,song.id,board.day);
                        runOnUiThread(()->{
                            if(isFinishing()||isDestroyed())return;
                            saving=false;feedback(result);fetch();
                        });
                    }catch(Exception error){
                        runOnUiThread(()->{
                            if(isFinishing()||isDestroyed())return;
                            saving=false;feedback(error.getMessage());
                        });
                    }
                });
            }).show();
    }
    private void drawPress(){
        search.setVisibility(View.GONE);
        Set<String> saved=LeagueBridge.watched(this);
        headings("THE LITTLE PRESS","REAL SONGS. YOUR RECORD. A SIX-TRACK EP.");
        add(results,"An actual draft assistant: it prefers recordings you saved, "+
            "then low-charted sleeper material. You can still edit the order and title on the site.",
            13,HumkinVisuals.PLUM,false,8);
        List<SignalFeatures.Song> proposed=SignalFeatures.proposeEp(board.catalog,saved,variation);
        if(proposed.size()!=6){
            add(results,"The available crate needs four radio-only and two released songs. "+
                "The Press will open when the catalog has enough.",13,HumkinVisuals.INK,false,12);return;
        }
        for(int i=0;i<proposed.size();i++){
            SignalFeatures.Song song=proposed.get(i);
            songRow(song,(i<4?"RADIO ONLY":"RELEASED")+" · "+song.plays+" POINTS",null,null);
        }
        Button reroll=button("↻ REROLL THE CAST",HumkinVisuals.PINK);
        reroll.setOnClickListener(v->{variation++;drawResults();});
        Button press=button("✳ LOAD THIS EP INTO THE RECORD LEAGUE",HumkinVisuals.YELLOW);
        press.setOnClickListener(v->{
            List<String> ids=new ArrayList<>();
            for(SignalFeatures.Song song:proposed)ids.add(song.id);
            openLeague(String.join(",",ids));
        });
        results.addView(reroll,full(16));results.addView(press,full(10));
        add(results,"Your draft opens in the real Top 42 EP builder. You decide "+
            "whether to release it. This does not award automatic plays.",
            12,HumkinVisuals.PLUM,false,11);
    }
    private void drawChallenge(){
        search.setVisibility(View.GONE);
        headings("FIELD CHALLENGE GENERATOR",
            "The night crew chooses a listening assignment. You recruit the witnesses.");
        List<SignalFeatures.Song> pool=new ArrayList<>();
        for(SignalFeatures.Song song:board.catalog)
            if(!song.released&&song.plays==0)pool.add(song);
        if(pool.size()<3)pool=new ArrayList<>(board.catalog);
        pool.sort((a,b)->a.id.compareTo(b.id));
        if(pool.size()<3){add(results,"No three-track challenge available.",14,
            HumkinVisuals.PLUM,false,11);return;}
        int start=Math.floorMod((board.day+variation).hashCode(),pool.size());
        List<SignalFeatures.Song> chosen=new ArrayList<>();
        for(int i=0;i<3;i++){
            SignalFeatures.Song song=pool.get((start+i)%pool.size());
            chosen.add(song);songRow(song,"SCOUTING ASSIGNMENT "+(i+1),null,null);
        }
        Button reroll=button("↻ REASSIGN THE NIGHT CREW",HumkinVisuals.MINT);
        reroll.setOnClickListener(v->{variation++;drawResults();});
        Button send=button("SEND THE CHALLENGE ↗",HumkinVisuals.YELLOW);
        send.setOnClickListener(v->share(
            "HUMKIN NIGHT CREW / FIELD CHALLENGE\n"+
            "Three recordings have wandered off the dial. Find them and listen:\n"+
            "1. "+chosen.get(0).title+"\n"+
            "2. "+chosen.get(1).title+"\n"+
            "3. "+chosen.get(2).title+"\n"+
            "https://humkin.abundent.org/fm/top42/\n"+
            "No rewards promised. The music is real. The crew is fictional."));
        results.addView(reroll,full(16));results.addView(send,full(10));
    }
    private void drawBulletin(){
        search.setVisibility(View.GONE);
        headings("THE NIGHT EDITOR","Actual standings. Completely excessive official concern.");
        String line1=board.ranked.isEmpty()?
            "No song has accumulated a qualifying play today. Leadership is stunned by the silence.":
            board.ranked.get(0).title+" currently leads the daily Top 42 with "+
                board.ranked.get(0).plays+" verified-by-ledger, client-reported plays.";
        String line2=board.requests.isEmpty()?
            "The Request Desk has received no nominations. The filing cabinet is relieved.":
            board.requests.get(0).title+" leads the Request Desk with "+
                board.requests.get(0).nominations+" nomination(s). Requests do not buy airtime.";
        String dispatch="HUMKIN RADIO / THE NIGHT EDITOR / "+board.day+"\n\n"+
            line1+"\n\n"+line2+"\n\n"+
            "When asked whether this constitutes a crisis, the committee said it isn't a committee.\n\n"+
            "THE TOP 42 — https://humkin.abundent.org/fm/top42/\n"+
            "All statistics are from the public station board as retrieved. Not an actual broadcast.";
        LinearLayout paper=panel(results,0xfffffdf6,16);
        add(paper,dispatch,15,HumkinVisuals.INK,false,0).setMaxLines(30);
        Button send=button("↗ SHARE THE BULLETIN",HumkinVisuals.YELLOW);
        send.setOnClickListener(v->share(dispatch));
        results.addView(send,full(15));
        add(results,"This is a draft share card, not an automatically aired news bulletin. "+
            "Audio Sports Desk integration is a future station upgrade.",12,
            HumkinVisuals.PLUM,false,10);
    }
    private void openLeague(String draftIds){
        SignalRpg.visitLeague(this);
        Intent open=new Intent(this,LeagueActivity.class);
        if(draftIds!=null)open.putExtra("seed_tracks",draftIds);
        startActivity(open);
    }
    @Override protected void onDestroy(){
        network.shutdownNow();super.onDestroy();
    }
}
