package org.abundent.humkinradio;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ComponentName;
import android.content.Intent;
import android.graphics.Typeface;
import android.os.Build;
import android.os.Bundle;
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
    private final AtomicBoolean loading=new AtomicBoolean(false);
    private MediaController controller;
    private ListenableFuture<MediaController> controllerFuture;
    private TextView nowPlaying, status, albumPlaying, albumState;
    private TextView onDeck, recentlyHeard;
    private String lastRenderedTrackId = "";

    private TextView tagline, albumHeading, playingHeading, playingArtist, featureHeading, featureArtist;
    private ImageView radioArt, featureArt;
    private LinearLayout firstAlbums, secondAlbums;
    private boolean wideCards, modeStyled;
    private OnBackInvokedCallback albumsBack;
    private Button tune,sameTime,road,albumNext;
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
        warmStaticEnabled=getSharedPreferences("humkin-radio",MODE_PRIVATE)
                .getBoolean("analog-static",true);
        RadioPlaybackService.setWarmStaticEnabled(warmStaticEnabled);
        buildScreen();
        if (Build.VERSION.SDK_INT >= 35) {
            WindowInsetsController bars = getWindow().getInsetsController();
            int lightAppearance = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                    | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
            if (bars != null) bars.setSystemBarsAppearance(lightAppearance, lightAppearance);
            scroll.setOnApplyWindowInsetsListener((view, insets) -> {
                android.graphics.Insets system = insets.getInsets(
                        WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                view.setPadding(system.left, system.top, system.right, system.bottom);
                return WindowInsets.CONSUMED;
            });
            scroll.requestApplyInsets();
        } else {
            getWindow().setStatusBarColor(CREAM);
            getWindow().setNavigationBarColor(CREAM);
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
                    | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
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
        scroll.setBackgroundColor(CREAM);
        scroll.setVerticalScrollBarEnabled(false);
        FrameLayout page = new FrameLayout(this);
        scroll.addView(page);
        LinearLayout outer = column();
        outer.setPadding(0, 0, 0, 0);
        page.addView(outer, new FrameLayout.LayoutParams(dp(Math.min(520, width)), -2,
                Gravity.TOP | Gravity.CENTER_HORIZONTAL));
        addWebHero(outer,width);

        albumHeading = text("ALBUMS / THE RECORD SHELF", 24, INK, true);
        albumHeading.setPadding(dp(inset),dp(12),dp(inset),0);
        albumHeading.setGravity(Gravity.START);
        if (Build.VERSION.SDK_INT >= 28) albumHeading.setAccessibilityHeading(true);
        outer.addView(albumHeading, wrap(0));
        tagline = text("", 16, INK, false);
        HumkinVisuals.italic(tagline);
        tagline.setPadding(dp(inset),dp(8),dp(inset),0);
        tagline.setGravity(Gravity.START);
        outer.addView(tagline, wrap(0));
        // The paper collage was a reference mockup, not canonical album art.
        // Use a native color rule instead of packaging that concept art.
        View rule = new View(this);
        rule.setBackground(HumkinVisuals.shape(this, PINK, 2));
        LinearLayout.LayoutParams mark = new LinearLayout.LayoutParams(dp(205), dp(3));
        mark.topMargin = dp(12);
        mark.leftMargin = dp(inset);
        outer.addView(rule, mark);

        radioScreen = column();
        albumsScreen = column();
        radioScreen.setPadding(dp(inset), 0, dp(inset), 0);
        albumsScreen.setPadding(dp(inset), 0, dp(inset), 0);
        outer.addView(radioScreen, wrap(12));
        outer.addView(albumsScreen, wrap(12));
        buildRadio();
        buildAlbums();
        // No concept-art skyline: only published music/album artwork is canon.
        showAlbums(onAlbums);
        setContentView(scroll);
    }

    private void addWebHero(LinearLayout outer, int width) {
        LinearLayout hero=column();
        hero.setGravity(Gravity.START);
        hero.setPadding(dp(19),dp(26),dp(19),dp(24));
        hero.setBackground(HumkinVisuals.panel(this,0xff211b3a,0xff35365b,0));
        TextView eyebrow=text("✳  THE LITTLE STATION AT THE END OF THE DIAL",10,YELLOW,true);
        eyebrow.setGravity(Gravity.START);
        eyebrow.setLetterSpacing(.09f);
        hero.addView(eyebrow,wrap(0));

        TextView masthead=text("HUMKIN",width<350?55:70,WHITE,true);
        masthead.setGravity(Gravity.START);
        masthead.setSingleLine(true);
        masthead.setLetterSpacing(-.075f);
        if (Build.VERSION.SDK_INT >= 28) masthead.setAccessibilityHeading(true);
        hero.addView(masthead,wrap(13));

        TextView radio=text("R A D I O",width<350?22:27,YELLOW,true);
        radio.setGravity(Gravity.START);
        radio.setLetterSpacing(.035f);
        hero.addView(radio,wrap(0));
        TextView line=text("MUSIC FOR THE LONG WAY HOME.",12,WHITE,true);
        line.setGravity(Gravity.START);
        line.setLetterSpacing(.075f);
        hero.addView(line,wrap(16));
        outer.addView(hero,wrap(0));

        TextView strip=text("✳   SONGS • STORIES • A LITTLE STATIC   ✳",10,INK,true);
        strip.setBackgroundColor(YELLOW);
        strip.setMinHeight(dp(34));
        strip.setLetterSpacing(.045f);
        outer.addView(strip,wrap(0));
    }

    private void buildRadio() {
        LinearLayout heading = row();
        TextView dial=text("THE HUMKIN DIAL",23,INK,true);
        dial.setGravity(Gravity.START);
        dial.setLetterSpacing(-.035f);
        if (Build.VERSION.SDK_INT >= 28) dial.setAccessibilityHeading(true);
        heading.addView(dial, new LinearLayout.LayoutParams(0, -2, 1f));
        // One discreet overflow keeps specialist controls without clutter.
        Button more = pill("⋯", null, CREAM, 22);
        more.setContentDescription("More radio controls, signal settings and history");
        more.setMinHeight(dp(43));
        more.setOnClickListener(v -> showMoreRadio());
        heading.addView(more, new LinearLayout.LayoutParams(dp(53),dp(44)));
        radioScreen.addView(heading,wrap(0));
        TextView kicker=text("AN IMPERFECT SIGNAL. A REAL GOOD SONG.",10,PLUM,true);
        kicker.setGravity(Gravity.START);
        kicker.setLetterSpacing(.06f);
        radioScreen.addView(kicker,wrap(4));
        sameTime = pill("SAME-TIME\nRADIO", Icon.RADIO, YELLOW, 18);
        road = pill("ROAD\nSHUFFLE", Icon.SHUFFLE, MINT, 18);
        sameTime.setMinHeight(dp(66));
        road.setMinHeight(dp(66));
        addPair(radioScreen, sameTime, road, 0);
        sameTime.setOnClickListener(v -> changeMode(true));
        road.setOnClickListener(v -> changeMode(false));

        // Secondary reception settings are in the ⋯ overflow, not the dial.

        LinearLayout player = console();
        radioArt = HumkinVisuals.art(this, R.drawable.ic_radio);
        LinearLayout labels = consoleLabels(player, radioArt, wideCards ? 109 : 80);
        playingHeading = consoleHeading(labels, "NOW PLAYING");
        nowPlaying = consoleTitle(labels, "Ready to tune in", wideCards ? 26 : 21);
        playingArtist = consoleSubtitle(labels);
        radioWaveform = addWaveform(labels);
        radioScreen.addView(player, wrap(12));

        tune = pill("TUNE IN", Icon.PLAY, YELLOW, 26);
        tune.setMinHeight(dp(58));
        tune.setOnClickListener(v -> tuneIn());
        radioScreen.addView(tune, wrap(13));

        status = message(INK);
        radioScreen.addView(status, wrap(5));

        // A compact two-row station log, rather than the old explanation,
        // full technical card and five-line history panel.
        LinearLayout stationLog = column();
        stationLog.setGravity(Gravity.START);
        stationLog.setPadding(dp(13), dp(11), dp(13), dp(11));
        android.graphics.drawable.GradientDrawable logPaper =
                HumkinVisuals.shape(this, 0xfffffdf6, 9);
        logPaper.setStroke(dp(2), INK);
        stationLog.setBackground(logPaper);

        TextView nextLabel = text("COMING UP", 10, PLUM, true);
        nextLabel.setGravity(Gravity.START);
        nextLabel.setLetterSpacing(.09f);
        stationLog.addView(nextLabel, wrap(0));
        onDeck = text("—", 14, INK, true);
        onDeck.setGravity(Gravity.START);
        onDeck.setSingleLine(true);
        onDeck.setEllipsize(TextUtils.TruncateAt.END);
        stationLog.addView(onDeck, wrap(3));

        View divider = new View(this);
        divider.setBackgroundColor(0xffead5dc);
        LinearLayout.LayoutParams dividerSize = new LinearLayout.LayoutParams(-1, dp(1));
        dividerSize.topMargin = dp(9);
        dividerSize.bottomMargin = dp(8);
        stationLog.addView(divider, dividerSize);

        TextView heardLabel = text("JUST PLAYED", 10, PLUM, true);
        heardLabel.setGravity(Gravity.START);
        heardLabel.setLetterSpacing(.09f);
        stationLog.addView(heardLabel, wrap(0));
        recentlyHeard = text("—", 13, INK, false);
        recentlyHeard.setGravity(Gravity.START);
        recentlyHeard.setMaxLines(2);
        recentlyHeard.setEllipsize(TextUtils.TruncateAt.END);
        stationLog.addView(recentlyHeard, wrap(3));
        updateRecentRecords();
        radioScreen.addView(stationLog, wrap(12));

        Button albums = HumkinVisuals.pill(this, "ALBUMS", Icon.ALBUMS, YELLOW, 29, true);
        albums.setMinHeight(dp(61));
        albums.setOnClickListener(v -> showAlbums(true));
        radioScreen.addView(albums, wrap(12));

        Button share = pill("SHARE THE DIAL", null, MINT, 13);
        share.setOnClickListener(v -> {
            Intent sending = new Intent(Intent.ACTION_SEND);
            sending.setType("text/plain");
            sending.putExtra(Intent.EXTRA_TEXT,
                    "You found us. HUMKIN RADIO — music for the long way home. "
                            + "https://humkin.abundent.org/fm/");
            startActivity(Intent.createChooser(sending, "Share HUMKIN RADIO"));
        });
        Button request = pill("REQUEST LINE ↗", null, PINK, 13);
        request.setOnClickListener(v ->
                visit("https://humkin.abundent.org/fm/line/"));
        addPair(radioScreen, share, request, 11);
        // The shelf is one tap away via ALBUMS; no duplicated shortcut row.
        // Archive, privacy, listening history, and tuning options live in ⋯.
    }


    private void showMoreRadio() {
        // Keep the radio's primary face for listening. All secondary actions
        // remain available without a network request or another page.
        List<String> titles = new ArrayList<>();
        List<Runnable> actions = new ArrayList<>();
        titles.add(warmStaticEnabled
                ? "Static + signal dips  ·  ON (tap to turn off)"
                : "Static + signal dips  ·  OFF (tap to turn on)");
        actions.add(() -> {
            warmStaticEnabled = !warmStaticEnabled;
            getSharedPreferences("humkin-radio", MODE_PRIVATE).edit()
                    .putBoolean("analog-static", warmStaticEnabled).apply();
            RadioPlaybackService.setWarmStaticEnabled(warmStaticEnabled);
            Toast.makeText(this, warmStaticEnabled
                    ? "Analog radio texture on" : "Analog radio texture off",
                    Toast.LENGTH_SHORT).show();
        });
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
        Button radioNav = pill("RADIO", Icon.RADIO, MINT, 17);
        Button albumNav = pill("ALBUMS", Icon.ALBUMS, YELLOW, 17);
        albumNav.setSelected(true);
        radioNav.setOnClickListener(v -> showAlbums(false));
        albumNav.setOnClickListener(v -> scroll.smoothScrollTo(0, 0));
        addPair(albumsScreen, radioNav, albumNav, 0);

        Button back = pill("BACK TO RADIO", Icon.BACK, YELLOW, 16);
        back.setOnClickListener(v -> showAlbums(false));
        albumsScreen.addView(back, wrap(9));

        firstAlbums = addAlbums(
                albumCard(AlbumCatalog.MUTANT_POP, R.drawable.album_mutant_pop, "Bright, strange and familiar."),
                albumCard(AlbumCatalog.EVERYWHERE, R.drawable.album_everywhere_near_you, "Road songs for close and far away."));
        secondAlbums = addAlbums(
                shelfCard("Warmth", "Gentle tracks for softer days.", R.drawable.ic_radio,
                        "ON AIR", Icon.RADIO, () -> changeMode(true)),
                shelfCard("Singles", "New finds and one-offs.", R.drawable.ic_radio,
                        "SHUFFLE", Icon.SHUFFLE, () -> changeMode(false)));

        LinearLayout feature = console();
        featureArt = HumkinVisuals.art(this, R.drawable.album_mutant_pop);
        LinearLayout labels = consoleLabels(feature, featureArt, wideCards ? 106 : 80);
        featureHeading = consoleHeading(labels, "FEATURED ALBUM");
        albumPlaying = consoleTitle(labels, "MUTANT POP", 23);
        featureArtist = consoleSubtitle(labels);
        albumWaveform = addWaveform(labels);
        feature.setFocusable(true);
        feature.setContentDescription("Play featured album, MUTANT POP");
        feature.setOnClickListener(v -> playAlbum(AlbumCatalog.MUTANT_POP));
        albumsScreen.addView(feature, wrap(13));

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

        Button radio = pill("SAME-TIME\nRADIO", Icon.RADIO, YELLOW, 16);
        Button shuffle = pill("ROAD\nSHUFFLE", Icon.SHUFFLE, MINT, 16);
        radio.setOnClickListener(v -> changeMode(true));
        shuffle.setOnClickListener(v -> changeMode(false));
        addPair(albumsScreen, radio, shuffle, 11);
        addFooter(albumsScreen);
    }

    private void addPair(LinearLayout screen, View left, View right, int top) {
        LinearLayout pair = row();
        pair.addView(left, flex(0));
        pair.addView(right, flex(8));
        screen.addView(pair, wrap(top));
    }

    private LinearLayout addAlbums(LinearLayout left, LinearLayout right) {
        LinearLayout group = wideCards ? row() : column();
        group.setGravity(Gravity.TOP);
        group.addView(left, wideCards ? flex(0) : wrap(0));
        group.addView(right, wideCards ? flex(8) : wrap(8));
        albumsScreen.addView(group, wrap(9));
        return group;
    }

    private LinearLayout albumCard(AlbumCatalog.Album album, int art, String detail) {
        LinearLayout card = shelfCard(album.title, detail, art, "PLAY", Icon.PLAY,
                () -> playAlbum(album));
        ImageView cover = (ImageView) card.getChildAt(0);
        cover.setContentDescription("Open " + album.title + " album page");
        cover.setFocusable(true);
        cover.setOnClickListener(v -> visit(album.pageUrl));
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
        panel.setPadding(dp(13), dp(13), dp(13), dp(13));
        android.graphics.drawable.GradientDrawable paper=HumkinVisuals.shape(this,0xfffffdf6,8);
        paper.setStroke(dp(3),INK);
        panel.setBackground(paper);
        panel.setElevation(dp(5));
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

    private void addFooter(LinearLayout screen) {
        Button archive = HumkinVisuals.pill(this, "STATION ARCHIVE", Icon.ARCHIVE, CREAM, 12, true);
        Button privacy = HumkinVisuals.pill(this, "PRIVACY", Icon.PRIVACY, CREAM, 12, true);
        archive.setOnClickListener(v -> visit("https://humkin.abundent.org/fm/archive/"));
        privacy.setOnClickListener(v -> visit("https://humkin.abundent.org/privacy.html"));
        addPair(screen, archive, privacy, 11);
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
        tagline.setText(yes ? "Take a song home." : "You found us. Stay awhile.");
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
        if (radioWaveform != null) radioWaveform.setActive(false);
        if (albumWaveform != null) albumWaveform.setActive(false);
        if(controller!=null){controller.removeListener(listener);controller=null;}
        if(controllerFuture!=null){
            MediaController.releaseFuture(controllerFuture);controllerFuture=null;
        }
        super.onStop();
    }
    @Override public void onDestroy(){worker.shutdownNow();super.onDestroy();}

    private void tuneIn(){
        if(controller==null){
            tuneWhenReady = true;
            showMessage(status, "Connecting the receiver…");
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
        if (!modeStyled || sameTime.isSelected() != radioMode) {
            HumkinVisuals.setPillFill(sameTime, radioMode ? YELLOW : MINT, false);
            HumkinVisuals.setPillFill(road, radioMode ? MINT : YELLOW, false);
            sameTime.setSelected(radioMode);
            road.setSelected(!radioMode);
            modeStyled = true;
        }
        boolean ready = controller != null && controller.getMediaItemCount() > 0;
        boolean stationPlaying = ready && controller.isPlaying()
                && (radioMode ? "radio" : "shuffle").equals(source);
        if (stationPlaying != "PAUSE".contentEquals(tune.getText())) {
            tune.setText(stationPlaying ? "PAUSE" : "TUNE IN");
            HumkinVisuals.setIcon(tune, stationPlaying ? Icon.PAUSE : Icon.PLAY, 31);
        }

        MediaItem item = ready ? controller.getCurrentMediaItem() : null;
        String thisId = item == null ? "" : item.mediaId;
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
                : playing ? "NOW PLAYING" : loadingTrack ? "TUNING IN" : "ON THE DIAL");
        nowPlaying.setText(item == null ? "Ready to tune in" : name);
        playingArtist.setVisibility(item == null ? View.GONE : View.VISIBLE);
        playingArtist.setText(artist);
        radioArt.setImageResource(artwork);

        View feature = (View) featureArt.getParent();
        featureHeading.setText(albumActive
                ? (playing ? "ALBUM PLAYING" : loadingTrack ? "OPENING ALBUM" : "ALBUM SELECTED")
                : "FEATURED ALBUM");
        albumPlaying.setText(albumActive ? name : "MUTANT POP");
        featureArt.setImageResource(albumActive ? artwork : R.drawable.album_mutant_pop);
        featureArtist.setVisibility(albumActive ? View.VISIBLE : View.GONE);
        if (albumActive) {
            CharSequence albumTitle = item.mediaMetadata.albumTitle;
            featureArtist.setText(albumTitle != null ? albumTitle : currentAlbum);
        }
        feature.setClickable(!albumActive);
        feature.setFocusable(!albumActive);
        feature.setContentDescription(albumActive ? null : "Play featured album, MUTANT POP");
        albumNext.setVisibility(albumActive ? View.VISIBLE : View.GONE);
    }
}
