package org.abundent.humkinradio;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.ValueCallback;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;
import org.json.JSONTokener;

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
    private static final int OPEN_BACKUP=1901,WRITE_BACKUP=1902;
    private WebView web;
    private ValueCallback<Uri[]> pendingFile;
    private String pendingBackup;

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
        Button options=toolButton("⋯");
        options.setContentDescription("Station tools: save your station backup or open in browser");
        options.setOnClickListener(v->new AlertDialog.Builder(this)
                .setTitle("MY STATION TOOLS")
                .setItems(new String[]{"SAVE STATION BACKUP", "OPEN STUDIO IN BROWSER"},
                        (dialog,choice)->{
                            if(choice==0)saveBackup();
                            else {
                                Toast.makeText(this,"Browser storage is separate from this app. Back up here first.",Toast.LENGTH_LONG).show();
                                openOutside(web==null?StationSeedUrl.STUDIO:web.getUrl());
                            }
                        })
                .setNegativeButton("Close",null).show());
        bar.addView(options,new LinearLayout.LayoutParams(dp(51),dp(49)));
        page.addView(bar,new LinearLayout.LayoutParams(-1,-2));

        web=new WebView(this);
        web.setBackgroundColor(HumkinVisuals.CREAM);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setJavaScriptCanOpenWindowsAutomatically(false);
        web.getSettings().setAllowFileAccess(false);
        // OS document selection is the only way a page receives a local URI.
        web.getSettings().setAllowContentAccess(true);
        web.getSettings().setMediaPlaybackRequiresUserGesture(true);
        web.getSettings().setSafeBrowsingEnabled(true);
        web.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onShowFileChooser(WebView view,
                    ValueCallback<Uri[]> callback, FileChooserParams params) {
                if(pendingFile!=null)pendingFile.onReceiveValue(null);
                pendingFile=callback;
                Intent select=new Intent(Intent.ACTION_OPEN_DOCUMENT);
                select.addCategory(Intent.CATEGORY_OPENABLE);
                select.setType("application/json");
                select.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try{
                    startActivityForResult(select,OPEN_BACKUP);
                    return true;
                }catch(ActivityNotFoundException e){
                    pendingFile.onReceiveValue(null);pendingFile=null;
                    return false;
                }
            }
        });
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
    /**
     * Native backup is necessary because Android WebView does not reliably
     * download browser-generated blob URLs. Read only the canonical station's
     * two local records, via an origin-checked, one-shot JavaScript evaluation.
     * Never expose a general JS->Android bridge or hidden external upload.
     */
    private void saveBackup() {
        if(web==null||!isStudioUrl(Uri.parse(web.getUrl()==null?"":web.getUrl()))){
            Toast.makeText(this,"Open the station studio before saving.",Toast.LENGTH_SHORT).show();
            return;
        }
        String js="(function(){try{const a=localStorage.getItem('humkin-station-seed-v1');"
                +"const b=localStorage.getItem('humkin-signal-draft-v1');"
                +"if(!a||!b)return '';return JSON.stringify({schema:'humkin.station.backup/v1',"
                +"station:JSON.parse(a),current:JSON.parse(b)})}catch(e){return ''}})()";
        web.evaluateJavascript(js,encoded->{
            try{
                Object raw=new JSONTokener(encoded).nextValue();
                if(!(raw instanceof String))throw new Exception("empty");
                String json=(String)raw;
                if(json.length()>30000)throw new Exception("too large");
                JSONObject doc=new JSONObject(json);
                if(!"humkin.station.backup/v1".equals(doc.optString("schema"))
                        ||doc.optJSONObject("station")==null
                        ||doc.optJSONObject("current")==null)
                    throw new Exception("missing station");
                pendingBackup=doc.toString(2);
                Intent output=new Intent(Intent.ACTION_CREATE_DOCUMENT);
                output.addCategory(Intent.CATEGORY_OPENABLE);
                output.setType("application/json");
                output.putExtra(Intent.EXTRA_TITLE,"humkin-station-seed-backup.json");
                startActivityForResult(output,WRITE_BACKUP);
            }catch(Exception ignored){
                Toast.makeText(this,"Start your station before backing up its seed.",Toast.LENGTH_LONG).show();
            }
        });
    }
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);
        if(request==OPEN_BACKUP){
            if(pendingFile!=null){
                Uri uri=result==RESULT_OK&&data!=null?data.getData():null;
                pendingFile.onReceiveValue(uri==null?null:new Uri[]{uri});
                pendingFile=null;
            }
            return;
        }
        if(request==WRITE_BACKUP){
            if(result==RESULT_OK&&data!=null&&data.getData()!=null&&pendingBackup!=null){
                try(OutputStream stream=getContentResolver().openOutputStream(data.getData())){
                    if(stream==null)throw new Exception("No output stream");
                    stream.write(pendingBackup.getBytes(StandardCharsets.UTF_8));
                    Toast.makeText(this,"Station seed backed up.",Toast.LENGTH_LONG).show();
                }catch(Exception error){
                    Toast.makeText(this,"Could not save station backup.",Toast.LENGTH_LONG).show();
                }
            }
            pendingBackup=null;
        }
    }
    @Override public void onBackPressed() {
        if(web!=null&&web.canGoBack()){web.goBack();return;}
        super.onBackPressed();
    }
    @Override protected void onDestroy() {
        if(pendingFile!=null){pendingFile.onReceiveValue(null);pendingFile=null;}
        if(web!=null){web.stopLoading();web.loadUrl("about:blank");web.destroy();web=null;}
        super.onDestroy();
    }
}
