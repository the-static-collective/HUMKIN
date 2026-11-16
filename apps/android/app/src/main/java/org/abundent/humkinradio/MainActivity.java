package org.abundent.humkinradio;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.net.Uri;
import android.graphics.Typeface;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import androidx.media3.common.MediaItem;
import androidx.media3.common.Player;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;
import com.google.common.util.concurrent.ListenableFuture;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/** V0.3: approved cream/plum/rose/mint UI with native album and radio listening. */
public final class MainActivity extends Activity {
    private final ExecutorService worker=Executors.newFixedThreadPool(3);
    private final AtomicBoolean loading=new AtomicBoolean(false);
    private MediaController controller;
    private ListenableFuture<MediaController> controllerFuture;
    private TextView nowPlaying,status,modeNote,albumPlaying,albumState;
    private Button tune,next,reload,sameTime,road,catchUp,radioNav,albumNav,albumNext;
    private ScrollView scroll;
    private LinearLayout radioScreen,albumsScreen;
    private boolean alive,radioMode=true,onAlbums=false;
    private String source="none"; // radio | shuffle | album | none
    private String currentAlbum="";

    private final Player.Listener listener=new Player.Listener(){
        @Override public void onEvents(Player player,Player.Events events){redraw();}
    };

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(HumkinVisuals.INK);
        getWindow().setNavigationBarColor(HumkinVisuals.INK);
        if(savedInstanceState!=null){
            radioMode=savedInstanceState.getBoolean("radioMode",true);
            onAlbums=savedInstanceState.getBoolean("onAlbums",false);
            source=savedInstanceState.getString("source","none");
            currentAlbum=savedInstanceState.getString("currentAlbum","");
        }
        buildScreen();
    }
    @Override public void onSaveInstanceState(Bundle out) {
        out.putBoolean("radioMode",radioMode);
        out.putBoolean("onAlbums",onAlbums);
        out.putString("source",source);
        out.putString("currentAlbum",currentAlbum);
        super.onSaveInstanceState(out);
    }
    private int dp(int n){return HumkinVisuals.dp(this,n);}
    private TextView text(String s,int size,int color,boolean bold){
        return HumkinVisuals.text(this,s,size,color,bold);
    }
    private Button pill(String s,int color){return HumkinVisuals.pill(this,s,color,HumkinVisuals.INK);}
    private LinearLayout column(){return HumkinVisuals.vertical(this);}
    private LinearLayout row(){return HumkinVisuals.horizontal(this);}
    private LinearLayout.LayoutParams fill(int h,int top){return HumkinVisuals.full(this,h,top);}
    private LinearLayout.LayoutParams wrap(int top){return HumkinVisuals.wrap(this,top);}
    private LinearLayout.LayoutParams flex(int left){return HumkinVisuals.flex(this,1,left);}

    private void buildScreen(){
        scroll=new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(HumkinVisuals.CREAM);
        LinearLayout outer=column();outer.setPadding(dp(16),dp(18),dp(16),dp(24));
        scroll.addView(outer);
        TextView mark=text("✳  HUMKIN RADIO.",32,HumkinVisuals.INK,true);
        mark.setLetterSpacing(-.025f);
        outer.addView(mark,wrap(3));
        TextView tagline=text("Music for the long way home.",16,HumkinVisuals.INK,false);
        tagline.setTypeface(Typeface.create("serif",Typeface.ITALIC));
        outer.addView(tagline,wrap(0));
        TextView squiggle=text("﹏﹏﹏﹏﹏﹏﹏",18,0xff8eaf92,true);
        outer.addView(squiggle,wrap(0));

        LinearLayout tabs=row();
        radioNav=pill("◉  RADIO",HumkinVisuals.MINT);
        albumNav=pill("▣  ALBUMS",HumkinVisuals.YELLOW);
        tabs.addView(radioNav,flex(0));tabs.addView(albumNav,flex(10));
        outer.addView(tabs,wrap(6));
        radioNav.setOnClickListener(v->showAlbums(false));
        albumNav.setOnClickListener(v->showAlbums(true));

        radioScreen=column();radioScreen.setPadding(0,dp(8),0,0);
        albumsScreen=column();albumsScreen.setPadding(0,dp(8),0,0);
        outer.addView(radioScreen,wrap(0));
        outer.addView(albumsScreen,wrap(0));
        buildRadio();
        buildAlbums();
        showAlbums(onAlbums);
        redraw();
        setContentView(scroll);
    }
    private void buildRadio(){
        LinearLayout choice=row();
        sameTime=pill("◉ SAME-TIME\nRADIO",HumkinVisuals.YELLOW);
        road=pill("⤨ ROAD\nSHUFFLE",HumkinVisuals.MINT);
        choice.addView(sameTime,flex(0));choice.addView(road,flex(10));
        radioScreen.addView(choice,wrap(5));
        sameTime.setOnClickListener(v->changeMode(true));
        road.setOnClickListener(v->changeMode(false));
        modeNote=text("",14,HumkinVisuals.INK,false);
        modeNote.setBackground(HumkinVisuals.shape(this,HumkinVisuals.BLUSH,22));
        modeNote.setPadding(dp(17),dp(18),dp(17),dp(18));
        radioScreen.addView(modeNote,wrap(14));

        LinearLayout player=column();
        player.setBackground(HumkinVisuals.shape(this,HumkinVisuals.PLUM,26));
        player.setPadding(dp(16),dp(20),dp(16),dp(20));
        TextView heading=text("✳    N O W   P L A Y I N G",13,HumkinVisuals.WHITE,true);
        player.addView(heading,wrap(0));
        FrameLayout art=HumkinVisuals.artTile(this,160,null,worker);
        LinearLayout.LayoutParams artParams=new LinearLayout.LayoutParams(dp(178),dp(134));
        artParams.topMargin=dp(12);
        player.addView(art,artParams);
        nowPlaying=text("The road is waiting.",25,HumkinVisuals.WHITE,true);
        nowPlaying.setMaxLines(3);nowPlaying.setGravity(Gravity.CENTER);
        player.addView(nowPlaying,wrap(12));
        TextView bars=text("▁ ▃ ▅ ▂ ▆ ▃ ▅ ▇ ▄ ▂ ▆ ▃ ▅ ▂ ▇",17,0xffe2a2b2,true);
        player.addView(bars,wrap(7));
        radioScreen.addView(player,wrap(16));

        tune=pill("▶   TUNE IN",HumkinVisuals.YELLOW);
        tune.setTextSize(22);radioScreen.addView(tune,fill(68,16));
        tune.setOnClickListener(v->tuneIn());
        status=text("No ads. No account. Just tune in.",13,HumkinVisuals.INK,false);
        status.setPadding(dp(8),dp(9),dp(8),dp(9));
        radioScreen.addView(status,wrap(3));
        LinearLayout controls=row();
        next=pill("▶▶ NEXT RECORD",HumkinVisuals.MINT);
        catchUp=pill("⟳ CATCH UP TO AIR",HumkinVisuals.PINK);
        reload=pill("⤨ RESHUFFLE",HumkinVisuals.PINK);
        controls.addView(next,flex(0));controls.addView(catchUp,flex(10));
        radioScreen.addView(controls,wrap(7));
        radioScreen.addView(reload,fill(54,10));
        next.setOnClickListener(v->{
            if(controller!=null&&!radioMode&&"shuffle".equals(source)
                    &&controller.getMediaItemCount()>0){
                controller.seekToNext();controller.play();
            }
        });
        catchUp.setOnClickListener(v->fetchRadio(true));
        reload.setOnClickListener(v->fetchRadio(true));

        Button albums=pill("▣   ALBUMS  ✳",HumkinVisuals.YELLOW);
        albums.setTextSize(23);
        albums.setBackground(HumkinVisuals.outlined(this,HumkinVisuals.YELLOW,26,HumkinVisuals.INK));
        radioScreen.addView(albums,fill(72,21));
        albums.setOnClickListener(v->showAlbums(true));

        TextView footer=text("✳   THE ROAD IS LONG · THE MUSIC IS FREE   ✳",11,HumkinVisuals.INK,true);
        radioScreen.addView(footer,wrap(22));
        Button archive=pill("STATION ARCHIVE  ↗",HumkinVisuals.CREAM);
        archive.setBackground(HumkinVisuals.outlined(this,HumkinVisuals.CREAM,25,HumkinVisuals.INK));
        radioScreen.addView(archive,fill(52,12));
        archive.setOnClickListener(v->visit("https://humkin.abundent.org/fm/archive/"));
        TextView disclaimer=text("Recorded liners are performances, not live time or weather. The shared dial is approximate, not a dedicated transmitter.",11,HumkinVisuals.INK,false);
        radioScreen.addView(disclaimer,wrap(15));
    }
    private void buildAlbums(){
        TextView title=text("Albums",38,HumkinVisuals.INK,true);
        title.setTypeface(Typeface.create("serif",Typeface.BOLD_ITALIC));
        albumsScreen.addView(title,wrap(8));
        TextView sub=text("Take a song home.",18,HumkinVisuals.INK,false);
        sub.setTypeface(Typeface.create("serif",Typeface.ITALIC));
        albumsScreen.addView(sub,wrap(0));
        Button back=pill("← BACK TO RADIO",HumkinVisuals.YELLOW);
        albumsScreen.addView(back,fill(54,14));
        back.setOnClickListener(v->showAlbums(false));

        LinearLayout first=row();first.setGravity(Gravity.TOP);
        first.addView(albumCard(AlbumCatalog.MUTANT_POP,HumkinVisuals.BLUSH),flex(0));
        first.addView(albumCard(AlbumCatalog.EVERYWHERE,0xffe1f2dc),flex(12));
        albumsScreen.addView(first,wrap(14));
        LinearLayout second=row();second.setGravity(Gravity.TOP);
        second.addView(infoCard("Warmth","New music for softer days.","ON THE RADIO",HumkinVisuals.BLUSH,()->{
            showAlbums(false);changeMode(true);
        }),flex(0));
        second.addView(infoCard("Singles","New finds and one-offs.","ROAD SHUFFLE",0xffe1f2dc,()->{
            showAlbums(false);changeMode(false);
        }),flex(12));
        albumsScreen.addView(second,wrap(12));

        LinearLayout feature=column();
        feature.setPadding(dp(14),dp(18),dp(14),dp(18));
        feature.setBackground(HumkinVisuals.shape(this,HumkinVisuals.PLUM,24));
        feature.addView(text("✳  FEATURED LISTENING  ✳",12,HumkinVisuals.WHITE,true),wrap(0));
        albumPlaying=text("Choose an album to play.",19,HumkinVisuals.WHITE,true);
        feature.addView(albumPlaying,wrap(10));
        albumState=text("Radio stays available with one tap.",12,HumkinVisuals.WHITE,false);
        feature.addView(albumState,wrap(4));
        albumNext=pill("▶▶ NEXT TRACK",HumkinVisuals.MINT);
        feature.addView(albumNext,fill(48,12));
        albumNext.setOnClickListener(v->{
            if(controller!=null&&"album".equals(source)
                &&controller.getMediaItemCount()>0){
                controller.seekToNext();controller.play();
            }
        });
        albumsScreen.addView(feature,wrap(19));

        LinearLayout controls=row();
        Button radio=pill("◉ SAME-TIME\nRADIO",HumkinVisuals.YELLOW);
        Button shuffle=pill("⤨ ROAD\nSHUFFLE",HumkinVisuals.MINT);
        controls.addView(radio,flex(0));controls.addView(shuffle,flex(11));
        albumsScreen.addView(controls,wrap(16));
        radio.setOnClickListener(v->{showAlbums(false);changeMode(true);});
        shuffle.setOnClickListener(v->{showAlbums(false);changeMode(false);});

        Button privacy=pill("PRIVACY  ↗",HumkinVisuals.CREAM);
        privacy.setBackground(HumkinVisuals.outlined(this,HumkinVisuals.CREAM,26,HumkinVisuals.INK));
        albumsScreen.addView(privacy,fill(48,14));
        privacy.setOnClickListener(v->visit("https://humkin.abundent.org/privacy.html"));
    }
    private LinearLayout albumCard(AlbumCatalog.Album album,int color){
        LinearLayout card=column();
        card.setGravity(Gravity.TOP|Gravity.CENTER_HORIZONTAL);
        card.setPadding(dp(9),dp(10),dp(9),dp(14));
        card.setBackground(HumkinVisuals.shape(this,color,24));
        FrameLayout cover=HumkinVisuals.artTile(this,132,album.coverUrl,worker);
        card.addView(cover,new LinearLayout.LayoutParams(-1,dp(127)));
        TextView name=text(album.title,17,HumkinVisuals.INK,true);
        name.setMaxLines(2);
        name.setMinHeight(dp(48));
        card.addView(name,wrap(10));
        TextView desc=text(album.detail,12,HumkinVisuals.INK,false);
        desc.setMinHeight(dp(53));
        card.addView(desc,wrap(3));
        Button play=pill("▶ PLAY",HumkinVisuals.YELLOW);
        card.addView(play,fill(48,8));
        play.setOnClickListener(v->playAlbum(album));
        Button details=pill("ALBUM ↗",HumkinVisuals.CREAM);
        details.setTextSize(12);
        card.addView(details,fill(42,8));
        details.setOnClickListener(v->visit(album.pageUrl));
        return card;
    }
    private LinearLayout infoCard(String name,String description,String action,
                                 int color,Runnable click){
        LinearLayout card=column();
        card.setGravity(Gravity.TOP|Gravity.CENTER_HORIZONTAL);
        card.setPadding(dp(9),dp(10),dp(9),dp(14));
        card.setBackground(HumkinVisuals.shape(this,color,24));
        FrameLayout cover=HumkinVisuals.artTile(this,132,null,worker);
        card.addView(cover,new LinearLayout.LayoutParams(-1,dp(127)));
        TextView title=text(name,18,HumkinVisuals.INK,true);
        title.setMinHeight(dp(48));card.addView(title,wrap(10));
        TextView desc=text(description,12,HumkinVisuals.INK,false);
        desc.setMinHeight(dp(53));card.addView(desc,wrap(3));
        Button btn=pill(action,HumkinVisuals.YELLOW);
        btn.setTextSize(13);
        card.addView(btn,fill(48,8));
        btn.setOnClickListener(v->click.run());
        TextView hint=text("No standalone album page yet.",10,HumkinVisuals.INK,false);
        card.addView(hint,wrap(8));
        return card;
    }

    private void showAlbums(boolean yes){
        onAlbums=yes;
        if(radioScreen==null||albumsScreen==null)return;
        radioScreen.setVisibility(yes?View.GONE:View.VISIBLE);
        albumsScreen.setVisibility(yes?View.VISIBLE:View.GONE);
        radioNav.setAlpha(yes?.65f:1f);
        albumNav.setAlpha(yes?1f:.65f);
        scroll.post(()->scroll.smoothScrollTo(0,0));
        redraw();
    }
    private void changeMode(boolean radio){
        radioMode=radio;
        showAlbums(false);
        fetchRadio(true);
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
        SessionToken token=new SessionToken(this,new ComponentName(this,RadioPlaybackService.class));
        controllerFuture=new MediaController.Builder(this,token).buildAsync();
        controllerFuture.addListener(()->{
            try{
                controller=controllerFuture.get();
                controller.addListener(listener);
                if("none".equals(source) && controller.getMediaItemCount()>0){
                    MediaItem item=controller.getCurrentMediaItem();
                    String id=item==null?"":item.mediaId;
                    if(id.startsWith("album:"))source="album";
                    else source=radioMode?"radio":"shuffle";
                }
                redraw();
            }catch(Exception e){status.setText("Couldn't connect to the receiver.");}
        },this::runOnUiThread);
    }
    @Override public void onStop(){
        alive=false;
        if(controller!=null){controller.removeListener(listener);controller=null;}
        if(controllerFuture!=null){
            MediaController.releaseFuture(controllerFuture);controllerFuture=null;
        }
        super.onStop();
    }
    @Override public void onDestroy(){worker.shutdownNow();super.onDestroy();}

    private void tuneIn(){
        if(controller==null){status.setText("Connecting. Try again.");return;}
        String expected=radioMode?"radio":"shuffle";
        if(controller.getMediaItemCount()==0 || !expected.equals(source)){
            fetchRadio(true);
        }else if(controller.isPlaying())controller.pause();
        else if(radioMode)fetchRadio(true);
        else controller.play();
    }
    private void fetchRadio(boolean force){
        if(controller==null||!loading.compareAndSet(false,true)){
            if(controller==null && status!=null)status.setText("Connecting receiver…");
            return;
        }
        final boolean requested=radioMode;
        status.setText("Gathering the station records…");
        setBusy(true);
        worker.execute(()->{
            try{
                RadioCatalog.Station loaded=RadioCatalog.loadStation();
                List<MediaItem> shuffle=requested?null:loaded.shuffleQueue();
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
                        status.setText(loaded.clockCalibrated&&loaded.catalogComplete&&!loaded.scheduledShowsExist
                                ?"Approx. tuned to the shared HUMKIN dial."
                                :"Approximate dial · some shows may differ.");
                    }else{
                        RadioPlaybackService.clearSameTime();
                        controller.setMediaItems(shuffle);
                        source="shuffle";
                        status.setText(loaded.songsCount()+" songs on your own road.");
                    }
                    controller.prepare();controller.play();redraw();
                });
            }catch(Exception e){
                runOnUiThread(()->{
                    loading.set(false);setBusy(false);
                    if(alive)status.setText("No radio connection. Check the internet and try again.");
                });
            }
        });
    }
    private void playAlbum(AlbumCatalog.Album album){
        if(controller==null){albumState.setText("Connecting to the receiver…");return;}
        if(!loading.compareAndSet(false,true))return;
        albumState.setText("Opening "+album.title+"…");
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
                    albumState.setText(list.size()+" songs · playing in order.");
                    redraw();
                });
            }catch(Exception ex){
                runOnUiThread(()->{
                    loading.set(false);setBusy(false);
                    if(alive)albumState.setText("Album isn't reachable. Try ALBUM ↗ for the web player.");
                });
            }
        });
    }
    private void setBusy(boolean busy){
        if(tune!=null)tune.setEnabled(!busy);
        if(reload!=null)reload.setEnabled(!busy);
        if(catchUp!=null)catchUp.setEnabled(!busy);
    }
    private void redraw(){
        if(tune==null||nowPlaying==null||controller==null&&status==null)return;
        if(sameTime!=null)sameTime.setAlpha(radioMode?1f:.62f);
        if(road!=null)road.setAlpha(radioMode?.62f:1f);
        if(modeNote!=null)modeNote.setText(radioMode
            ?"You're on Same-Time Radio. Tune into the shared station clock (approximately)."
            :"You're on Road Shuffle. Every trip gets its own playlist.");
        if(next!=null)next.setVisibility(radioMode?View.GONE:View.VISIBLE);
        if(catchUp!=null)catchUp.setVisibility(radioMode?View.VISIBLE:View.GONE);
        if(reload!=null)reload.setVisibility(radioMode?View.GONE:View.VISIBLE);
        boolean ready=controller!=null&&controller.getMediaItemCount()>0;
        if(next!=null)next.setEnabled(ready&&"shuffle".equals(source));
        if(albumNext!=null)albumNext.setEnabled(ready&&"album".equals(source));
        if(tune!=null)tune.setText(ready&&controller.isPlaying()&&
                (radioMode?"radio":"shuffle").equals(source)
                ?"Ⅱ  PAUSE":"▶   TUNE IN");
        MediaItem item=ready?controller.getCurrentMediaItem():null;
        if(item!=null) {
            CharSequence title=item.mediaMetadata.title;
            CharSequence artist=item.mediaMetadata.artist;
            String name=title==null?"HUMKIN":title.toString();
            String by=artist==null?"RADIO":artist.toString();
            if(nowPlaying!=null)nowPlaying.setText(name+"\n"+by);
            if(albumPlaying!=null)albumPlaying.setText(name);
            if(albumState!=null && "album".equals(source))
                albumState.setText(currentAlbum+" · "+(controller.isPlaying()?"Playing":"Paused"));
        }else{
            nowPlaying.setText("The road is waiting.");
            if(albumPlaying!=null)albumPlaying.setText("Choose an album to play.");
        }
    }
}
