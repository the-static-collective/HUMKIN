package org.abundent.humkinradio;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.widget.Button;
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

/** Two native listening modes; service retains audio after the screen locks. */
public final class MainActivity extends Activity {
    private final ExecutorService network=Executors.newSingleThreadExecutor();
    private final AtomicBoolean loading=new AtomicBoolean(false);
    private MediaController controller;
    private ListenableFuture<MediaController> controllerFuture;
    private RadioCatalog.Station currentStation;
    private TextView nowPlaying,status,modeNote;
    private Button tune,next,reload,sameTime,road,catchUp;
    private boolean alive;
    private boolean radioMode=true;

    private final Player.Listener playbackListener=new Player.Listener(){
        @Override public void onEvents(Player player,Player.Events events){redraw();}
    };

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(33,27,58));
        getWindow().setNavigationBarColor(Color.rgb(33,27,58));
        if(savedInstanceState!=null)radioMode=savedInstanceState.getBoolean("radioMode",true);
        buildScreen();
    }
    @Override public void onSaveInstanceState(Bundle out) {
        out.putBoolean("radioMode",radioMode);
        super.onSaveInstanceState(out);
    }

    private void buildScreen() {
        int ink=Color.rgb(33,27,58),cream=Color.rgb(255,247,232);
        ScrollView scroll=new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(cream);
        LinearLayout panel=new LinearLayout(this);
        panel.setPadding(dp(26),dp(38),dp(26),dp(38));
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setGravity(Gravity.CENTER_HORIZONTAL);
        scroll.addView(panel);
        panel.addView(label("✳",48,ink,0));
        panel.addView(label("HUMKIN\nRADIO.",48,ink,1));
        panel.addView(label("Music for the long way home.",18,ink,0));
        sameTime=button("◉ SAME-TIME RADIO",Color.rgb(255,229,117));
        road=button("⤨ ROAD SHUFFLE",Color.rgb(196,255,228));
        panel.addView(sameTime);panel.addView(road);
        modeNote=label("",13,ink,0);panel.addView(modeNote);

        nowPlaying=label("The road is waiting.",24,ink,1);
        nowPlaying.setPadding(0,dp(34),0,dp(10));panel.addView(nowPlaying);
        status=label("No ads. No account. Just tune in.",14,ink,0);panel.addView(status);
        tune=button("▶ TUNE IN",Color.rgb(255,229,117));
        next=button("NEXT RECORD →",Color.rgb(196,255,228));
        catchUp=button("⟳ CATCH UP TO AIR",Color.rgb(241,191,210));
        reload=button("RESHUFFLE THE CRATE",Color.rgb(241,191,210));
        panel.addView(tune);panel.addView(next);panel.addView(catchUp);panel.addView(reload);
        tune.setOnClickListener(v->tuneIn());
        next.setOnClickListener(v->{
            if(controller!=null&&controller.getMediaItemCount()>0&&!radioMode){
                controller.seekToNext();controller.play();
            }
        });
        catchUp.setOnClickListener(v->fetchQueue(true));
        reload.setOnClickListener(v->fetchQueue(true));
        sameTime.setOnClickListener(v->changeMode(true));
        road.setOnClickListener(v->changeMode(false));

        Button archive=button("STATION ARCHIVE ↗",cream);
        archive.setOnClickListener(v->visit("https://humkin.abundent.org/fm/archive/"));
        panel.addView(archive);
        Button privacy=button("PRIVACY ↗",cream);
        privacy.setOnClickListener(v->visit("https://humkin.abundent.org/privacy.html"));
        panel.addView(privacy);
        panel.addView(label("Recorded radio liners are performances, not live clock or weather announcements.",12,ink,0));
        setContentView(scroll);
        redraw();
    }

    private void changeMode(boolean radio) {
        if(radioMode==radio&&controller!=null&&controller.getMediaItemCount()>0)return;
        radioMode=radio;
        redraw();
        fetchQueue(true);
    }
    private TextView label(String value,int sp,int color,int weight) {
        TextView t=new TextView(this);
        t.setText(value);t.setTextColor(color);t.setTextSize(sp);
        t.setGravity(Gravity.CENTER);t.setPadding(0,dp(10),0,dp(10));
        if(weight==1)t.setTypeface(null,android.graphics.Typeface.BOLD);
        return t;
    }
    private Button button(String value,int color) {
        Button b=new Button(this);b.setText(value);b.setAllCaps(false);
        b.setBackgroundTintList(ColorStateList.valueOf(color));
        b.setTextColor(Color.rgb(33,27,58));
        LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,dp(58));
        p.topMargin=dp(13);b.setLayoutParams(p);return b;
    }
    private void visit(String url) {
        startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)));
    }
    private int dp(int n) {
        return Math.round(n*getResources().getDisplayMetrics().density);
    }

    @Override public void onStart() {
        super.onStart();
        alive=true;
        SessionToken token=new SessionToken(this,new ComponentName(this,RadioPlaybackService.class));
        controllerFuture=new MediaController.Builder(this,token).buildAsync();
        controllerFuture.addListener(()->{
            try{
                controller=controllerFuture.get();
                controller.addListener(playbackListener);
                redraw();
            }catch(Exception e){status.setText("Couldn't connect to the audio service.");}
        },this::runOnUiThread);
    }
    @Override public void onStop() {
        alive=false;
        if(controller!=null){controller.removeListener(playbackListener);controller=null;}
        if(controllerFuture!=null){MediaController.releaseFuture(controllerFuture);controllerFuture=null;}
        super.onStop();
    }
    @Override public void onDestroy() {
        network.shutdownNow();super.onDestroy();
    }

    private void tuneIn() {
        if(controller==null){
            status.setText("Connecting the receiver. Try again.");return;
        }
        if(controller.getMediaItemCount()==0)fetchQueue(true);
        else if(controller.isPlaying())controller.pause();
        else if(radioMode)fetchQueue(true); // Fresh live position on re-tune.
        else controller.play();
    }
    private void fetchQueue(boolean force) {
        if(controller==null||!loading.compareAndSet(false,true))return;
        final boolean requestedMode=radioMode;
        status.setText("Gathering the station's records…");
        tune.setEnabled(false);reload.setEnabled(false);catchUp.setEnabled(false);
        network.execute(()->{
            try{
                RadioCatalog.Station loaded=RadioCatalog.loadStation();
                List<MediaItem> roadQueue=requestedMode?null:loaded.shuffleQueue();
                runOnUiThread(()->{
                    loading.set(false);
                    tune.setEnabled(true);reload.setEnabled(true);catchUp.setEnabled(true);
                    if(!alive||controller==null)return;
                    if(requestedMode!=radioMode){fetchQueue(true);return;}
                    if(!force&&controller.getMediaItemCount()>0)return;
                    currentStation=loaded;
                    if(requestedMode){
                        // Scheduled programs use a separate daypart algorithm in
                        // the browser; do not falsely claim complete parity.
                        SharedClock.Cue cue=loaded.tuneAt(loaded.stationNow());
                        RadioPlaybackService.armSameTime(loaded,cue.cycle+2);
                        controller.setMediaItems(loaded.initialClockQueue(cue),0,cue.positionMs);
                        status.setText(loaded.clockCalibrated&&loaded.catalogComplete&&!loaded.scheduledShowsExist
                              ?"Same-time station clock · approx. shared with the web dial."
                              :"Approximate station clock · some features may differ from the web dial.");
                    }else{
                        RadioPlaybackService.clearSameTime();
                        controller.setMediaItems(roadQueue);
                        status.setText(loaded.songsCount()+" songs on your own road.");
                    }
                    controller.prepare();controller.play();redraw();
                });
            }catch(Exception error){
                runOnUiThread(()->{
                    loading.set(false);
                    tune.setEnabled(true);reload.setEnabled(true);catchUp.setEnabled(true);
                    if(alive)status.setText("Couldn't reach the radio crate. Check connection and retry.");
                });
            }
        });
    }

    private void redraw() {
        if(nowPlaying==null||tune==null||next==null)return;
        sameTime.setAlpha(radioMode?1f:.55f);
        road.setAlpha(!radioMode?1f:.55f);
        modeNote.setText(radioMode
              ?"A shared browser-style station clock. Tune in at today's position.\n"
               +"Not a 24/7 transmitter; buffering may drift."
              :"Your own shuffled records; uninterrupted personal listening.");
        next.setVisibility(radioMode?android.view.View.GONE:android.view.View.VISIBLE);
        reload.setVisibility(radioMode?android.view.View.GONE:android.view.View.VISIBLE);
        catchUp.setVisibility(radioMode?android.view.View.VISIBLE:android.view.View.GONE);
        MediaController c=controller;
        boolean ready=c!=null&&c.getMediaItemCount()>0;
        tune.setText(ready&&c.isPlaying()?"❚❚ PAUSE":"▶ TUNE IN");
        next.setEnabled(ready&&!radioMode);
        MediaItem item=ready?c.getCurrentMediaItem():null;
        if(item!=null){
            CharSequence title=item.mediaMetadata.title,artist=item.mediaMetadata.artist;
            nowPlaying.setText((title==null?"HUMKIN":title)+"\n"
                    +(artist==null?"RADIO":artist));
        }else nowPlaying.setText("The road is waiting.");
    }
}
