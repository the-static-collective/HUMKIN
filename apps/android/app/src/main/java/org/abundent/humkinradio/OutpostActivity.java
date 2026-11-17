package org.abundent.humkinradio;

import android.app.Activity;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

/**
 * The Outpost is a native idle-RPG layer around the actual radio—not a pretend
 * stream. The Media3 service alone earns listening XP. Once it stops, the game
 * pauses. Local game currency cannot buy Top 42 plays or standings.
 */
public final class OutpostActivity extends Activity {
    // Disabled until these systems offer meaningful, station-linked actions.
    // Keep underlying XP, discoveries, unlocked activities and reports intact.
    private static final boolean SHOW_EXPERIMENTAL_PANELS=false;
    private final Handler refreshHandler=new Handler(Looper.getMainLooper());
    private final Runnable refreshTick=new Runnable() {
        @Override public void run() {
            drawState();
            refreshHandler.postDelayed(this,3500L);
        }
    };

    private TextView levelText,rankText,chapterText,experienceText;
    private TextView statusText,accountText,discoverText,shiftText;
    private TextView cacheText,cacheRateText,cacheCapacityText;
    private ProgressBar experienceBar,cacheBar;
    private final TextView[] moduleHeads=new TextView[3];
    private final TextView[] moduleNotes=new TextView[3];
    private final Button[] moduleButtons=new Button[3];
    private final Button[] featureButtons=new Button[SignalFeatures.DOORS.length];
    private final View[] featureCards=new View[SignalFeatures.DOORS.length];
    private final TextView[] dailyProgress=new TextView[3];
    private final Button[] dailyButtons=new Button[3];
    private TextView missionTitle,missionDescription,missionProgress,achievementText,chronicleText;
    private LinearLayout missionChoices,missionActive;
    private Button missionClaim,claimCache;
    private LinearLayout discoveryBoard;
    private TextView milestoneProgress;
    private TextView nightWatchStatus,nightWatchDetails;
    private Button nightWatchButton;
    private String expandedWatchId="";
    private int lastMilestoneStage=-1;
    private OutpostMapView map;
    private ScrollView scroll;

    private int dp(float x){return HumkinVisuals.dp(this,x);}
    private LinearLayout vertical(){
        LinearLayout layout=new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.START);
        return layout;
    }
    private LinearLayout horizontal(){
        LinearLayout layout=new LinearLayout(this);
        layout.setOrientation(LinearLayout.HORIZONTAL);
        layout.setGravity(Gravity.CENTER_VERTICAL);
        return layout;
    }
    private LinearLayout.LayoutParams full(int top){
        LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);
        p.topMargin=dp(top);return p;
    }
    private TextView text(String string,int size,int color,boolean bold){
        TextView v=HumkinVisuals.text(this,string,size,color,bold);
        v.setGravity(Gravity.START);
        return v;
    }
    private TextView add(LinearLayout parent,String string,int size,int color,boolean bold,int top){
        TextView view=text(string,size,color,bold);
        parent.addView(view,full(top));
        return view;
    }
    private TextView eyebrow(LinearLayout parent,String value,int top,int color) {
        TextView t=add(parent,value,10,color,true,top);
        t.setLetterSpacing(.10f);
        return t;
    }
    private Button pill(String value,int color,int size) {
        Button b=HumkinVisuals.pill(this,value,null,color,size,false);
        b.setMinHeight(dp(45));b.setMaxLines(3);
        return b;
    }
    private LinearLayout card(LinearLayout parent,int fill,int top){
        LinearLayout box=vertical();
        box.setPadding(dp(17),dp(17),dp(17),dp(17));
        GradientDrawable shape=HumkinVisuals.shape(this,fill,10);
        shape.setStroke(dp(2),HumkinVisuals.INK);
        box.setBackground(shape);
        box.setElevation(dp(3));
        parent.addView(box,full(top));
        return box;
    }
    private View rule(LinearLayout parent,int top){
        View r=new View(this);r.setBackgroundColor(0xffd6bfd3);
        LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,dp(1));
        p.topMargin=dp(top);parent.addView(r,p);
        return r;
    }
    private ProgressBar meter(LinearLayout parent,int top,int color) {
        ProgressBar bar=new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);
        bar.setMax(100);bar.setProgress(0);
        bar.setProgressTintList(ColorStateList.valueOf(color));
        bar.setProgressBackgroundTintList(ColorStateList.valueOf(0xffd6c4d4));
        LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,dp(11));
        p.topMargin=dp(top);parent.addView(bar,p);
        return bar;
    }
    private String minutes(long ms){
        long total=ms/60_000L;
        return total>=60 ? (total/60)+"h "+(total%60)+"m" : total+"m";
    }

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        getWindow().setStatusBarColor(HumkinVisuals.CREAM);
        getWindow().setNavigationBarColor(HumkinVisuals.CREAM);
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR|View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        buildScreen();
        drawState();
    }
    @Override protected void onResume() {
        super.onResume();
        refreshHandler.removeCallbacks(refreshTick);
        refreshHandler.post(refreshTick);
    }
    @Override protected void onPause() {
        refreshHandler.removeCallbacks(refreshTick);
        super.onPause();
    }
    private void league(){
        SignalRpg.visitLeague(this);
        drawState();
        startActivity(new Intent(this,LeagueActivity.class));
    }
    private void radio(){finish();}
    private void announce(String message){
        Toast.makeText(this,message,Toast.LENGTH_SHORT).show();
        drawState();
    }

    private void buildScreen() {
        scroll=new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setVerticalScrollBarEnabled(false);
        scroll.setBackgroundColor(HumkinVisuals.CREAM);
        FrameLayout frame=new FrameLayout(this);
        scroll.addView(frame);
        int width=getResources().getConfiguration().screenWidthDp;
        LinearLayout page=vertical();
        frame.addView(page,new FrameLayout.LayoutParams(dp(Math.min(width,520)),-2,
            Gravity.TOP|Gravity.CENTER_HORIZONTAL));

        // Two doors, one station: no bottom-bar labyrinth.
        LinearLayout top=horizontal();
        top.setPadding(dp(12),dp(10),dp(12),dp(10));
        top.setBackgroundColor(HumkinVisuals.INK);
        Button back=pill("← RADIO",HumkinVisuals.CREAM,12);
        back.setOnClickListener(v->radio());
        top.addView(back,new LinearLayout.LayoutParams(dp(108),dp(48)));
        TextView topper=text("✳  THE OUTPOST",14,HumkinVisuals.YELLOW,true);
        topper.setGravity(Gravity.CENTER);
        top.addView(topper,new LinearLayout.LayoutParams(0,-2,1f));
        Button chart=pill("TOP 42 ↗",HumkinVisuals.MINT,12);
        chart.setOnClickListener(v->league());
        top.addView(chart,new LinearLayout.LayoutParams(dp(99),dp(48)));
        page.addView(top,new LinearLayout.LayoutParams(-1,-2));

        LinearLayout hero=vertical();
        hero.setPadding(dp(20),dp(30),dp(20),dp(18));
        hero.setBackgroundColor(HumkinVisuals.INK);
        eyebrow(hero,"HUMKIN RADIO  /  A GAME THAT HAPPENS WHILE YOU LISTEN",0,HumkinVisuals.YELLOW);
        add(hero,"THE SIGNAL\nOUTPOST.",44,HumkinVisuals.WHITE,true,12);
        add(hero,"Your tiny station at the edge of the known dial.",14,HumkinVisuals.YELLOW,false,11);
        statusText=add(hero,"○ THE RECEIVER IS QUIET",11,HumkinVisuals.WHITE,true,15);
        page.addView(hero,full(0));

        LinearLayout world=vertical();
        world.setPadding(dp(15),dp(16),dp(15),0);
        map=new OutpostMapView(this);
        map.setContentDescription("Illustrated radio-tower map. More relay sites unlock at higher levels.");
        LinearLayout.LayoutParams mapParams=new LinearLayout.LayoutParams(-1,dp(196));
        world.addView(map,mapParams);
        page.addView(world,full(0));

        LinearLayout body=vertical();
        body.setPadding(dp(15),dp(8),dp(15),dp(38));
        page.addView(body,full(0));

        // Character sheet; ranks unlock further world sites.
        LinearLayout profile=card(body,0xfffffdf6,10);
        eyebrow(profile,"YOUR STATION PERSONNEL FILE",0,HumkinVisuals.PLUM);
        LinearLayout persona=horizontal();
        levelText=text("LVL 01",31,HumkinVisuals.INK,true);
        persona.addView(levelText,new LinearLayout.LayoutParams(0,-2,1f));
        rankText=text("NEW ARRIVAL",12,HumkinVisuals.PLUM,true);
        rankText.setGravity(Gravity.END|Gravity.CENTER_VERTICAL);
        persona.addView(rankText,new LinearLayout.LayoutParams(0,-2,1f));
        profile.addView(persona,full(7));
        chapterText=add(profile,"THE BASEMENT BOOTH",15,HumkinVisuals.INK,true,5);
        experienceText=add(profile,"0 / 40 EXPERIENCE",10,HumkinVisuals.PLUM,true,13);
        experienceBar=meter(profile,6,HumkinVisuals.PINK);
        LinearLayout stats=horizontal();
        accountText=text("0 SIGNAL IN THE BANK",11,HumkinVisuals.INK,true);
        stats.addView(accountText,new LinearLayout.LayoutParams(0,-2,1f));
        discoverText=text("0 DISCOVERED",11,HumkinVisuals.PLUM,true);
        discoverText.setGravity(Gravity.END);
        stats.addView(discoverText,new LinearLayout.LayoutParams(0,-2,1f));
        profile.addView(stats,full(13));

        // Progressively revealed worlds live inside the actual Outpost, never
        // as a crowded first-launch strip on the main radio receiver.
        if(SHOW_EXPERIMENTAL_PANELS){
            discoveryBoard=vertical();
            body.addView(discoveryBoard,full(14));
        }

        // The service remembers only actual audible progress. Keep this one
        // small optional ticket ahead of the game dashboards.
        if(SHOW_EXPERIMENTAL_PANELS){
        LinearLayout watch=card(body,0xfff6e8cf,13);
        eyebrow(watch,"THE NIGHT WATCH  /  LOCAL RECEIPT",0,HumkinVisuals.PLUM);
        add(watch,"WHAT THE DIAL REMEMBERS.",22,HumkinVisuals.INK,true,6);
        nightWatchStatus=add(watch,"A report forms from real listening.",12,HumkinVisuals.INK,false,7);
        nightWatchButton=pill("REPORT NOT READY",HumkinVisuals.MINT,12);
        nightWatchButton.setOnClickListener(v->{
            NativeNightWatch.Report report=NativeNightWatch.latest(this);
            if(report==null)return;
            if(report.id.equals(expandedWatchId)
                    &&nightWatchDetails.getVisibility()==View.VISIBLE){
                expandedWatchId="";
                nightWatchDetails.setVisibility(View.GONE);
            }else{
                expandedWatchId=report.id;
                nightWatchDetails.setVisibility(View.VISIBLE);
                if(!report.ongoing)NativeNightWatch.markRead(this,report.id);
            }
            drawState();
        });
        watch.addView(nightWatchButton,full(10));
        nightWatchDetails=add(watch,"",12,HumkinVisuals.INK,false,10);
        nightWatchDetails.setVisibility(View.GONE);
        }

        // The signature idle loop: music charges a capacitor while you are away
        // from this page; you choose when to cash out and upgrade the station.
        LinearLayout vault=card(body,HumkinVisuals.MINT,16);
        eyebrow(vault,"THE CAPACITOR  /  COLLECTION READY",0,HumkinVisuals.PLUM);
        cacheText=add(vault,"0 SIGNAL",34,HumkinVisuals.INK,true,7);
        cacheCapacityText=add(vault,"0 / 120 STORAGE",11,HumkinVisuals.PLUM,true,0);
        cacheBar=meter(vault,9,HumkinVisuals.INK);
        cacheRateText=add(vault,"Your radio earns signal only while a song is actually playing.",12,HumkinVisuals.INK,false,12);
        claimCache=pill("✳ COLLECT SIGNAL",HumkinVisuals.YELLOW,17);
        claimCache.setOnClickListener(v->{
            int collected=SignalRpg.collect(this);
            announce(collected>0?"Recovered "+collected+" SIGNAL.":"The capacitor is empty. Play a few songs!");
        });
        vault.addView(claimCache,full(13));

        eyebrow(body,"02 / MAKE THE TOWER BETTER",23,HumkinVisuals.PLUM);
        add(body,"THE WORKSHOP",28,HumkinVisuals.INK,true,6);
        add(body,"Each upgrade improves what the station earns from real listening. "+
            "New activities will arrive when there is something real to do.",12,HumkinVisuals.PLUM,false,5);
        String[] moduleNames={"THE ANTENNA","THE TAPE ARCHIVE","THE NIGHT CREW"};
        String[] moduleDesc={
            "Stronger signal from each half-minute of actual music.",
            "More experience from listening. Discoveries remain unique.",
            "Help the transmitter scavenge; expand capacitor storage."
        };
        for(int i=0;i<3;i++){
            final int module=i;
            LinearLayout panel=card(body,0xfffffdf6,11);
            eyebrow(panel,"WORKSHOP  /  "+String.format(java.util.Locale.US,"%02d",i+1),0,HumkinVisuals.PLUM);
            LinearLayout info=horizontal();
            LinearLayout labels=vertical();
            moduleHeads[i]=add(labels,moduleNames[i],19,HumkinVisuals.INK,true,6);
            add(labels,moduleDesc[i],12,HumkinVisuals.PLUM,false,5);
            moduleNotes[i]=add(labels,"LVL 0 / 9",11,HumkinVisuals.PLUM,true,8);
            info.addView(labels,new LinearLayout.LayoutParams(0,-2,1f));
            moduleButtons[i]=pill("UPGRADE",i==0?HumkinVisuals.YELLOW:
                i==1?HumkinVisuals.PINK:HumkinVisuals.MINT,12);
            moduleButtons[i].setOnClickListener(v->{
                SignalRpg.Snapshot before=SignalRpg.snapshot(this);
                int old=module==0?before.tower:module==1?before.archive:before.crew;
                if(SignalRpg.upgrade(this,module)){
                    java.util.List<SignalFeatures.Door> newDoors=
                        SignalFeatures.justUnlocked(module,old,old+1);
                    if(SHOW_EXPERIMENTAL_PANELS && !newDoors.isEmpty())
                        announce("UNLOCKED: "+newDoors.get(0).title+"! A new desk is operational.");
                    else announce("Workshop upgraded. Your station produces more from actual listening.");
                }else announce("Not enough SIGNAL. Collect more from the capacitor.");
            });
            LinearLayout.LayoutParams action=new LinearLayout.LayoutParams(dp(116),dp(69));
            action.leftMargin=dp(10);
            info.addView(moduleButtons[i],action);
            panel.addView(info,full(3));
        }

        // A visible capability tree with actual interaction screens, not
        // cosmetic level-up text. Unimplemented doors remain honest previews.
        if(SHOW_EXPERIMENTAL_PANELS){
        eyebrow(body,"04 / REPAIR THE STATION, CHANGE WHAT YOU CAN DO",30,HumkinVisuals.PLUM);
        add(body,"THE UNLOCK BOARD",30,HumkinVisuals.INK,true,6);
        add(body,"The board unfolds as each workshop department improves. "+
            "You won't see every mystery at the beginning.",
            12,HumkinVisuals.PLUM,false,7);
        String[] departments={"ANTENNA","TAPE ARCHIVE","NIGHT CREW"};
        for(int i=0;i<SignalFeatures.DOORS.length;i++){
            SignalFeatures.Door door=SignalFeatures.DOORS[i];
            LinearLayout card=card(body,door.implemented?0xfffffdf6:0xffeee7ec,11);
            featureCards[i]=card;
            eyebrow(card,departments[door.module]+"  /  TIER "+door.tier+
                (door.implemented?"  /  READY TO UNLOCK":"  /  FUTURE PROJECT"),
                0,HumkinVisuals.PLUM);
            LinearLayout detail=horizontal();
            LinearLayout info=vertical();
            add(info,door.title,17,HumkinVisuals.INK,true,5);
            add(info,door.description,12,HumkinVisuals.PLUM,false,6);
            detail.addView(info,new LinearLayout.LayoutParams(0,-2,1f));
            final String mode=door.id;
            Button open=pill("LOCKED",door.implemented?HumkinVisuals.MINT:HumkinVisuals.BLUSH,12);
            if(door.implemented)open.setOnClickListener(v->{
                SignalRpg.Snapshot snapshot=SignalRpg.snapshot(this);
                if(!SignalFeatures.unlocked(door,snapshot.tower,snapshot.archive,snapshot.crew)){
                    announce("Upgrade "+departments[door.module]+" to tier "+door.tier+" first.");
                    return;
                }
                startActivity(new Intent(this,FieldDeskActivity.class)
                    .putExtra("ability",mode));
            });
            featureButtons[i]=open;
            LinearLayout.LayoutParams action=
                new LinearLayout.LayoutParams(dp(98),dp(55));
            action.leftMargin=dp(9);
            detail.addView(open,action);
            card.addView(detail,full(7));
        }
        }

        eyebrow(body,"03 / REAL LISTENING CHALLENGES",23,HumkinVisuals.PLUM);
        add(body,"FIELD MISSIONS",29,HumkinVisuals.INK,true,7);
        add(body,"Pick a listening challenge. Progress counts only while actual music plays.",12,HumkinVisuals.PLUM,false,6);
        LinearLayout expeditions=card(body,0xffeee0ec,12);
        missionChoices=vertical();
        String[] missions={"STAY TUNED  /  8 MINUTES",
                "HEAR FOUR DIFFERENT SONGS",
                "THE LONG NIGHT  /  25 MINUTES (LEVEL 4)"};
        for(int i=0;i<3;i++){
            final int id=i;
            Button button=pill(missions[i],i==1?HumkinVisuals.MINT:HumkinVisuals.YELLOW,12);
            button.setOnClickListener(v->{
                if(SignalRpg.startMission(this,id))announce("Challenge started. Keep listening.");
                else announce("This challenge is locked or one is already active.");
            });
            button.setTag("mission"+i);
            missionChoices.addView(button,full(i==0?0:8));
        }
        expeditions.addView(missionChoices,full(0));
        missionActive=vertical();
        eyebrow(missionActive,"YOUR CURRENT LISTENING CHALLENGE",0,HumkinVisuals.PLUM);
        missionTitle=add(missionActive,"NOW IN PROGRESS",23,HumkinVisuals.INK,true,5);
        missionDescription=add(missionActive,"",13,HumkinVisuals.PLUM,false,6);
        missionProgress=add(missionActive,"",14,HumkinVisuals.INK,true,10);
        missionClaim=pill("CLAIM EXPEDITION",HumkinVisuals.YELLOW,15);
        missionClaim.setOnClickListener(v->{
            if(SignalRpg.claimMission(this))announce("Listening challenge complete. Signal collected.");
            else announce("Not finished yet. Keep listening.");
        });
        missionActive.addView(missionClaim,full(13));
        expeditions.addView(missionActive,full(0));

        eyebrow(body,"04 / TODAY ON THE RADIO",23,HumkinVisuals.PLUM);
        add(body,"TODAY'S ORDERS",29,HumkinVisuals.INK,true,5);
        LinearLayout orders=card(body,0xfffffdf6,11);
        String[] assignments={"TAKE A FOUR-MINUTE SHIFT","HEAR THREE DIFFERENT SONGS","SCOUT THE TOP 42 BOARD"};
        String[] rewards={"+40 SIGNAL · +15 XP","+50 SIGNAL · +25 XP","+25 SIGNAL · +12 XP"};
        for(int i=0;i<3;i++){
            final int mission=i;
            if(i>0)rule(orders,10);
            LinearLayout row=horizontal();
            LinearLayout info=vertical();
            add(info,assignments[i],13,HumkinVisuals.INK,true,10);
            add(info,rewards[i],11,HumkinVisuals.PLUM,false,5);
            dailyProgress[i]=add(info,"0 / 1",11,HumkinVisuals.PLUM,true,4);
            row.addView(info,new LinearLayout.LayoutParams(0,-2,1f));
            dailyButtons[i]=pill("CLAIM",HumkinVisuals.PINK,12);
            dailyButtons[i].setOnClickListener(v->{
                if(SignalRpg.claimDaily(this,mission))announce("Assignment complete. The Outpost remembers.");
                else announce("Not ready yet. That's all right.");
            });
            LinearLayout.LayoutParams size=new LinearLayout.LayoutParams(dp(86),dp(50));
            size.leftMargin=dp(6);
            row.addView(dailyButtons[i],size);
            orders.addView(row,full(1));
        }
        shiftText=add(orders,"SHIFTS RESET AT CENTRAL TIME MIDNIGHT",10,HumkinVisuals.PLUM,true,14);

        // No trophy cabinet, fake notices, faux locked doors or oversized
        // secondary dashboards on the receiver. Their data and real station
        // destinations remain available elsewhere for future integrations.
        if(SHOW_EXPERIMENTAL_PANELS){
        eyebrow(body,"07 / YOUR TROPHY CABINET",28,HumkinVisuals.PLUM);
        add(body,"WALL OF ODDITIES",29,HumkinVisuals.INK,true,5);
        LinearLayout trophy=card(body,0xfffffdf6,11);
        achievementText=add(trophy,"The shelf is still empty.",12,HumkinVisuals.INK,true,0);
        add(trophy,"Nothing here changes the public song charts. They're your own little radio stories.",11,HumkinVisuals.PLUM,false,10);

        eyebrow(body,"08 / THE OFFICE OF QUESTIONABLE NOTICES",28,HumkinVisuals.PLUM);
        add(body,"THE NIGHT DESK",29,HumkinVisuals.INK,true,5);
        LinearLayout desk=card(body,0xffeee0ec,11);
        eyebrow(desk,"LOCAL EVENT LOG  /  THE COMMITTEE IS AWAY",0,HumkinVisuals.PLUM);
        chronicleText=add(desk,"No reports filed yet. Suspicious.",13,HumkinVisuals.INK,false,12);
        add(desk,"Reports are generated from your actual discoveries, upgrades and crew returns. "+
            "Nobody's broadcasts or points are fictionalized.",11,HumkinVisuals.PLUM,false,12);

        // Joining the station is a real capability: the Guild Desk accepts
        // authenticated-by-evidence work, not purchased public chart plays.
        LinearLayout stationGuild=card(body,HumkinVisuals.MINT,25);
        eyebrow(stationGuild,"10 / THE STATION IS ACTUALLY HERE",0,HumkinVisuals.PLUM);
        add(stationGuild,"THE STATION GUILDS",29,HumkinVisuals.INK,true,8);
        add(stationGuild,"Put the radio to work. Submit an original bumper, music video, song, script, honest street-team post, or unused server for actual review. "+
                "Accepted contributions can earn VERIFIED HUM on a separate station ledger.",
                13,HumkinVisuals.INK,false,9);
        Button guildEntry=pill("OPEN REAL-WORLD MISSIONS ↗",HumkinVisuals.YELLOW,15);
        guildEntry.setOnClickListener(v->startActivity(new Intent(this,GuildActivity.class)));
        stationGuild.addView(guildEntry,full(14));

        LinearLayout leagueCard=card(body,HumkinVisuals.YELLOW,25);
        eyebrow(leagueCard,"09 / YOUR OTHER GAME IS RUNNING",0,HumkinVisuals.PLUM);
        add(leagueCard,"THE TOP 42",32,HumkinVisuals.INK,true,8);
        add(leagueCard,"Your listening helps the real station chart. Make EPs, draft weekly albums, and champion the songs you love.",13,HumkinVisuals.INK,false,6);
        Button open=pill("OPEN THE RECORD LEAGUE ↗",HumkinVisuals.MINT,15);
        open.setOnClickListener(v->league());
        leagueCard.addView(open,full(14));

        }
        add(body,"Station Signal is a local listening game—not money or public chart plays. "+
            "Progress comes from actual audio, never from opening this screen.",
            11,HumkinVisuals.PLUM,false,20);
        setContentView(scroll);
    }

    private void paintMilestones(SignalRpg.Snapshot state) {
        int stage=OutpostMilestones.stage(state.level);
        if(discoveryBoard==null)return;
        if(lastMilestoneStage!=stage){
            lastMilestoneStage=stage;
            discoveryBoard.removeAllViews();
            eyebrow(discoveryBoard,"02 / THE NEXT PART OF THE STATION",2,HumkinVisuals.PLUM);
            add(discoveryBoard,"THE DISCOVERY BOARD",27,HumkinVisuals.INK,true,5);
            add(discoveryBoard,"Something new opens as your actual listening experience grows. The ordinary radio is yours from the first moment.",12,HumkinVisuals.PLUM,false,5);

            if(stage==0){
                LinearLayout sealed=card(discoveryBoard,0xffede4ee,12);
                eyebrow(sealed,"SEALED / THE FIRST GREEN SIGNAL",0,HumkinVisuals.PLUM);
                add(sealed,"SOMETHING IS TAKING ROOT.",20,HumkinVisuals.INK,true,7);
                add(sealed,"The signal can grow more than a tower. Keep listening until Level 4, then return to find what opened.",12,HumkinVisuals.PLUM,false,8);
                milestoneProgress=add(sealed,"LEVEL 4 / WORK IN PROGRESS",11,HumkinVisuals.INK,true,11);
            }else{
                LinearLayout orchard=card(discoveryBoard,0xffd7e8ce,12);
                eyebrow(orchard,"NEW WORLD / UNLOCKED AT LEVEL 4",0,HumkinVisuals.PLUM);
                add(orchard,"THE LISTENING ORCHARD.",21,HumkinVisuals.INK,true,8);
                add(orchard,"A garden and a room that grow as the radio plays. Find, collect and arrange peculiar things.",12,HumkinVisuals.INK,false,6);
                Button enterOrchard=pill("✳ ENTER THE ORCHARD ↗",HumkinVisuals.YELLOW,14);
                enterOrchard.setOnClickListener(v->openMilestone(OutpostMilestones.ORCHARD));
                orchard.addView(enterOrchard,full(11));

                if(stage==1){
                    LinearLayout sealed=card(discoveryBoard,0xffede4ee,10);
                    eyebrow(sealed,"SEALED / THE LONG-RANGE STATION",0,HumkinVisuals.PLUM);
                    add(sealed,"A FREQUENCY WITH NO OWNER.",19,HumkinVisuals.INK,true,6);
                    add(sealed,"The tower hears other listeners now. At Level 7, find out how to answer them.",12,HumkinVisuals.PLUM,false,7);
                    milestoneProgress=add(sealed,"LEVEL 7 / WORK IN PROGRESS",11,HumkinVisuals.INK,true,11);
                }else{
                    LinearLayout bootleg=card(discoveryBoard,0xffffe6af,10);
                    eyebrow(bootleg,"NEW FREQUENCY / UNLOCKED AT LEVEL 7",0,HumkinVisuals.PLUM);
                    add(bootleg,"BOOTLEG FREQUENCY.",22,HumkinVisuals.INK,true,7);
                    add(bootleg,"Tune your own native radio by the songs that gave you hope, brought tears, made you laugh or stayed with you. Mix your ears with the whole listener room.",12,HumkinVisuals.INK,false,7);
                    Button go=pill("✳ BUILD YOUR FREQUENCY ↗",HumkinVisuals.MINT,15);
                    go.setOnClickListener(v->openMilestone(OutpostMilestones.BOOTLEG));
                    bootleg.addView(go,full(11));
                    milestoneProgress=null;
                }
            }
        }
        String next=OutpostMilestones.nextDoor(state.level);
        if(milestoneProgress!=null&&!next.isEmpty()){
            int level=OutpostMilestones.requiredLevel(next);
            int needed=OutpostMilestones.remainingXp(next,state.xp);
            milestoneProgress.setText("LV "+state.level+" / NEXT DOOR: LV "+level
                    +"  ·  "+needed+" XP UNTIL THE SIGNAL OPENS");
        }
    }
    private void openMilestone(String door){
        SignalRpg.Snapshot state=SignalRpg.snapshot(this);
        if(!OutpostMilestones.unlocked(door,state.level)){
            announce("The next door opens at Outpost level "
                +OutpostMilestones.requiredLevel(door)+".");
            return;
        }
        if(OutpostMilestones.ORCHARD.equals(door)){
            startActivity(new Intent(this,OrchardActivity.class));
        }else if(OutpostMilestones.BOOTLEG.equals(door)){
            startActivity(new Intent(this,PirateRadioActivity.class));
        }
    }

    private void drawState() {
        if(levelText==null)return;
        SignalRpg.Snapshot s=SignalRpg.snapshot(this);
        levelText.setText("LEVEL "+s.level);
        rankText.setText(s.rank);
        chapterText.setText(s.chapter+"  /  SECTOR "+(1+(s.level>=4?1:0)+(s.level>=7?1:0)+(s.level>=11?1:0)));
        paintMilestones(s);
        paintNightWatch();
        int lower=SignalMath.levelFloor(s.level);
        int upper=SignalMath.levelFloor(s.level+1);
        experienceText.setText(s.xp+" XP  /  NEXT LEVEL AT "+upper);
        experienceBar.setProgress(Math.min(100,
            (int)(100L*(s.xp-lower)/Math.max(1,upper-lower))));
        statusText.setText(s.onAir?"● ON AIR  /  YOUR STATION IS GROWING":
            "○ STANDBY  /  PLAY THE RADIO TO EARN");
        map.update(s.level,s.onAir);
        accountText.setText(s.wallet+" SIGNAL IN THE BANK");
        discoverText.setText(s.discovered+" DISCOVERED");
        cacheText.setText(s.capacitor+" SIGNAL");
        cacheCapacityText.setText(s.capacitor+" / "+s.capacity+" CAPACITOR STORAGE");
        cacheBar.setProgress(Math.min(100,100*s.capacitor/Math.max(1,s.capacity)));
        cacheRateText.setText("+"+SignalMath.signalPerPulse(s.tower,s.crew)+
            " SIGNAL AND +"+SignalMath.experiencePerPulse(s.archive)+
            " XP EVERY 30s OF REAL PLAYBACK.   "+
            (s.onAir?"THE DIAL IS WORKING.":"TUNE INTO THE RADIO TO FILL IT."));
        claimCache.setEnabled(s.capacitor>0);
        int[] ranks={s.tower,s.archive,s.crew};
        String[] effects={
            "+"+SignalMath.signalPerPulse(s.tower,s.crew)+" SIGNAL / PULSE",
            "+"+SignalMath.experiencePerPulse(s.archive)+" XP / PULSE",
            s.capacity+" CAPACITOR CAPACITY"
        };
        for(int i=0;i<3;i++){
            int tier=ranks[i];
            int price=SignalMath.upgradeCost(i,tier);
            moduleNotes[i].setText("LEVEL "+tier+" / 9   ·   "+effects[i]);
            moduleButtons[i].setText(tier>=SignalMath.MAX_MODULE?"MAXED":
                "UPGRADE\n"+price+" SIGNAL");
            moduleButtons[i].setEnabled(tier<SignalMath.MAX_MODULE&&s.wallet>=price);
        }
        for(int i=0;i<SignalFeatures.DOORS.length;i++){
            SignalFeatures.Door door=SignalFeatures.DOORS[i];
            Button button=featureButtons[i];
            if(button==null)continue;
            boolean enabled=SignalFeatures.unlocked(door,s.tower,s.archive,s.crew);
            button.setEnabled(enabled);
            button.setText(!door.implemented?"PLANNED":enabled?"✳ OPEN":"LOCKED\nTIER "+door.tier);
            // Reveal the next door in each department, not all nine at once.
            // Existing unlocked skills remain visible forever.
            int ownTier=door.module==0?s.tower:door.module==1?s.archive:s.crew;
            if(featureCards[i]!=null)
                featureCards[i].setVisibility(door.tier<=ownTier+1
                    ?View.VISIBLE:View.GONE);
        }
        missionChoices.setVisibility(s.missionActive?View.GONE:View.VISIBLE);
        missionActive.setVisibility(s.missionActive?View.VISIBLE:View.GONE);
        if(s.missionActive){
            String[] names={"STAY TUNED","FOUR DIFFERENT SONGS","THE LONG NIGHT"};
            missionTitle.setText(names[s.missionId]);
            missionDescription.setText(s.missionId==1?
                "Find four different real recordings. Each must play at least 30 seconds.":
                "Keep any real album, road shuffle or station stream playing.");
            missionProgress.setText(Math.min(s.missionProgress,s.missionTarget)+
                " / "+s.missionTarget+" "+(s.missionId==1?"DISTINCT SONGS":"MINUTES")
                +(s.missionReady()?"  ·  READY TO CLAIM":"  ·  IN PROGRESS"));
            missionClaim.setEnabled(s.missionReady());
            missionClaim.setText(s.missionReady()?
                "CLAIM  +"+SignalMath.missionReward(s.missionId)+" SIGNAL":
                "KEEP LISTENING");
        }
        View nightMission=missionChoices.findViewWithTag("mission2");
        if(nightMission!=null)nightMission.setEnabled(s.level>=4);
        for(int i=0;i<3;i++){
            String progress=i==0?Math.min(4,s.todayMs/60_000L)+" / 4 MINUTES":
                i==1?Math.min(3,s.uniqueToday)+" / 3 SONGS":
                s.chartVisited?"BOARD SCOUTED":"NOT VISITED YET";
            dailyProgress[i].setText(progress);
            dailyButtons[i].setText(s.dailyClaimed(i)?"DONE":s.dailyReady(i)?"CLAIM!":"IN PROGRESS");
            dailyButtons[i].setEnabled(!s.dailyClaimed(i)&&s.dailyReady(i));
        }
        shiftText.setText("TODAY: "+s.day+"  /  "+minutes(s.todayMs)+" LISTENED");
        StringBuilder earned=new StringBuilder();
        badge(earned,s.totalMs>=60_000L,"FIRST CONTACT","One minute across the dial");
        badge(earned,s.discovered>=10,"B-SIDE HUNTER","Ten different recordings discovered");
        badge(earned,s.totalMs>=120L*60_000L,"AFTER HOURS","Two hours of music on the books");
        badge(earned,s.missions>=3,"CREW CHIEF","Three expeditions completed");
        badge(earned,s.level>=10,"TOWER KEEPER","Reached level ten");
        badge(earned,s.chartVisited,"SCOUT'S HONOR","Visited the Top 42");
        if(chronicleText!=null)chronicleText.setText(s.journal);
        if(achievementText!=null)achievementText.setText(earned.length()==0?
            "◌ SIX ODDITIES TO FIND. Your first one is only a minute away.":
            earned.toString());
    }
    private void paintNightWatch(){
        if(nightWatchStatus==null)return;
        NativeNightWatch.Report report=NativeNightWatch.latest(this);
        if(report==null){
            nightWatchStatus.setText("A report opens after five minutes of observed listening. "+
                    "A completed watch follows 30 quiet minutes.");
            nightWatchButton.setText("REPORT NOT READY");
            nightWatchButton.setEnabled(false);
            nightWatchDetails.setVisibility(View.GONE);
            expandedWatchId="";
            return;
        }
        nightWatchStatus.setText(report.brief());
        nightWatchButton.setEnabled(true);
        boolean open=report.id.equals(expandedWatchId)
                &&nightWatchDetails.getVisibility()==View.VISIBLE;
        nightWatchButton.setText(open?"CLOSE REPORT":
                report.unread?"✳ OPEN NEW REPORT":"VIEW WATCH");
        if(open)nightWatchDetails.setText(report.detail());
        else nightWatchDetails.setVisibility(View.GONE);
    }
    private void badge(StringBuilder b,boolean yes,String name,String note){
        if(!yes)return;
        if(b.length()>0)b.append("\n\n");
        b.append("✳ ").append(name).append("\n    ").append(note);
    }
}
