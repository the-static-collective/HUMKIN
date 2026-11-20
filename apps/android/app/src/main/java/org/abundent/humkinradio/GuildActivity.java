package org.abundent.humkinradio;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * Auth-less, real-world station submissions in one contained phone-native
 * WebView. The caller chooses video/audio through Android's trusted picker.
 * This class cannot award HUM or activate on-air content: server owner review
 * remains the only reward/approval path. The actual Media3 receiver is intact.
 */
public final class GuildActivity extends Activity {
    private static final String DESK="https://humkin.abundent.org/fm/participate/";
    private static final int CHOOSE_MEDIA=2091;
    private WebView web;
    private ValueCallback<Uri[]> pendingFile;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        LinearLayout layout=new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setBackgroundColor(HumkinVisuals.CREAM);

        LinearLayout toolbar=new LinearLayout(this);
        toolbar.setPadding(12,9,12,9);
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setBackgroundColor(HumkinVisuals.INK);
        Button back=new Button(this);
        back.setAllCaps(false);
        back.setText("← RADIO");
        back.setOnClickListener(v->finish());
        toolbar.addView(back,new LinearLayout.LayoutParams(118,-2));
        TextView title=new TextView(this);
        title.setText("✳ STATION GUILDS");
        title.setTextColor(Color.WHITE);
        title.setTypeface(null,1);
        title.setTextSize(15);
        title.setGravity(Gravity.CENTER_VERTICAL|Gravity.END);
        toolbar.addView(title,new LinearLayout.LayoutParams(0,-2,1f));
        layout.addView(toolbar,new LinearLayout.LayoutParams(-1,-2));

        web=new WebView(this);
        web.setBackgroundColor(HumkinVisuals.CREAM);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setJavaScriptCanOpenWindowsAutomatically(false);
        web.getSettings().setAllowFileAccess(false);
        // Only the OS file-picker callback can give the page content:// URIs.
        web.getSettings().setAllowContentAccess(true);
        web.getSettings().setSafeBrowsingEnabled(true);
        web.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onShowFileChooser(WebView view,
                    ValueCallback<Uri[]> filePathCallback,FileChooserParams params) {
                if(pendingFile!=null)pendingFile.onReceiveValue(null);
                pendingFile=filePathCallback;
                try{
                    Intent request=params.createIntent();
                    request.addCategory(Intent.CATEGORY_OPENABLE);
                    startActivityForResult(request,CHOOSE_MEDIA);
                    return true;
                }catch(ActivityNotFoundException exception){
                    pendingFile.onReceiveValue(null);
                    pendingFile=null;
                    return false;
                }
            }
        });
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request) {
                Uri link=request.getUrl();
                if("https".equalsIgnoreCase(link.getScheme()) &&
                        "humkin.abundent.org".equalsIgnoreCase(link.getHost()) &&
                        link.getPath()!=null &&
                        link.getPath().startsWith("/fm/participate/"))
                    return false;
                try{startActivity(new Intent(Intent.ACTION_VIEW,link));}
                catch(Exception ignored){}
                return true;
            }
        });
        layout.addView(web,new LinearLayout.LayoutParams(-1,0,1f));
        setContentView(layout);
        web.loadUrl(DESK);
    }
    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){
        super.onActivityResult(requestCode,resultCode,data);
        if(requestCode!=CHOOSE_MEDIA||pendingFile==null)return;
        Uri[] chosen=WebChromeClient.FileChooserParams.parseResult(resultCode,data);
        pendingFile.onReceiveValue(chosen);
        pendingFile=null;
    }
    @Override public void onBackPressed() {
        if(web!=null&&web.canGoBack()){web.goBack();return;}
        super.onBackPressed();
    }
    @Override protected void onDestroy(){
        if(pendingFile!=null){pendingFile.onReceiveValue(null);pendingFile=null;}
        if(web!=null){web.stopLoading();web.destroy();web=null;}
        super.onDestroy();
    }
}
