package org.abundent.humkinradio;

import android.app.Activity;
import android.content.ComponentName;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;
import com.google.common.util.concurrent.ListenableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** A real local record collection, not an imaginary unlock board.
 * Collected tracks can be downloaded again without a second HUM debit.
 * Android 10+ files are ordinary MP3s in the shared Music/HUMKIN folder. */
public final class MyRecordsActivity extends Activity {
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private LinearLayout shelf;
    private TextView balance,notice;
    private MediaController controller;
    private ListenableFuture<MediaController> connecting;
    private volatile boolean busy;

    private int dp(float n){return HumkinVisuals.dp(this,n);}
    private TextView label(String value,int size,int color,boolean bold){
        return HumkinVisuals.text(this,value,size,color,bold);
    }
    private LinearLayout.LayoutParams wrap(int margin){
        LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);
        lp.topMargin=dp(margin);
        return lp;
    }
    private Button button(String text,int fill,int size){
        Button b=HumkinVisuals.pill(this,text,null,fill,size,false);
        b.setAllCaps(false);b.setMinHeight(dp(48));
        return b;
    }
    @Override public void onCreate(Bundle state){
        super.onCreate(state);
        getWindow().setStatusBarColor(RebelReceiverSkin.NAVY);
        getWindow().setNavigationBarColor(RebelReceiverSkin.NAVY);
        ScrollView scroller=new ScrollView(this);
        scroller.setFillViewport(true);
        scroller.setBackgroundColor(RebelReceiverSkin.PAPER);
        LinearLayout page=new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setPadding(dp(17),dp(16),dp(17),dp(48));
        scroller.addView(page);
        Button back=button("← BACK TO RADIO",HumkinVisuals.YELLOW,13);
        back.setOnClickListener(v->finish());
        page.addView(back,wrap(0));
        TextView top=label("HUMKIN  /  YOUR POCKET RECORD SHOP",11,HumkinVisuals.PLUM,true);
        top.setLetterSpacing(.08f);
        page.addView(top,wrap(20));
        page.addView(label("MY RECORDS.",35,HumkinVisuals.INK,true),wrap(5));
        balance=label("ⓗ 0 HUM",22,HumkinVisuals.INK,true);
        page.addView(balance,wrap(12));
        page.addView(label(
            "HUM is credited by the station server while you listen. "+
            "Your phone's protected key quietly opens this wallet, but account recovery and "+
            "device transfers are not available yet. The MP3s themselves are ordinary, "+
            "unencrypted files: keep them, move them or play them elsewhere.",12,HumkinVisuals.PLUM,false),
            wrap(8));
        notice=label("",12,HumkinVisuals.PLUM,false);
        page.addView(notice,wrap(10));
        shelf=new LinearLayout(this);
        shelf.setOrientation(LinearLayout.VERTICAL);
        page.addView(shelf,wrap(12));
        setContentView(scroller);
        render();
    }
    @Override public void onStart(){
        super.onStart();
        HumServerBridge.refresh(getApplicationContext());
        SessionToken token=new SessionToken(this,new ComponentName(this,RadioPlaybackService.class));
        connecting=new MediaController.Builder(this,token).buildAsync();
        connecting.addListener(()->{
            try{controller=connecting.get();}
            catch(Exception ignored){controller=null;}
        },this::runOnUiThread);
        render();
    }
    @Override public void onStop(){
        if(connecting!=null){
            MediaController.releaseFuture(connecting);
            connecting=null;controller=null;
        }
        super.onStop();
    }
    @Override public void onDestroy(){
        worker.shutdown();
        super.onDestroy();
    }
    private void message(String text){notice.setText(text);}
    private void render(){
        if(shelf==null)return;
        HumWallet.Snapshot wallet=HumWallet.snapshot(this);
        HumServerBridge.Snapshot server=HumServerBridge.snapshot(this);
        balance.setText((server.known?"ⓗ "+server.balance+" HUM":"ⓗ CONNECTING…")+
            "   ·   "+server.records.length()+" RECORDS");
        if(!server.known)notice.setText(
            "The server wallet hasn't connected yet. Your downloaded MP3s still play.");
        shelf.removeAllViews();
        if(wallet.records.isEmpty()){
            shelf.addView(label(server.records.length()>0?
                "Your station wallet has collected records, but this device has no cached song files. "+
                "Play a record on the dial and tap KEEP to restore it without another charge.":
                "The shelf is empty. Find a song on the dial and tap KEEP "+
                "to put your first record here.",14,HumkinVisuals.INK,false),wrap(10));
            return;
        }
        for(HumWallet.Record r:wallet.records){
            boolean downloaded=MusicLibrary.exists(this,r.uri);
            LinearLayout card=new LinearLayout(this);
            card.setOrientation(LinearLayout.VERTICAL);
            card.setPadding(dp(14),dp(13),dp(14),dp(14));
            android.graphics.drawable.GradientDrawable paper=
                HumkinVisuals.shape(this,0xfffffdf6,10);
            paper.setStroke(dp(2),HumkinVisuals.INK);
            card.setBackground(paper);
            shelf.addView(card,wrap(12));
            card.addView(label(r.title,19,HumkinVisuals.INK,true),wrap(0));
            card.addView(label(r.artist+"  ·  "+(downloaded?
                "ON THIS PHONE":"COLLECTED · NOT DOWNLOADED"),11,HumkinVisuals.PLUM,false),wrap(5));
            Button action=button(downloaded?"▶ PLAY OFFLINE":"↓ DOWNLOAD RECORD",
                downloaded?HumkinVisuals.MINT:HumkinVisuals.YELLOW,14);
            action.setEnabled(!busy);
            action.setOnClickListener(v->{
                if(downloaded)play(r);
                else download(r);
            });
            card.addView(action,wrap(12));
            if(downloaded){
                Button remove=button("REMOVE FILE · KEEP IN COLLECTION",
                    HumkinVisuals.CREAM,11);
                remove.setOnClickListener(v->{
                    if(busy)return;
                    if(MusicLibrary.delete(this,r.uri)){
                        HumWallet.clearDownloaded(this,r.id);
                        message("Record removed from this phone. You can download it again for free.");
                        render();
                    }else message("Couldn't remove the file. Try again from your Music app.");
                });
                card.addView(remove,wrap(7));
            }
        }
    }
    private void download(HumWallet.Record record){
        if(busy)return;
        busy=true;
        message("Downloading "+record.title+" into Music/HUMKIN…");
        render();
        worker.execute(()->{
            String outcome;
            try{
                Uri file=MusicLibrary.download(getApplicationContext(),record);
                if(!HumWallet.setDownloaded(getApplicationContext(),record.id,file.toString())){
                    MusicLibrary.delete(getApplicationContext(),file.toString());
                    throw new java.io.IOException("Couldn't remember the downloaded file");
                }
                outcome="Saved "+record.title+" as an ordinary MP3. No DRM.";
            }catch(Exception e){
                outcome="Download didn't finish. Your record is still collected; retry without paying again.";
            }
            final String done=outcome;
            runOnUiThread(()->{
                if(isFinishing()||isDestroyed())return;
                busy=false;message(done);render();
            });
        });
    }
    private void play(HumWallet.Record record){
        if(controller==null){
            Toast.makeText(this,"Connecting to the radio player…",Toast.LENGTH_SHORT).show();
            return;
        }
        if(!MusicLibrary.exists(this,record.uri)){
            message("The file was moved. Download it again without spending HUM.");
            render();
            return;
        }
        try{
            MediaItem item=new MediaItem.Builder()
                .setMediaId("library:"+record.id)
                .setUri(Uri.parse(record.uri))
                .setMediaMetadata(new MediaMetadata.Builder()
                    .setTitle(record.title).setArtist(record.artist)
                    .setAlbumTitle("MY RECORDS").build())
                .build();
            RadioPlaybackService.clearSameTime();
            controller.setMediaItem(item);
            controller.prepare();controller.play();
            message("Now playing "+record.title+" · offline file");
        }catch(Exception ignored){
            message("Couldn't start playback. Your MP3 is still in Music/HUMKIN.");
        }
    }
}
