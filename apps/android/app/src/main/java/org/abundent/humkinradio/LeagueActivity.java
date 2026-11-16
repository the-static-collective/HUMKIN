package org.abundent.humkinradio;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * A secondary, playable record-league page. The primary HUMKIN receiver
 * remains fully native Media3 and continues to own radio/background playback.
 * Only the canonical league webpage runs inside this contained WebView.
 */
public final class LeagueActivity extends Activity {
    private static final String LEAGUE = "https://humkin.abundent.org/fm/top42/";
    private WebView web;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        LinearLayout layout=new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setBackgroundColor(HumkinVisuals.CREAM);

        LinearLayout bar=new LinearLayout(this);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(14,10,14,10);
        bar.setBackgroundColor(HumkinVisuals.INK);
        Button back=new Button(this);
        back.setAllCaps(false);
        back.setText("← RADIO");
        back.setOnClickListener(v->finish());
        bar.addView(back,new LinearLayout.LayoutParams(120,-2));
        TextView name=new TextView(this);
        name.setText("✳ THE TOP 42");
        name.setTextColor(Color.WHITE);
        name.setTextSize(18);
        name.setTypeface(null,1);
        name.setGravity(Gravity.CENTER_VERTICAL);
        bar.addView(name,new LinearLayout.LayoutParams(0,-2,1f));
        layout.addView(bar,new LinearLayout.LayoutParams(-1,-2));

        web=new WebView(this);
        web.setBackgroundColor(HumkinVisuals.CREAM);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.getSettings().setJavaScriptCanOpenWindowsAutomatically(false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri uri=req.getUrl();
                if ("https".equalsIgnoreCase(uri.getScheme()) &&
                        "humkin.abundent.org".equalsIgnoreCase(uri.getHost()) &&
                        uri.getPath()!=null && uri.getPath().startsWith("/fm/top42/"))
                    return false;
                try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}
                catch (Exception ignored) {}
                return true;
            }
        });
        layout.addView(web,new LinearLayout.LayoutParams(-1,0,1f));
        setContentView(layout);
        // An upgraded Tape Archive may hand over a six-song EP proposal.
        // The web builder validates titles/slots and still requires a human
        // press of Release: nobody gets synthetic record or chart plays.
        String seed=getIntent().getStringExtra("seed_tracks");
        if(seed!=null&&seed.matches("[-a-z0-9]{3,90}(,[-a-z0-9]{3,90}){5}"))
            web.loadUrl(LEAGUE+"?draft="+Uri.encode(seed,","));
        else web.loadUrl(LEAGUE);
    }

    @Override public void onBackPressed() {
        if(web!=null&&web.canGoBack()){web.goBack();return;}
        super.onBackPressed();
    }
    @Override protected void onDestroy() {
        if(web!=null){
            web.stopLoading();
            web.destroy();
            web=null;
        }
        super.onDestroy();
    }
}
