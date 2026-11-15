package org.abundent.humkinradio;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
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

/** Lightweight native receiver. The playback service survives screen lock. */
public final class MainActivity extends Activity {
    private final ExecutorService network = Executors.newSingleThreadExecutor();
    private final AtomicBoolean loading = new AtomicBoolean(false);
    private MediaController controller;
    private ListenableFuture<MediaController> controllerFuture;
    private TextView nowPlaying, status;
    private Button tune, next, reload;
    private boolean alive;

    private final Player.Listener playbackListener = new Player.Listener() {
        @Override public void onEvents(Player player, Player.Events events) {
            redraw();
        }
    };

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(33,27,58));
        getWindow().setNavigationBarColor(Color.rgb(33,27,58));
        buildScreen();
    }

    private void buildScreen() {
        int ink = Color.rgb(33,27,58), cream = Color.rgb(255,247,232);
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(cream);
        LinearLayout panel = new LinearLayout(this);
        panel.setPadding(dp(26), dp(38), dp(26), dp(38));
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setGravity(Gravity.CENTER_HORIZONTAL);
        scroll.addView(panel);

        TextView star = label("✳", 48, ink, 0);
        panel.addView(star);
        panel.addView(label("HUMKIN\nRADIO.", 48, ink, 1));
        panel.addView(label("Music for the long way home.", 18, ink, 0));
        panel.addView(label("ROAD SHUFFLE · NATIVE RECEIVER", 13, ink, 1));

        nowPlaying = label("The road is waiting.", 24, ink, 1);
        nowPlaying.setPadding(0,dp(34),0,dp(10));
        panel.addView(nowPlaying);
        status = label("No ads. No account. One good record at a time.", 14, ink, 0);
        panel.addView(status);
        tune = button("▶ TUNE IN", Color.rgb(255,229,117));
        next = button("NEXT RECORD →", Color.rgb(196,255,228));
        reload = button("RESHUFFLE THE CRATE", Color.rgb(241,191,210));
        panel.addView(tune); panel.addView(next); panel.addView(reload);
        tune.setOnClickListener(v -> tuneIn());
        next.setOnClickListener(v -> {
            if (controller != null && controller.getMediaItemCount() > 0) {
                controller.seekToNext();
                controller.play();
            }
        });
        reload.setOnClickListener(v -> fetchQueue(true));

        Button shared = button("SAME-TIME RADIO ↗", cream);
        shared.setOnClickListener(v -> visit("https://humkin.abundent.org/fm/"));
        panel.addView(shared);
        panel.addView(label("The shared-clock dial still lives on the website. "
                + "This native Road Shuffle keeps turning over records with the screen off.", 13, ink, 0));

        Button archive = button("STATION ARCHIVE ↗", cream);
        archive.setOnClickListener(v -> visit("https://humkin.abundent.org/fm/archive/"));
        panel.addView(archive);
        Button privacy = button("PRIVACY ↗", cream);
        privacy.setOnClickListener(v -> visit("https://humkin.abundent.org/privacy.html"));
        panel.addView(privacy);
        setContentView(scroll);
        redraw();
    }

    private TextView label(String value, int sp, int color, int weight) {
        TextView t = new TextView(this);
        t.setText(value);
        t.setTextColor(color);
        t.setTextSize(sp);
        t.setGravity(Gravity.CENTER);
        t.setPadding(0,dp(10),0,dp(10));
        if (weight == 1) t.setTypeface(null, android.graphics.Typeface.BOLD);
        return t;
    }

    private Button button(String value, int color) {
        Button b = new Button(this);
        b.setText(value);
        b.setAllCaps(false);
        b.setBackgroundTintList(ColorStateList.valueOf(color));
        b.setTextColor(Color.rgb(33,27,58));
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(58));
        p.topMargin = dp(13);
        b.setLayoutParams(p);
        return b;
    }

    private void visit(String url) {
        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
    }

    private int dp(int n) {
        return Math.round(n * getResources().getDisplayMetrics().density);
    }

    @Override public void onStart() {
        super.onStart();
        alive = true;
        SessionToken token = new SessionToken(this,
                new ComponentName(this, RadioPlaybackService.class));
        controllerFuture = new MediaController.Builder(this, token).buildAsync();
        controllerFuture.addListener(() -> {
            try {
                controller = controllerFuture.get();
                controller.addListener(playbackListener);
                redraw();
            } catch (Exception e) {
                status.setText("Couldn't connect to the audio service.");
            }
        }, this::runOnUiThread);
    }

    @Override public void onStop() {
        alive = false;
        if (controller != null) {
            controller.removeListener(playbackListener);
            controller = null;
        }
        if (controllerFuture != null) {
            MediaController.releaseFuture(controllerFuture);
            controllerFuture = null;
        }
        super.onStop();
    }

    @Override public void onDestroy() {
        network.shutdownNow();
        super.onDestroy();
    }

    private void tuneIn() {
        if (controller == null) {
            status.setText("Connecting the receiver. Try again.");
            return;
        }
        if (controller.getMediaItemCount() == 0) {
            fetchQueue(false);
        } else if (controller.isPlaying()) {
            controller.pause();
        } else {
            controller.play();
        }
    }

    private void fetchQueue(boolean force) {
        if (controller == null || !loading.compareAndSet(false, true)) return;
        status.setText("Gathering the station's records…");
        tune.setEnabled(false);
        reload.setEnabled(false);
        network.execute(() -> {
            try {
                List<MediaItem> queue = RadioCatalog.load();
                runOnUiThread(() -> {
                    loading.set(false);
                    tune.setEnabled(true);
                    reload.setEnabled(true);
                    if (!alive || controller == null) return;
                    // A refresh interrupts playback only when the listener asked.
                    if (!force && controller.getMediaItemCount() > 0) return;
                    controller.setMediaItems(queue);
                    controller.prepare();
                    controller.play();
                    status.setText(queue.size() + " records, including approved station IDs when available.");
                    redraw();
                });
            } catch (Exception error) {
                runOnUiThread(() -> {
                    loading.set(false);
                    tune.setEnabled(true);
                    reload.setEnabled(true);
                    if (alive) status.setText("No connection to the crate. Check internet and retry.");
                });
            }
        });
    }

    private void redraw() {
        if (nowPlaying == null || tune == null || next == null) return;
        MediaController c = controller;
        boolean ready = c != null && c.getMediaItemCount() > 0;
        tune.setText(ready && c.isPlaying() ? "❚❚ PAUSE" : "▶ TUNE IN");
        next.setEnabled(ready);
        MediaItem item = ready ? c.getCurrentMediaItem() : null;
        if (item != null) {
            CharSequence title = item.mediaMetadata.title;
            CharSequence artist = item.mediaMetadata.artist;
            nowPlaying.setText((title == null ? "HUMKIN" : title)
                    + "\n" + (artist == null ? "RADIO" : artist));
        } else {
            nowPlaying.setText("The road is waiting.");
        }
    }
}
