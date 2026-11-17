package org.abundent.humkinradio;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ComponentName;
import android.content.Intent;
import android.graphics.Typeface;
import android.graphics.Bitmap;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.net.Uri;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;
import org.json.JSONArray;
import org.json.JSONObject;
import androidx.media3.common.MediaItem;
import androidx.media3.common.Player;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;
import com.google.common.util.concurrent.ListenableFuture;
import java.util.List;
import java.util.ArrayList;
import java.util.Map;
import java.util.HashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.abundent.humkinradio.HumkinVisuals.BLUSH;
import static org.abundent.humkinradio.HumkinVisuals.CREAM;
import static org.abundent.humkinradio.HumkinVisuals.INK;
import static org.abundent.humkinradio.HumkinVisuals.MINT;
import static org.abundent.humkinradio.HumkinVisuals.PINK;
import static org.abundent.humkinradio.HumkinVisuals.PLUM;
import static org.abundent.humkinradio.HumkinVisuals.WHITE;
import static org.abundent.humkinradio.HumkinVisuals.YELLOW;
import org.abundent.humkinradio.HumkinVisuals.Icon;

public final class MainActivity extends Activity {
    private final ExecutorService worker=Executors.newFixedThreadPool(3);
    private final ExecutorService coverWorker=Executors.newFixedThreadPool(2);
    private final AtomicBoolean loading=new AtomicBoolean(false);
    private final AtomicBoolean albumRefreshing=new AtomicBoolean(false);
    private MediaController controller;
    private ListenableFuture<MediaController> controllerFuture;
    private TextView nowPlaying, status, albumPlaying, albumState;
    private TextView onDeck, recentlyHeard;
    private String lastRenderedTrackId = "";

    private TextView tagline, albumHeading, playingHeading, playingArtist, featureHeading, featureArtist;
    private ImageView radioArt, featureArt;
    private LinearLayout albumGrid;
    private List<AlbumCatalog.Album> shelfAlbums=AlbumCatalog.builtIn();
    private AlbumCatalog.Album featuredAlbum=AlbumCatalog.EVERYWHERE;
    private final Map<String, Bitmap> coverCache=new HashMap<>();
    private String lastFeatureCoverKey="", lastRadioCoverId="";
    private boolean wideCards, modeStyled;
    private OnBackInvokedCallback albumsBack;
    private Button tune,sameTime,road,albumNext,outpostButton,reactionButton;
    private Button keepRecordButton,keepAlbumButton;
    private TextView humChip,coinBurst;
    private boolean keepDownloading;
    private long lastAwardSeen;
    private final Handler humHandler=new Handler(Looper.getMainLooper());
    private final Runnable humPulse=new Runnable(){
        @Override public void run(){
            if(alive){updateHumStatus();humHandler.postDelayed(this,3500L);}
        }
    };
    private RebelReceiverSkin.Dial receiverDial;
    private boolean warmStaticEnabled;
    private ScrollView scroll;
    private LinearLayout radioScreen,albumsScreen;
    private boolean alive,radioMode=true,onAlbums=false;
    private boolean tuneWhenReady;
    private HumkinVisuals.HumkinWaveform radioWaveform, albumWaveform;
    private String source="none"; // radio | shuffle | album | none
    private String currentAlbum="";

    private final Player.Listener listener=new Player.Listener(){
        @Override public void onEvents(Player player,Player.Events events){redraw();}
    };

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        HumCrashNote.install(getApplicationContext());

        // Remember the listener's dial choice, not the first default station.
        radioMode = getSharedPreferences("humkin-radio", MODE_PRIVATE)
                .getBoolean("last-radio-mode", true);
        if(savedInstanceState!=null){
            radioMode=savedInstanceState.getBoolean("radioMode",radioMode);
            onAlbums=savedInstanceState.getBoolean("onAlbums",false);
            source=savedInstanceState.getString("source","none");
            currentAlbum=savedInstanceState.getString("currentAlbum","");
        }
        if (Build.VERSION.SDK_INT >= 33) albumsBack = () -> showAlbums(false);
        // First Antenna upgrade is the only route to static controls.
        warmStaticEnabled=!SignalRpg.canControlRadioStatic(this) ||
                getSharedPreferences("humkin-radio",MODE_PRIVATE)
                        .getBoolean("analog-static",true);
        RadioPlaybackService.setWarmStaticEnabled(warmStaticEnabled);
        lastAwardSeen=HumServerBridge.snapshot(this).awardSequence;
        buildScreen();
        if (Build.VERSION.SDK_INT >= 35) {
            WindowInsetsController bars = getWindow().getInsetsController();
            int lightAppearance = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                    | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
            if (bars != null) bars.setSystemBarsAppearance(0, lightAppearance);
            scroll.setOnApplyWindowInsetsListener((view, insets) -> {
                android.graphics.Insets system = insets.getInsets(
                        WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                view.setPadding(system.left, system.top, system.right, system.bottom);
                return WindowInsets.CONSUMED;
            });
            scroll.requestApplyInsets();
        } else {
            getWindow().setStatusBarColor(RebelReceiverSkin.NAVY);
            getWindow().setNavigationBarColor(RebelReceiverSkin.NAVY);
            getWindow().getDecorView().setSystemUiVisibility(0);
        }
    }
    @Override public void onSaveInstanceState(Bundle out) {
        out.putBoolean("radioMode",radioMode);
        out.putBoolean("onAlbums",onAlbums);
        out.putString("source",source);
        out.putString("currentAlbum",currentAlbum);
        super.onSaveInstanceState(out);
    }
    private int dp(float size) { return HumkinVisuals.dp(this, size); }

    private TextView text(String value, int size, int color, boolean bold) {
        return HumkinVisuals.text(this, value, size, color, bold);
    }

    private Button pill(String title, Icon icon, int color, int size) {
        return HumkinVisuals.pill(this, title, icon, color, size, false);
    }

    private LinearLayout column() { return HumkinVisuals.vertical(this); }
    private LinearLayout row() { return HumkinVisuals.horizontal(this); }
    private LinearLayout.LayoutParams wrap(int top) { return HumkinVisuals.wrap(this, top); }
    private LinearLayout.LayoutParams flex(int left) { return HumkinVisuals.flex(this, left); }

    private void buildScreen() {
        int width = getResources().getConfiguration().screenWidthDp;
        float fontScale = getResources().getConfiguration().fontScale;
        wideCards = width >= 370 && fontScale <= 1.15f;
        int inset = width < 350 ? 11 : 15;

        scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(RebelReceiverSkin.NAVY);
        scroll.setVerticalScrollBarEnabled(false);
        FrameLayout page = new FrameLayout(this);
        scroll.addView(page);
        LinearLayout outer = column();
        outer.setPadding(0, 0, 0, 0);
        outer.setBackgroundColor(RebelReceiverSkin.NAVY);
        page.addView(outer, new FrameLayout.LayoutParams(dp(Math.min(520, width)), -2,
                Gravity.TOP | Gravity.CENTER_HORIZONTAL));
        addWebHero(outer,width);

        albumHeading = text("ALBUMS / THE RECORD SHELF", 24, INK, true);
        albumHeading.setPadding(dp(inset),dp(12),dp(inset),0);
        albumHeading.setGravity(Gravity.START);
        albumHeading.setBackgroundColor(RebelReceiverSkin.PAPER);
        if (Build.VERSION.SDK_INT >= 28) albumHeading.setAccessibilityHeading(true);
        outer.addView(albumHeading, wrap(0));
        tagline = text("", 16, INK, false);
        HumkinVisuals.italic(tagline);
        tagline.setPadding(dp(inset),dp(8),dp(inset),0);
        tagline.setGravity(Gravity.START);
        tagline.setBackgroundColor(RebelReceiverSkin.PAPER);
        outer.addView(tagline, wrap(0));
        // The player uses the real bundled published album art; ornamental hardware
        // is drawn natively as scalable shapes, not baked-in fake song screenshots.

        radioScreen = column();
        albumsScreen = column();
        radioScreen.setPadding(dp(10), dp(7), dp(10), dp(18));
        radioScreen.setBackgroundColor(RebelReceiverSkin.NAVY);
        radioScreen.setClipChildren(false);
        albumsScreen.setPadding(dp(inset), dp(12), dp(inset), dp(22));
        albumsScreen.setBackgroundColor(RebelReceiverSkin.PAPER);
        outer.addView(radioScreen, wrap(0));
        outer.addView(albumsScreen, wrap(12));
        buildRadio();
        buildAlbums();
        // No concept-art skyline: only published music/album artwork is canon.
        showAlbums(onAlbums);
        setContentView(scroll);
    }

    private void addWebHero(LinearLayout outer, int width) {
        TextView ribbon=text("✳  FREE SOUNDS FROM ANOTHER DIRECTION  ✳",10,RebelReceiverSkin.DARK,true);
        ribbon.setBackgroundColor(RebelReceiverSkin.GOLD);
        ribbon.setMinHeight(dp(27));
        ribbon.setLetterSpacing(.065f);
        outer.addView(ribbon,wrap(0));

        LinearLayout hero=column();
        hero.setPadding(dp(15),dp(13),dp(15),dp(14));
        hero.setBackground(RebelReceiverSkin.plate(this,
                RebelReceiverSkin.NAVY,RebelReceiverSkin.BRASS,17));

        TextView eyebrow=text("THE LITTLE HUMAN TRANSMITTER",10,RebelReceiverSkin.MINT,true);
        eyebrow.setLetterSpacing(.14f);
        hero.addView(eyebrow,wrap(3));

        TextView masthead=text("HUMKIN ✳",width<350?48:58,RebelReceiverSkin.WHITE,true);
        masthead.setLetterSpacing(-.07f);
        masthead.setSingleLine(true);
        masthead.setShadowLayer(dp(1),dp(3),dp(3),RebelReceiverSkin.PEACH);
        if(Build.VERSION.SDK_INT>=28)masthead.setAccessibilityHeading(true);
        hero.addView(masthead,wrap(4));
        TextView rebel=text("RADIO / REBEL    ✳    EST. IN THE FUTURE",11,RebelReceiverSkin.GOLD,true);
        rebel.setLetterSpacing(.06f);
        hero.addView(rebel,wrap(3));
        TextView motto=text("THE AIR BELONGS TO EVERYBODY",10,RebelReceiverSkin.WHITE,true);
        motto.setLetterSpacing(.08f);
        hero.addView(motto,wrap(6));
        RebelReceiverSkin.HeaderFlourish curls=new RebelReceiverSkin.HeaderFlourish(this);
        hero.addView(curls,new LinearLayout.LayoutParams(-1,dp(29)));
        outer.addView(hero,wrap(0));
    }

    private void buildRadio() {
        LinearLayout heading=row();
        TextView badge=text("⚡  THE POCKET RECEIVER",11,RebelReceiverSkin.GOLD,true);
        badge.setGravity(Gravity.START|Gravity.CENTER_VERTICAL);
        badge.setLetterSpacing(.06f);
        heading.addView(badge,new LinearLayout.LayoutParams(0,dp(42),1f));
        humChip=labelHumChip();
        heading.addView(humChip,new LinearLayout.LayoutParams(-2,dp(42)));
        Button more=pill("⋯",null,CREAM,22);
        more.setContentDescription("More radio controls, unlocked signal settings and history");
        more.setMinHeight(dp(42));
        more.setOnClickListener(v->showMoreRadio());
        heading.addView(more,new LinearLayout.LayoutParams(dp(52),dp(42)));
        radioScreen.addView(heading,wrap(0));
        FrameLayout littleCoin=new FrameLayout(this);
        littleCoin.setClipChildren(false);
        littleCoin.setClipToPadding(false);
        coinBurst=text("ⓗ +3 HUM",22,RebelReceiverSkin.GOLD,true);
        coinBurst.setVisibility(View.INVISIBLE);
        coinBurst.setElevation(dp(10));
        FrameLayout.LayoutParams coinPosition=new FrameLayout.LayoutParams(-2,-2,Gravity.TOP|Gravity.END);
        coinPosition.rightMargin=dp(56);
        littleCoin.addView(coinBurst,coinPosition);
        radioScreen.addView(littleCoin,new LinearLayout.LayoutParams(-1,dp(0)));

        receiverDial=new RebelReceiverSkin.Dial(this);
        receiverDial.setSameTime(radioMode);
        // The big dial now selects future virtual stations. Playback modes
        // remain the separate, working Same-Time / Road Shuffle controls.
        receiverDial.setOnTuneListener((circuit,frequency,archive)->{
            if (!receiverDial.isMainStationTuned() && controller!=null && controller.isPlaying())
                controller.pause();
            if ("DIAL".equals(circuit) && receiverDial.isMainStationTuned()) {
                Toast.makeText(this,"HUMKIN RADIO · 98.2 VIRTUAL FM",Toast.LENGTH_SHORT).show();
            } else if ("BAND".equals(circuit) && !archive && receiverDial.isMainStationTuned()) {
                Toast.makeText(this,"FM · back to HUMKIN RADIO",Toast.LENGTH_SHORT).show();
            } else {
                showUnbuiltReceiverCircuit(circuit,frequency,archive);
            }
        });
        radioScreen.addView(receiverDial,
                new LinearLayout.LayoutParams(-1,dp(wideCards?244:218)));

        LinearLayout player=console();
        radioArt=HumkinVisuals.art(this,R.drawable.ic_radio);
        LinearLayout labels=consoleLabels(player,radioArt,wideCards?109:80);
        playingHeading=consoleHeading(labels,"NOW SPINNING / PREVIEW");
        nowPlaying=consoleTitle(labels,"Ready to tune in",wideCards?26:21);
        playingArtist=consoleSubtitle(labels);
        radioWaveform=addWaveform(labels);
        radioScreen.addView(player,wrap(9));

        reactionButton=pill("✳  THIS ONE DID SOMETHING  ↗",null,CREAM,13);
        reactionButton.setMinHeight(dp(47));
        reactionButton.setContentDescription("Tell HUMKIN how this song made you feel");
        reactionButton.setOnClickListener(v->reactToSong());
        reactionButton.setVisibility(View.GONE);
        radioScreen.addView(reactionButton,wrap(7));
        keepRecordButton=pill("ⓗ KEEP THIS RECORD",null,RebelReceiverSkin.GOLD,12);
        keepRecordButton.setMinHeight(dp(45));
        keepRecordButton.setVisibility(View.GONE);
        keepRecordButton.setOnClickListener(v->keepNowPlaying());
        radioScreen.addView(keepRecordButton,wrap(5));

        sameTime=pill("◉ SAME-TIME RADIO",null,YELLOW,11);
        road=pill("↝ ROAD SHUFFLE",null,MINT,11);
        sameTime.setMinHeight(dp(49));road.setMinHeight(dp(49));
        addPair(radioScreen,sameTime,road,11);
        sameTime.setOnClickListener(v->changeMode(true));
        road.setOnClickListener(v->changeMode(false));

        tune=pill("TUNE IN",Icon.PLAY,YELLOW,27);
        tune.setMinHeight(dp(70));
        RebelReceiverSkin.tune(tune);
        tune.setOnClickListener(v->{
            v.performHapticFeedback(android.view.HapticFeedbackConstants.KEYBOARD_TAP);
            tuneIn();
        });
        radioScreen.addView(tune,wrap(12));

        TextView longWay=text("— MUSIC FOR THE LONG WAY HOME —",10,RebelReceiverSkin.WHITE,true);
        longWay.setLetterSpacing(.09f);
        radioScreen.addView(longWay,wrap(9));
        RebelReceiverSkin.Speaker speaker=new RebelReceiverSkin.Speaker(this);
        radioScreen.addView(speaker,new LinearLayout.LayoutParams(-1,dp(73)));

        // These four real native navigation buttons replace a screenshot's
        // inert printed tabs, and leave the earned Outpost doors intact.
        LinearLayout nav=row();
        Button radioTab=pill("◉\nRADIO",null,RebelReceiverSkin.PEACH,11);
        Button records=pill("▤\nRECORDS",null,CREAM,11);
        outpostButton=pill("✳\nOUTPOST",null,CREAM,11);
        Button signal=pill("⌁\nSIGNAL",null,CREAM,11);
        Button[] tabs={radioTab,records,outpostButton,signal};
        for(int i=0;i<tabs.length;i++){
            RebelReceiverSkin.navigation(tabs[i],i==0);
            tabs[i].setMinHeight(dp(59));
            LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(0,dp(59),1f);
            if(i>0)lp.leftMargin=dp(3);
            nav.addView(tabs[i],lp);
        }
        radioTab.setOnClickListener(v->scroll.smoothScrollTo(0,0));
        records.setOnClickListener(v->showAlbums(true));
        outpostButton.setOnClickListener(v->startActivity(new Intent(this,OutpostActivity.class)));
        signal.setContentDescription("Signal controls and station history");
        signal.setOnClickListener(v->showMoreRadio());
        radioScreen.addView(nav,wrap(9));
        TextView footer=text("✳ STRANGE FLOWERS • GOOD COMPANY • NO TOLLS ✳",
                9,RebelReceiverSkin.DARK,true);
        footer.setLetterSpacing(.035f);
        footer.setBackgroundColor(RebelReceiverSkin.MINT);
        footer.setMinHeight(dp(29));
        radioScreen.addView(footer,wrap(5));

        status=message(RebelReceiverSkin.WHITE);
        radioScreen.addView(status,wrap(7));

        LinearLayout stationLog=column();
        stationLog.setGravity(Gravity.START);
        stationLog.setPadding(dp(13),dp(11),dp(13),dp(11));
        android.graphics.drawable.GradientDrawable logPaper=
                HumkinVisuals.shape(this,RebelReceiverSkin.PAPER,9);
        logPaper.setStroke(dp(2),RebelReceiverSkin.BRASS);
        stationLog.setBackground(logPaper);
        TextView nextLabel=text("COMING UP",10,PLUM,true);
        nextLabel.setGravity(Gravity.START);
        nextLabel.setLetterSpacing(.09f);
        stationLog.addView(nextLabel,wrap(0));
        onDeck=text("—",14,INK,true);
        onDeck.setGravity(Gravity.START);
        onDeck.setSingleLine(true);
        onDeck.setEllipsize(TextUtils.TruncateAt.END);
        stationLog.addView(onDeck,wrap(3));
        View divider=new View(this);
        divider.setBackgroundColor(0xffead5dc);
        LinearLayout.LayoutParams dividerSize=new LinearLayout.LayoutParams(-1,dp(1));
        dividerSize.topMargin=dp(9);dividerSize.bottomMargin=dp(8);
        stationLog.addView(divider,dividerSize);
        TextView heardLabel=text("JUST PLAYED",10,PLUM,true);
        heardLabel.setGravity(Gravity.START);
        heardLabel.setLetterSpacing(.09f);
        stationLog.addView(heardLabel,wrap(0));
        recentlyHeard=text("—",13,INK,false);
        recentlyHeard.setGravity(Gravity.START);
        recentlyHeard.setMaxLines(2);
        recentlyHeard.setEllipsize(TextUtils.TruncateAt.END);
        stationLog.addView(recentlyHeard,wrap(3));
        updateRecentRecords();
        radioScreen.addView(stationLog,wrap(13));

        Button share=pill("SHARE THE DIAL",null,MINT,13);
        share.setOnClickListener(v->{
            Intent sending=new Intent(Intent.ACTION_SEND);
            sending.setType("text/plain");
            sending.putExtra(Intent.EXTRA_TEXT,
                    "You found us. HUMKIN RADIO — music for the long way home. "
                            +"https://humkin.abundent.org/fm/");
            startActivity(Intent.createChooser(sending,"Share HUMKIN RADIO"));
        });
        Button request=pill("REQUEST LINE ↗",null,PINK,13);
        request.setOnClickListener(v->visit("https://humkin.abundent.org/fm/line/"));
        addPair(radioScreen,share,request,11);
    }

    private void showWorldMenu() {
        new AlertDialog.Builder(this)
                .setTitle("THE HUMKIN WORLD")
                .setItems(new String[]{
                        "THE TOP 42 · record league",
                        "STATION GUILDS · make something real"
                }, (dialog, choice) -> {
                    if(choice==0){
                        SignalRpg.visitLeague(this);
                        startActivity(new Intent(this,LeagueActivity.class));
                    }else{
                        startActivity(new Intent(this,GuildActivity.class));
                    }
                })
                .setNegativeButton("Back to radio",null)
                .show();
    }

    private TextView labelHumChip(){
        TextView chip=text("ⓗ 0",15,RebelReceiverSkin.GOLD,true);
        chip.setGravity(Gravity.CENTER);
        chip.setPadding(dp(7),0,dp(6),0);
        chip.setContentDescription("My HUM balance and records");
        chip.setOnClickListener(v->openMyRecords());
        return chip;
    }

    private void openMyRecords(){
        startActivity(new Intent(this,MyRecordsActivity.class));
    }

    /** An earned coin is just a 760ms visual acknowledgment, never a prompt. */
    private void updateHumStatus(){
        HumServerBridge.Snapshot wallet=HumServerBridge.snapshot(this);
        if(humChip!=null){
            String wording=wallet.known?"ⓗ "+wallet.balance:"ⓗ …";
            if(!wording.contentEquals(humChip.getText()))humChip.setText(wording);
            humChip.setContentDescription(wallet.known?
                wallet.balance+" server HUM, open My Records":
                "Station wallet connecting, open My Records");
        }
        if(wallet.awardSequence!=lastAwardSeen){
            lastAwardSeen=wallet.awardSequence;
            if(wallet.lastAward>0 && System.currentTimeMillis()-wallet.awardAt<12000L)
                floatCoin(wallet.lastAward);
        }
    }

    private void floatCoin(int amount){
        if(coinBurst==null||onAlbums||isFinishing())return;
        if(!android.animation.ValueAnimator.areAnimatorsEnabled()){
            humChip.announceForAccessibility("Plus "+amount+" HUM");
            return;
        }
        coinBurst.animate().cancel();
        coinBurst.setText("ⓗ  +"+amount+" HUM");
        coinBurst.setAlpha(1f);
        coinBurst.setTranslationY(0f);
        coinBurst.setVisibility(View.VISIBLE);
        coinBurst.animate()
            .translationY(-dp(43)).alpha(0f).setDuration(760L)
            .withEndAction(()->coinBurst.setVisibility(View.INVISIBLE))
            .start();
        humChip.announceForAccessibility("Plus "+amount+" HUM");
    }

    private void updateKeepButtons(MediaItem current){
        boolean suitable=current!=null && current.localConfiguration!=null &&
                HumEconomy.canonicalId(current.mediaId)!=null &&
                HumEconomy.approvedAudio(current.localConfiguration.uri.toString());
        HumServerBridge.Snapshot wallet=suitable?HumServerBridge.snapshot(this):null;
        String id=suitable?HumEconomy.canonicalId(current.mediaId):null;
        boolean owned=suitable&&(wallet.owns(id)||HumWallet.snapshot(this).find(id)!=null);
        int price=suitable?HumWallet.price(current):1;
        String label=owned?"✓ IN MY RECORDS  ↗":"ⓗ KEEP THIS RECORD  ·  "+price+" HUM";
        if(keepRecordButton!=null){
            keepRecordButton.setVisibility(suitable?View.VISIBLE:View.GONE);
            if(suitable)keepRecordButton.setText(label);
            keepRecordButton.setEnabled(!keepDownloading);
        }
        if(keepAlbumButton!=null){
            keepAlbumButton.setVisibility(suitable?View.VISIBLE:View.GONE);
            if(suitable)keepAlbumButton.setText(label);
            keepAlbumButton.setEnabled(!keepDownloading);
        }
    }

    /** One tap keeps the record and initiates a real DRM-free MP3 download.
     * A failed download never consumes HUM twice: the entitlement persists. */
    private void keepNowPlaying(){
        if(keepDownloading)return;
        MediaItem item=controller==null?null:controller.getCurrentMediaItem();
        if(item==null || item.localConfiguration==null)return;
        String id=HumEconomy.canonicalId(item.mediaId);
        if(id==null){
            Toast.makeText(this,"That recording isn't an approved song.",
                    Toast.LENGTH_LONG).show();
            return;
        }
        keepDownloading=true;
        updateKeepButtons(item);
        worker.execute(()->{
            boolean authorized=false,saved=false;
            String error="";
            try{
                // A real server-side transaction owns the HUM debit and
                // collection record. No local mint or speculative charge.
                HumServerBridge.collect(getApplicationContext(),item);
                authorized=HumWallet.cacheServerRecord(getApplicationContext(),item);
                if(!authorized)throw new java.io.IOException("Couldn't cache record details");
                HumWallet.Record record=HumWallet.snapshot(getApplicationContext()).find(id);
                if(record==null)throw new java.io.IOException("Couldn't open collected song");
                if(MusicLibrary.exists(getApplicationContext(),record.uri))saved=true;
                else{
                    Uri file=MusicLibrary.download(getApplicationContext(),record);
                    saved=HumWallet.setDownloaded(getApplicationContext(),record.id,file.toString());
                    if(!saved)MusicLibrary.delete(getApplicationContext(),file.toString());
                }
            }catch(Exception e){error=e.getMessage()==null?"Station unavailable":e.getMessage();}
            final boolean collected=authorized,downloaded=saved;
            final String reason=error;
            runOnUiThread(()->{
                keepDownloading=false;
                if(isFinishing()||isDestroyed())return;
                updateHumStatus();
                updateKeepButtons(controller==null?null:controller.getCurrentMediaItem());
                Toast.makeText(this,downloaded?
                    "Your record is home · Music/HUMKIN · no DRM.":
                    collected?
                    "Collected! Download interrupted; retry for free in My Records.":
                    (reason.contains("Listen a little")?reason:
                       "Station wallet unavailable. Nothing spent. Try again."),
                    Toast.LENGTH_LONG).show();
            });
        });
    }

    private void reactToSong() {
        MediaItem item=controller==null?null:controller.getCurrentMediaItem();
        String id=item==null?null:SongReactionId.canonical(item.mediaId);
        if(id==null){
            Toast.makeText(this,"Tune to a published song first.",Toast.LENGTH_SHORT).show();
            return;
        }
        String title=item.mediaMetadata.title==null?"THIS SONG":
                item.mediaMetadata.title.toString();
        // The first-response crash persisted after delaying the nested dialog.
        // Remove the entire first-response follow-up/modal branch. A feeling
        // saves quietly and locally; sharing is a separate, existing ⋯ choice.
        // Never redraw the entire receiver inside AlertDialog's item callback.
        new AlertDialog.Builder(this)
            .setTitle("HOW DID IT LAND?  ·  "+title)
            .setItems(SongReactions.CHOICES,(dialog,which)->{
                String code=SongReactions.codeAt(which);
                if(code==null)return;
                try{
                    if(!SongReactions.save(getApplicationContext(),id,code))
                        throw new IllegalStateException("Unable to persist song memory");
                    if(reactionButton!=null)
                        reactionButton.setText("✳  THIS ONE: "+SongReactions.phrase(code)+"  ↗");
                    Toast.makeText(this,"Kept in your song memories.",
                            Toast.LENGTH_SHORT).show();
                    if(SongReactions.sharing(getApplicationContext())==1)
                        transmitReaction(id,code);
                }catch(RuntimeException failed){
                    android.util.Log.e("HUMKIN-REACTION","Unable to save first feeling",failed);
                    Toast.makeText(this,"Couldn't save that feeling on this phone.",
                            Toast.LENGTH_LONG).show();
                }
            }).setNegativeButton("Not this time",null).show();
    }

    private void transmitReaction(String id,String code){
        worker.execute(()->{
            boolean accepted;
            try{accepted=ResonanceBridge.submit(getApplicationContext(),id,code);}
            catch(Exception ignored){accepted=false;}
            final boolean ok=accepted;
            runOnUiThread(()->{
                if(isFinishing()||isDestroyed())return;
                Toast.makeText(this,ok
                    ? "Your feeling reached the Listener Weather board."
                    : "Saved here. The station couldn't receive it yet.",Toast.LENGTH_LONG).show();
            });
        });
    }

    private void showUnbuiltReceiverCircuit(String circuit,float frequency,boolean archive) {
        String details=VirtualChannels.circuitMessage(circuit,frequency,archive);
        new AlertDialog.Builder(this)
            .setTitle("ϟ LOOSE WIRE · WORKSHOP")
            .setMessage(details+"\n\nNew frequencies are constructed and verified before anyone can broadcast through them.")
            .setPositiveButton("EXPLORE STATION GUILDS",(dialog,which)->
                startActivity(new Intent(this,GuildActivity.class)))
            .setNegativeButton("BACK TO THE DIAL",null)
            .show();
    }

    private void showMoreRadio() {
        // Keep the radio's primary face for listening. All secondary actions
        // remain available without a network request or another page.
        List<String> titles = new ArrayList<>();
        List<Runnable> actions = new ArrayList<>();
        if (SignalRpg.canControlRadioStatic(this)) {
            titles.add(warmStaticEnabled
                    ? "Static + signal dips  ·  ON (tap to turn off)"
                    : "Static + signal dips  ·  OFF (tap to turn on)");
            actions.add(() -> {
                // Recheck at the moment of use, not only when opening the menu.
                if (!SignalRpg.canControlRadioStatic(this)) return;
                warmStaticEnabled = !warmStaticEnabled;
                getSharedPreferences("humkin-radio", MODE_PRIVATE).edit()
                        .putBoolean("analog-static", warmStaticEnabled).apply();
                RadioPlaybackService.setWarmStaticEnabled(warmStaticEnabled);
                Toast.makeText(this, warmStaticEnabled
                        ? "Analog radio texture on" : "Analog radio texture off",
                        Toast.LENGTH_SHORT).show();
            });
        }
        if (radioMode) {
            titles.add("Catch up to air");
            actions.add(() -> fetchRadio(true));
        } else {
            titles.add("Next record");
            actions.add(() -> {
                if (controller != null && "shuffle".equals(source)
                        && controller.getMediaItemCount() > 0) {
                    controller.seekToNext();
                    controller.play();
                }
            });
            titles.add("Reshuffle");
            actions.add(() -> fetchRadio(true, false));
        }
        titles.add("Other station departments · Top 42 and Guilds");
        actions.add(this::showWorldMenu);
        // The earlier three-record sketchbook no longer appears as a
        // first-level shortcut around the earned LV7 pirate radio door.
        titles.add("Listener Weather · how the songs landed");
        actions.add(() -> visit("https://humkin.abundent.org/fm/top42/#listener-weather"));
        titles.add(SongReactions.sharing(this)==1
                ? "Send my song responses · ON (tap to keep private)"
                : "Send my song responses · OFF (tap to enable)");
        actions.add(()->{
            boolean enable=SongReactions.sharing(this)!=1;
            SongReactions.setSharing(this,enable?1:2);
            Toast.makeText(this,enable
                ? "Future responses can be sent anonymously; existing memories stay local."
                : "Future responses will stay on this phone.",Toast.LENGTH_LONG).show();
        });
        String lastCrash=HumCrashNote.report(this);
        if(!lastCrash.isEmpty()){
            titles.add("LAST APP CRASH · copy diagnostic");
            actions.add(()->new AlertDialog.Builder(this)
                .setTitle("LAST HUMKIN CRASH")
                .setMessage("A private crash note was saved on this phone. "+
                    "Nothing is uploaded automatically. Copy it to share with a developer.")
                .setPositiveButton("Copy report",(d,w)->{
                    android.content.ClipboardManager clipboard=(android.content.ClipboardManager)
                        getSystemService(CLIPBOARD_SERVICE);
                    if(clipboard!=null)
                        clipboard.setPrimaryClip(android.content.ClipData.newPlainText(
                            "HUMKIN crash report",lastCrash));
                    Toast.makeText(this,"Crash details copied.",Toast.LENGTH_SHORT).show();
                })
                .setNeutralButton("Clear note",(d,w)->HumCrashNote.clear(this))
                .setNegativeButton("Close",null).show());
        }
        titles.add("Station archive");
        actions.add(() -> visit("https://humkin.abundent.org/fm/archive/"));
        titles.add("Privacy");
        actions.add(() -> visit("https://humkin.abundent.org/privacy.html"));
        new AlertDialog.Builder(this)
                .setTitle("HUMKIN RADIO  ·  MORE")
                .setItems(titles.toArray(new String[0]),
                        (dialog, selection) -> actions.get(selection).run())
                .setNegativeButton("Close", null)
                .show();
    }

    private void buildAlbums() {
        // A single way back; no duplicate Radio / Albums navigation row.
        Button back = pill("BACK TO RADIO", Icon.BACK, YELLOW, 16);
        back.setOnClickListener(v -> showAlbums(false));
        albumsScreen.addView(back, wrap(9));
        Button myRecords=pill("ⓗ MY RECORDS  /  OFFLINE LIBRARY ↗",null,MINT,13);
        myRecords.setOnClickListener(v->openMyRecords());
        albumsScreen.addView(myRecords,wrap(9));

        albumGrid=column();
        albumsScreen.addView(albumGrid,wrap(3));
        renderAlbumCards();

        // Warmth was a placeholder for an album not wired into the app.
        // Show only two playable albums and the existing Singles lane.
        LinearLayout singles = shelfCard("Singles", "New finds and one-offs.", R.drawable.ic_radio,
                "SHUFFLE", Icon.SHUFFLE, () -> changeMode(false));
        // The wider Singles strip keeps its icon square, not stretched.
        if (wideCards) {
            singles.getChildAt(0).setLayoutParams(
                    new LinearLayout.LayoutParams(dp(104), dp(104)));
        }
        albumsScreen.addView(singles, wrap(9));

        LinearLayout feature = console();
        featureArt = HumkinVisuals.art(this, R.drawable.album_everywhere_near_you);
        LinearLayout labels = consoleLabels(feature, featureArt, wideCards ? 106 : 80);
        featureHeading = consoleHeading(labels, "FEATURED ALBUM");
        albumPlaying = consoleTitle(labels, featuredAlbum.title, 23);
        featureArtist = consoleSubtitle(labels);
        albumWaveform = addWaveform(labels);
        feature.setFocusable(true);
        feature.setContentDescription("Play featured album, "+featuredAlbum.title);
        // Resolve at click time so newly published records require no APK rebuild.
        feature.setOnClickListener(v -> playAlbum(featuredAlbum));
        albumsScreen.addView(feature, wrap(13));
        keepAlbumButton=pill("ⓗ KEEP THIS TRACK",null,MINT,13);
        keepAlbumButton.setVisibility(View.GONE);
        keepAlbumButton.setOnClickListener(v->keepNowPlaying());
        albumsScreen.addView(keepAlbumButton,wrap(8));

        albumState = message(INK);
        albumsScreen.addView(albumState, wrap(5));
        albumNext = pill("NEXT TRACK", Icon.NEXT, MINT, 14);
        albumNext.setOnClickListener(v -> {
            if (controller != null && "album".equals(source)
                    && controller.getMediaItemCount() > 0) {
                controller.seekToNext();
                controller.play();
            }
        });
        albumsScreen.addView(albumNext, wrap(8));

        // Tuning modes, archive and privacy remain on the Radio screen
        // and in its ⋯ menu; the record shelf needs no duplicated links.
    }

    private void addPair(LinearLayout screen, View left, View right, int top) {
        LinearLayout pair = row();
        pair.addView(left, flex(0));
        pair.addView(right, flex(8));
        screen.addView(pair, wrap(top));
    }

    private void renderAlbumCards() {
        if(albumGrid==null)return;
        albumGrid.removeAllViews();
        // A release publication grows the real shelf; no empty promises.
        for(int i=0;i<shelfAlbums.size();i+=2){
            AlbumCatalog.Album leftAlbum=shelfAlbums.get(i);
            LinearLayout left=albumCard(leftAlbum,AlbumArtwork.forAlbum(leftAlbum.id),leftAlbum.detail);
            LinearLayout group=wideCards?row():column();
            if(i+1<shelfAlbums.size()){
                AlbumCatalog.Album rightAlbum=shelfAlbums.get(i+1);
                LinearLayout right=albumCard(rightAlbum,AlbumArtwork.forAlbum(rightAlbum.id),rightAlbum.detail);
                group.addView(left,wideCards?flex(0):wrap(0));
                group.addView(right,wideCards?flex(8):wrap(8));
            }else{
                if(wideCards)left.getChildAt(0).setLayoutParams(
                        new LinearLayout.LayoutParams(dp(104),dp(104)));
                group.addView(left,wrap(0));
            }
            albumGrid.addView(group,wrap(9));
        }
    }

    private void refreshAlbumIndex() {
        if(!albumRefreshing.compareAndSet(false,true))return;
        worker.execute(()->{
            List<AlbumCatalog.Album> published=null;
            try {published=AlbumCatalog.discover();}
            catch(Exception ignored) {
                // An offline listener keeps the two built-in published records.
            } finally {albumRefreshing.set(false);}
            if(published==null)return;
            final List<AlbumCatalog.Album> found=published;
            runOnUiThread(()->{
                if(!alive)return;
                shelfAlbums=found;
                featuredAlbum=found.get(0);
                renderAlbumCards();
                lastFeatureCoverKey="";
                lastRadioCoverId="";
                redraw();
            });
        });
    }

    private AlbumCatalog.Album findAlbum(MediaItem item) {
        if(item==null)return null;
        String id=item.mediaId;
        CharSequence title=item.mediaMetadata.albumTitle;
        for(AlbumCatalog.Album album:shelfAlbums) {
            if(id.startsWith("album:"+album.id+":") ||
                    (title!=null && album.title.equalsIgnoreCase(title.toString())))return album;
        }
        return null;
    }

    private void showAlbumCover(ImageView image,AlbumCatalog.Album album) {
        image.setTag(album.id);
        int bundled=AlbumArtwork.forAlbum(album.id);
        if(bundled!=R.drawable.ic_radio) {
            image.setImageResource(bundled);
            return;
        }
        Bitmap cached=coverCache.get(album.coverUrl);
        if(cached!=null) {image.setImageBitmap(cached);return;}
        image.setImageResource(R.drawable.ic_radio);
        coverWorker.execute(()->{
            Bitmap art=null;
            try{art=AlbumCoverLoader.fetch(album.coverUrl);}catch(Exception ignored){}
            final Bitmap result=art;
            runOnUiThread(()->{
                if(result!=null)coverCache.put(album.coverUrl,result);
                if(alive && album.id.equals(image.getTag()) && result!=null)
                    image.setImageBitmap(result);
            });
        });
    }

    private LinearLayout albumCard(AlbumCatalog.Album album, int art, String detail) {
        LinearLayout card = shelfCard(album.title, detail, art, "PLAY", Icon.PLAY,
                () -> playAlbum(album));
        ImageView cover = (ImageView) card.getChildAt(0);
        cover.setContentDescription("Open " + album.title + " album page");
        cover.setFocusable(true);
        cover.setOnClickListener(v -> visit(album.pageUrl));
        showAlbumCover(cover,album);
        return card;
    }

    private LinearLayout shelfCard(String title, String detail, int artwork, String action,
                                   Icon icon, Runnable open) {
        LinearLayout card = row();
        card.setPadding(dp(7), dp(8), dp(7), dp(8));
        card.setBackground(HumkinVisuals.panel(this, 0xfffbe4da, BLUSH, 17));
        card.setElevation(dp(2));

        ImageView cover = HumkinVisuals.art(this, artwork);
        LinearLayout.LayoutParams coverSize = wideCards
                ? new LinearLayout.LayoutParams(0, dp(106), .88f)
                : new LinearLayout.LayoutParams(dp(104), dp(104));
        card.addView(cover, coverSize);

        LinearLayout labels = column();
        labels.setGravity(Gravity.START);
        LinearLayout.LayoutParams labelsSize = flex(7);
        labelsSize.weight = 1.12f;
        card.addView(labels, labelsSize);
        boolean publishedAlbum = icon == Icon.PLAY;
        boolean longTitle = wideCards && AlbumCatalog.EVERYWHERE.title.equals(title);
        TextView name = text(longTitle ? "everywhere;\nnear you" : title,
                longTitle ? 15 : 16, INK, true);
        if (longTitle) name.setTypeface(Typeface.create("sans-serif-condensed", Typeface.BOLD));
        if (wideCards && publishedAlbum) name.setMinLines(2);
        name.setGravity(Gravity.START);
        labels.addView(name, wrap(2));

        View accent = new View(this);
        accent.setBackground(HumkinVisuals.shape(this, 0xff89ad91, 2));
        LinearLayout.LayoutParams line = new LinearLayout.LayoutParams(dp(29), dp(2));
        line.topMargin = dp(4);
        labels.addView(accent, line);

        TextView description = text(detail, 12, INK, false);
        if (wideCards && publishedAlbum) description.setMinLines(3);
        description.setGravity(Gravity.START);
        HumkinVisuals.italic(description);
        labels.addView(description, wrap(5));

        Button play = pill(action, wideCards && !publishedAlbum ? null : icon, YELLOW, 12);
        play.setContentDescription(action.equals("PLAY") ? "Play " + title : title + ", " + action);
        play.setOnClickListener(v -> open.run());
        labels.addView(play, wrap(5));
        return card;
    }

    private LinearLayout console() {
        LinearLayout panel = row();
        panel.setPadding(dp(12), dp(12), dp(12), dp(17));
        panel.setBackground(RebelReceiverSkin.plate(this,
                RebelReceiverSkin.PAPER,RebelReceiverSkin.BRASS,10));
        panel.setElevation(dp(4));
        return panel;
    }

    private LinearLayout consoleLabels(LinearLayout panel, ImageView artwork, int size) {
        panel.addView(artwork, new LinearLayout.LayoutParams(dp(size), dp(size)));
        LinearLayout labels = column();
        labels.setGravity(Gravity.START);
        panel.addView(labels, flex(12));
        return labels;
    }

    private TextView consoleHeading(LinearLayout labels, String value) {
        TextView heading = text(value, 11, INK, true);
        heading.setGravity(Gravity.START);
        heading.setLetterSpacing(.17f);
        labels.addView(heading, wrap(0));
        View accent = new View(this);
        accent.setBackground(HumkinVisuals.shape(this, PINK, 2));
        LinearLayout.LayoutParams line = new LinearLayout.LayoutParams(dp(58), dp(2));
        line.topMargin = dp(4);
        labels.addView(accent, line);
        return heading;
    }

    private TextView consoleTitle(LinearLayout labels, String value, int size) {
        TextView title = text(value, size, INK, true);
        title.setGravity(Gravity.START);
        labels.addView(title, wrap(7));
        return title;
    }

    private TextView consoleSubtitle(LinearLayout labels) {
        TextView label = text("", 12, INK, false);
        label.setGravity(Gravity.START);
        label.setLetterSpacing(.09f);
        labels.addView(label, wrap(4));
        return label;
    }

    private HumkinVisuals.HumkinWaveform addWaveform(LinearLayout labels) {
        LinearLayout.LayoutParams line = new LinearLayout.LayoutParams(-1, dp(22));
        line.topMargin = dp(7);
        HumkinVisuals.HumkinWaveform waveform = HumkinVisuals.waveform(this);
        labels.addView(waveform, line);
        return waveform;
    }

    private TextView message(int color) {
        TextView message = text("", 12, color, false);
        message.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        message.setVisibility(View.GONE);
        return message;
    }

    private void showMessage(TextView message, String value) {
        message.setText(value);
        message.setVisibility(value.isEmpty() ? View.GONE : View.VISIBLE);
    }

    private void showAlbums(boolean yes) {
        onAlbums = yes;
        if (Build.VERSION.SDK_INT >= 33) {
            OnBackInvokedDispatcher back = getOnBackInvokedDispatcher();
            if (yes) back.registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, albumsBack);
            else back.unregisterOnBackInvokedCallback(albumsBack);
        }
        radioScreen.setVisibility(yes ? View.GONE : View.VISIBLE);
        albumsScreen.setVisibility(yes ? View.VISIBLE : View.GONE);
        albumHeading.setVisibility(yes ? View.VISIBLE : View.GONE);
        tagline.setText("Take a song home.");
        tagline.setVisibility(yes ? View.VISIBLE : View.GONE);
        scroll.scrollTo(0, 0);
        redraw();
    }

    private void openShelfGroup(View group) {
        showAlbums(true);
        group.post(() -> scroll.smoothScrollTo(0, albumsScreen.getTop() + group.getTop() - dp(8)));
    }

    private void changeMode(boolean radio){
        radioMode = radio;
        getSharedPreferences("humkin-radio", MODE_PRIVATE).edit()
                .putBoolean("last-radio-mode", radio).apply();
        showAlbums(false);
        // A station button is also a PLAY button. If the media session
        // is still connecting, preserve that intent for the onStart callback.
        if (controller == null) {
            tuneWhenReady = true;
            if (status != null) showMessage(status, "Connecting the receiver…");
            return;
        }
        tuneWhenReady = false;
        String expected = radio ? "radio" : "shuffle";
        // A mode tap never rebuilds an existing live/paused queue unnecessarily.
        if (expected.equals(source) && controller.getMediaItemCount() > 0) {
            if (controller.isPlaying()) return;
            if (!radio || !pausedTooLong()) {
                controller.play();
                redraw();
                return;
            }
        }
        // Explicit mode switch (or a genuinely stale Same-Time pause).
        fetchRadio(true);
    }
    private boolean pausedTooLong() {
        long pausedAt = getSharedPreferences("humkin-radio", MODE_PRIVATE)
                .getLong("paused-at-ms", 0L);
        long now = System.currentTimeMillis();
        return pausedAt > 0L && now >= pausedAt &&
                now - pausedAt > PlaybackContinuity.MAX_SOFT_PAUSE_MS;
    }

    private void visit(String url) {
        startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)));
    }
    @Override public void onBackPressed() {
        if(onAlbums){showAlbums(false);return;}
        super.onBackPressed();
    }

    @Override public void onStart(){
        super.onStart();alive=true;
        // Returning from the Outpost may have earned the first Antenna tier.
        // Older OFF preferences cannot suppress the default before then.
        warmStaticEnabled=!SignalRpg.canControlRadioStatic(this) ||
                getSharedPreferences("humkin-radio",MODE_PRIVATE)
                        .getBoolean("analog-static",true);
        RadioPlaybackService.setWarmStaticEnabled(warmStaticEnabled);
        HumServerBridge.refresh(getApplicationContext());
        refreshAlbumIndex();
        humHandler.removeCallbacks(humPulse);
        humHandler.post(humPulse);
        SessionToken token=new SessionToken(this,new ComponentName(this,RadioPlaybackService.class));
        controllerFuture=new MediaController.Builder(this,token).buildAsync();
        controllerFuture.addListener(()->{
            try{
                controller=controllerFuture.get();
                controller.addListener(listener);
                if(RadioPlaybackService.isPirateArmed() && controller.getMediaItemCount()>0){
                    source="pirate";
                    modeStyled=false;
                }
                if("none".equals(source) && controller.getMediaItemCount()>0){
                    MediaItem item=controller.getCurrentMediaItem();
                    String id=item==null?"":item.mediaId;
                    if(id.startsWith("album:"))source="album";
                    else {
                        PlaybackContinuity.Saved saved = PlaybackContinuity.read(
                                getSharedPreferences("humkin-radio", MODE_PRIVATE));
                        if ("shuffle".equals(saved.mode) || "radio".equals(saved.mode)) {
                            source = saved.mode;
                            radioMode = "radio".equals(saved.mode);
                        } else source = radioMode ? "radio" : "shuffle";
                    }
                }
                if (!alive) return;
                if (tuneWhenReady) changeMode(radioMode);
                else redraw();
            }catch(Exception e){showMessage(status, "Couldn't connect to the receiver.");}
        },this::runOnUiThread);
    }
    @Override public void onStop(){
        alive=false;
        humHandler.removeCallbacks(humPulse);
        if (radioWaveform != null) radioWaveform.setActive(false);
        if (albumWaveform != null) albumWaveform.setActive(false);
        if(controller!=null){controller.removeListener(listener);controller=null;}
        if(controllerFuture!=null){
            MediaController.releaseFuture(controllerFuture);controllerFuture=null;
        }
        super.onStop();
    }
    @Override public void onDestroy(){worker.shutdownNow();coverWorker.shutdownNow();super.onDestroy();}

    private void tuneIn(){
        if(receiverDial!=null && !receiverDial.isMainStationTuned()){
            showUnbuiltReceiverCircuit("DIAL",receiverDial.frequency(),receiverDial.isArchive());
            return;
        }
        if(controller==null){
            tuneWhenReady = true;
            showMessage(status, "Connecting the receiver…");
            return;
        }
        if("pirate".equals(source)&&RadioPlaybackService.isPirateArmed()
                &&controller.getMediaItemCount()>0){
            if(controller.isPlaying())controller.pause();else controller.play();
            return;
        }
        String expected=radioMode?"radio":"shuffle";
        if(controller.getMediaItemCount()==0 || !expected.equals(source)){
            fetchRadio(true);
        }else if(controller.isPlaying())controller.pause();
        else if(radioMode && pausedTooLong())fetchRadio(true);
        else controller.play();
    }
    private Map<String,Long> recentPlayTimes() {
        Map<String,Long> times = new HashMap<>();
        try {
            JSONArray rows = new JSONArray(getSharedPreferences("humkin-radio",MODE_PRIVATE)
                    .getString("recent-records","[]"));
            for (int i = 0; i < rows.length(); i++) {
                JSONObject entry = rows.optJSONObject(i);
                if (entry == null) continue;
                String id = entry.optString("id","");
                long time = entry.optLong("time",0);
                if (!id.isEmpty() && time > 0) times.put(id,time);
            }
        } catch (Exception ignored) {
            // A missing/corrupt local history should never prevent tuning.
        }
        // The currently playing song may never have transitioned before the
        // app was closed. It still counts against near-term replay avoidance.
        PlaybackContinuity.Saved saved = PlaybackContinuity.read(
                getSharedPreferences("humkin-radio", MODE_PRIVATE));
        String active = saved.lastTrackIfRecent(System.currentTimeMillis());
        if (!active.isEmpty()) times.put(active, saved.savedAtMs);
        return times;
    }

    private void fetchRadio(boolean force) {
        fetchRadio(force, true);
    }

    private void fetchRadio(boolean force, boolean allowContinuity){
        if(controller==null||!loading.compareAndSet(false,true)){
            if(controller==null && status!=null)showMessage(status, "Connecting receiver…");
            return;
        }
        final boolean requested=radioMode;
        showMessage(status, "Gathering the station records…");
        setBusy(true);
        worker.execute(()->{
            try{
                RadioCatalog.Station loaded=RadioCatalog.loadStation();
                PlaybackContinuity.Saved saved = PlaybackContinuity.read(
                        getSharedPreferences("humkin-radio", MODE_PRIVATE));
                boolean resume = !requested && allowContinuity && saved.canResumeShuffle(
                        System.currentTimeMillis());
                List<MediaItem> shuffle = null;
                long resumeMs = 0L;
                if (!requested) {
                    if (resume) {
                        shuffle = loaded.queueFromIds(saved.remainingIds);
                        resume = !shuffle.isEmpty() &&
                                saved.currentId.equals(shuffle.get(0).mediaId);
                        if (resume) {
                            resumeMs = loaded.resumePositionMs(
                                    saved.currentId, saved.positionMs);
                            // A checkpoint near the end of a rotation must
                            // not loop its final record forever. Extend with
                            // a new full, fresh-weighted random rotation.
                            shuffle.addAll(loaded.shuffleQueue(
                                    recentPlayTimes(), System.currentTimeMillis()));
                        }
                    }
                    if (!resume) shuffle = loaded.shuffleQueue(
                            recentPlayTimes(), System.currentTimeMillis());
                }
                final List<MediaItem> queue = shuffle;
                final boolean restoringShuffle = resume;
                final long seekMs = resumeMs;
                runOnUiThread(()->{
                    loading.set(false);setBusy(false);
                    if(!alive||controller==null)return;
                    if(requested!=radioMode){fetchRadio(true);return;}
                    if(!force&&controller.getMediaItemCount()>0)return;
                    if(requested){
                        SharedClock.Cue cue=loaded.tuneAt(loaded.stationNow());
                        RadioPlaybackService.armSameTime(loaded,cue.cycle+2);
                        controller.setMediaItems(loaded.initialClockQueue(cue),0,cue.positionMs);
                        source="radio";
                        // Successful tuning should sound like radio, not
                        // introduce a persistent technical status paragraph.
                        showMessage(status, "");
                    }else{
                        RadioPlaybackService.armRoadShuffle(loaded);
                        if (restoringShuffle) {
                            // Continue the same selected record and the
                            // remaining approved playlist, not song one again.
                            controller.setMediaItems(queue, 0, seekMs);
                        } else {
                            controller.setMediaItems(queue);
                        }
                        source="shuffle";
                        showMessage(status, "");
                    }
                    controller.prepare();controller.play();redraw();
                });
            }catch(Exception e){
                runOnUiThread(()->{
                    loading.set(false);setBusy(false);
                    if(alive)showMessage(status, "No radio connection. Check the internet and try again.");
                });
            }
        });
    }
    private void playAlbum(AlbumCatalog.Album album){
        if(controller==null){showMessage(albumState, "Connecting to the receiver…");return;}
        if(!loading.compareAndSet(false,true))return;
        showMessage(albumState, "Opening "+album.title+"…");
        setBusy(true);
        worker.execute(()->{
            try{
                List<MediaItem> list=AlbumCatalog.load(album);
                runOnUiThread(()->{
                    loading.set(false);setBusy(false);
                    if(!alive||controller==null)return;
                    RadioPlaybackService.clearSameTime();
                    controller.setMediaItems(list);
                    source="album";
                    currentAlbum=album.title;
                    controller.prepare();controller.play();
                    showMessage(albumState, list.size()+" songs · playing in order.");
                    redraw();
                });
            }catch(Exception ex){
                runOnUiThread(()->{
                    loading.set(false);setBusy(false);
                    if(alive)showMessage(albumState, "Album unavailable. Tap its cover to open the web player.");
                });
            }
        });
    }
    private void setBusy(boolean busy){
        if(tune!=null)tune.setEnabled(!busy);
    }
    private void updateRecentRecords() {
        try {
            String stored = getSharedPreferences("humkin-radio",MODE_PRIVATE)
                    .getString("recent-records", "[]");
            JSONArray rows = new JSONArray(stored);
            StringBuilder lines = new StringBuilder();
            for (int i = 0; i < Math.min(rows.length(), 2); i++) {
                JSONObject row = rows.optJSONObject(i);
                if (row == null) continue;
                if (lines.length() > 0) lines.append("\n");
                lines.append("✳ ").append(row.optString("title", "Unknown record"));
            }
            recentlyHeard.setText(lines.length() == 0 ? "—" : lines.toString());
        } catch (Exception ignored) {
            recentlyHeard.setText("—");
        }
    }

    private void redraw() {
        if (tune == null) return;
        if (outpostButton != null) {
            int level=SignalRpg.snapshot(this).level;
            outpostButton.setContentDescription("Signal Outpost level "+level
                    +". Enter your growing radio world.");
        }
        boolean pirateLive="pirate".equals(source)&&RadioPlaybackService.isPirateArmed();
        boolean sameSelected=!pirateLive&&radioMode;
        boolean shuffleSelected=!pirateLive&&!radioMode;
        if(!modeStyled || sameTime.isSelected()!=sameSelected
                || road.isSelected()!=shuffleSelected) {
            // Bootleg Frequency is its own dial. Never label it "Same-Time".
            RebelReceiverSkin.mode(sameTime,sameSelected);
            RebelReceiverSkin.mode(road,shuffleSelected);
            if(receiverDial!=null)receiverDial.setSameTime(radioMode);
            sameTime.setSelected(sameSelected);
            road.setSelected(shuffleSelected);
            modeStyled=true;
        }
        boolean ready = controller != null && controller.getMediaItemCount() > 0;
        boolean stationPlaying = ready && controller.isPlaying()
                && ("pirate".equals(source)
                    ||(radioMode ? "radio" : "shuffle").equals(source));
        if (stationPlaying != "PAUSE".contentEquals(tune.getText())) {
            tune.setText(stationPlaying ? "PAUSE" : "TUNE IN");
            HumkinVisuals.setIcon(tune, stationPlaying ? Icon.PAUSE : Icon.PLAY, 31);
        }

        MediaItem item = ready ? controller.getCurrentMediaItem() : null;
        String thisId = item == null ? "" : item.mediaId;
        if(reactionButton!=null){
            String songId=SongReactionId.canonical(thisId);
            reactionButton.setVisibility(songId==null?View.GONE:View.VISIBLE);
            if(songId!=null){
                String reaction=SongReactions.get(this,songId);
                String wording=reaction==null?"✳  THIS ONE DID SOMETHING  ↗"
                        : "✳  THIS ONE: "+SongReactions.phrase(reaction)+"  ↗";
                if(!wording.contentEquals(reactionButton.getText()))reactionButton.setText(wording);
            }
        }
        updateKeepButtons(item);
        if (!lastRenderedTrackId.equals(thisId)) {
            lastRenderedTrackId = thisId;
            updateRecentRecords();
        }
        if (!ready) {
            onDeck.setText("—");
        } else if ("album".equals(source)) {
            int nextIndex = controller.getCurrentMediaItemIndex() + 1;
            MediaItem upcoming = nextIndex < controller.getMediaItemCount()
                    ? controller.getMediaItemAt(nextIndex) : null;
            onDeck.setText(upcoming == null || upcoming.mediaMetadata.title == null
                    ? "—" : upcoming.mediaMetadata.title.toString());
        } else {
            int nextIndex = controller.getCurrentMediaItemIndex() + 1;
            MediaItem upcoming = nextIndex < controller.getMediaItemCount()
                    ? controller.getMediaItemAt(nextIndex) : null;
            String nextTitle = upcoming == null || upcoming.mediaMetadata.title == null
                    ? "Finding the next record…"
                    : upcoming.mediaMetadata.title.toString();
            onDeck.setText(nextTitle);
        }
        boolean albumActive = item != null && "album".equals(source);
        boolean playing = item != null && controller.isPlaying();
        // Movement follows real player state, never decorative always-on loops.
        radioWaveform.setActive(!onAlbums && playing && !albumActive);
        albumWaveform.setActive(onAlbums && albumActive && playing);
        boolean loadingTrack = item != null && controller.getPlaybackState() == Player.STATE_BUFFERING;
        String name = item != null && item.mediaMetadata.title != null
                ? item.mediaMetadata.title.toString() : "HUMKIN RADIO";
        String artist = item != null && item.mediaMetadata.artist != null
                ? item.mediaMetadata.artist.toString() : "HUMKIN";
        // Website-published covers are bundled; unrecognized station-only
        // records get the honest HUMKIN receiver icon, never mock album art.
        int artwork = AlbumArtwork.forItem(item);
        playingHeading.setText(item == null ? "THE HUMKIN DIAL"
                : "pirate".equals(source) ? "BOOTLEG FREQUENCY · YOUR MIX"
                : playing ? "NOW PLAYING" : loadingTrack ? "TUNING IN" : "ON THE DIAL");
        nowPlaying.setText(item == null ? "Ready to tune in" : name);
        playingArtist.setVisibility(item == null ? View.GONE : View.VISIBLE);
        playingArtist.setText(artist);
        AlbumCatalog.Album activeAlbum=albumActive?findAlbum(item):null;
        if(!thisId.equals(lastRadioCoverId)) {
            lastRadioCoverId=thisId;
            if(activeAlbum!=null)showAlbumCover(radioArt,activeAlbum);
            else {
                radioArt.setTag(null);
                radioArt.setImageResource(artwork);
            }
        }

        View feature = (View) featureArt.getParent();
        featureHeading.setText(albumActive
                ? (playing ? "ALBUM PLAYING" : loadingTrack ? "OPENING ALBUM" : "ALBUM SELECTED")
                : "FEATURED ALBUM");
        albumPlaying.setText(albumActive ? name : featuredAlbum.title);
        AlbumCatalog.Album coverAlbum=albumActive?activeAlbum:featuredAlbum;
        String coverKey=(albumActive?"playing:":"featured:")+
                (coverAlbum==null?"unknown":coverAlbum.id);
        if(!coverKey.equals(lastFeatureCoverKey)){
            lastFeatureCoverKey=coverKey;
            if(coverAlbum!=null)showAlbumCover(featureArt,coverAlbum);
            else {
                featureArt.setTag(null);
                featureArt.setImageResource(artwork);
            }
        }
        featureArtist.setVisibility(albumActive ? View.VISIBLE : View.GONE);
        if (albumActive) {
            CharSequence albumTitle = item.mediaMetadata.albumTitle;
            featureArtist.setText(albumTitle != null ? albumTitle : currentAlbum);
        }
        feature.setClickable(!albumActive);
        feature.setFocusable(!albumActive);
        feature.setContentDescription(albumActive ? null : "Play featured album, "+featuredAlbum.title);
        albumNext.setVisibility(albumActive ? View.VISIBLE : View.GONE);
    }
}
