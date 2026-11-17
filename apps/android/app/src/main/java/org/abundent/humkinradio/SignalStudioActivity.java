package org.abundent.humkinradio;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * The canonical HUMKIN Signal Studio inside an intentionally small native shell.
 * Local station founding belongs to the web studio's separate storage; it does
 * not modify the native Orchard, Top 42, Media3 queue or server-owned HUM.
 *
 * Native listening pauses at entry so two audio players never play over each other.
 * A listener must explicitly press Play in the studio. Nothing auto-broadcasts.
 */
public final class SignalStudioActivity extends Activity {
    static final String EXTRA_SEED_TRACK = "selected_published_track";
    private WebView web;

    private int dp(float size){return HumkinVisuals.dp(this,size);}
    private Button toolButton(String label) {
        Button button=new Button(this);
        button.setAllCaps(false);
        button.setText(label);
        button.setTextColor(HumkinVisuals.INK);
        button.setTextSize(12);
        return button;
    }

    @Override public void onCreate(Bundle bundle) {
        super.onCreate(bundle);
        getWindow().setStatusBarColor(HumkinVisuals.INK);
        getWindow().setNavigationBarColor(HumkinVisuals.CREAM);
        LinearLayout page=new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setBackgroundColor(HumkinVisuals.CREAM);
        LinearLayout bar=new LinearLayout(this);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(dp(8),dp(5),dp(8),dp(5));
        bar.setBackgroundColor(HumkinVisuals.CREAM);

        Button back=toolButton("← RADIO");
        back.setOnClickListener(v->finish());
        bar.addView(back,new LinearLayout.LayoutParams(dp(106),dp(49)));
        TextView name=new TextView(this);
        name.setText("✳  MY LITTLE STATION");
        name.setTextSize(14);
        name.setTypeface(null,1);
        name.setTextColor(HumkinVisuals.INK);
        name.setGravity(Gravity.CENTER);
        bar.addView(name,new LinearLayout.LayoutParams(0,dp(49),1f));
        Button browser=toolButton("↗");
        browser.setContentDescription("Open station studio in browser for downloads and backup");
        browser.setOnClickListener(v->openOutside(web==null?StationSeedUrl.STUDIO:web.getUrl()));
        bar.addView(browser,new LinearLayout.LayoutParams(dp(51),dp(49)));
        page.addView(bar,new LinearLayout.LayoutParams(-1,-2));

        web=new WebView(this);
        web.setBackgroundColor(HumkinVisuals.CREAM);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setJavaScriptCanOpenWindowsAutomatically(false);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.getSettings().setMediaPlaybackRequiresUserGesture(true);
        web.getSettings().setSafeBrowsingEnabled(true);
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri link=request.getUrl();
                if(isStudioUrl(link))return false;
                openOutside(link==null?null:link.toString());
                return true;
            }
        });
        page.addView(web,new LinearLayout.LayoutParams(-1,0,1f));
        setContentView(page);

        web.loadUrl(StationSeedUrl.forTrack(getIntent().getStringExtra(EXTRA_SEED_TRACK)));
    }

    private boolean isStudioUrl(Uri link) {
        return link!=null
                && "https".equalsIgnoreCase(link.getScheme())
                && "humkin.abundent.org".equalsIgnoreCase(link.getHost())
                && link.getPath()!=null
                && link.getPath().startsWith("/fm/signal/");
    }

    private void openOutside(String requested) {
        if(requested==null)return;
        try{
            Uri link=Uri.parse(requested);
            if(!"https".equalsIgnoreCase(link.getScheme()))return;
            startActivity(new Intent(Intent.ACTION_VIEW,link));
        }catch(Exception ignored){}
    }
    @Override public void onBackPressed() {
        if(web!=null&&web.canGoBack()){web.goBack();return;}
        super.onBackPressed();
    }
    @Override protected void onDestroy() {
        if(web!=null){web.stopLoading();web.loadUrl("about:blank");web.destroy();web=null;}
        super.onDestroy();
    }
}
