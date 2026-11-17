import {createClient} from "https://esm.sh/@supabase/supabase-js@2.57.0";
import {prepareCover} from "./art-upload.js";
import {r2Bridge} from "../r2-bridge-client.js";

// Publishable key only. Every write is checked again by owner-only Postgres RLS.
const API="https://kbhqacsdvjsstzyplqij.supabase.co";
const KEY="sb_publishable_Bv9JuOctSQTmnE3O1dP8RA_MKRNSD-o";
const OWNER="us@abundent.org",LIVE="humkin-radio-live",INBOX="humkin-radio-inbox",ART="humkin-radio-art";
const db=createClient(API,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=id=>document.getElementById(id);
const days=["SUN","MON","TUE","WED","THU","FRI","SAT"];
let user=null,library=[],shows=[],staticList=[],editing=null,editingShow=null,slots=[],busy=false;
let artAssets=[];
let r2Status=null;
let stationSettings={bumper_every:0,station_label:"HUMKIN RADIO"};
let bumperPolicy={};
const selected=new Set();
function el(tag,value,className){
 const node=document.createElement(tag);
 if(value!==undefined&&value!==null)node.textContent=String(value);
 if(className)node.className=className;
 return node;
}
function button(label,action,cls="secondary"){
 const node=el("button",label,cls);node.type="button";node.addEventListener("click",action);return node;
}
function note(s){$("manager-msg").textContent=s}
function duration(s){
 s=Math.round(Number(s)||0);return Math.floor(s/3600)+":"+
  String(Math.floor(s%3600/60)).padStart(2,"0")+":"+
  String(s%60).padStart(2,"0");
}
function formatMinute(m){
 m=Number(m)||0;return String(Math.floor(m/60)).padStart(2,"0")+":"+
    String(m%60).padStart(2,"0");
}
function timeMinute(t){
 if(!/^\d\d:\d\d$/.test(t))return NaN;
 const [h,m]=t.split(":").map(Number);
 return h<24&&m<60?h*60+m:NaN;
}
function trackAvailable(t){return t.enabled&&t.published}
function publicSrc(path){
 if(!/^[0-9a-f-]{36}\/[0-9a-f]{64}\.mp3$/.test(path))return "";
 return API+"/storage/v1/object/public/"+LIVE+"/"+path;
}
async function requireOwner(){
 const {data,error}=await db.auth.getSession();
 const account=data?.session?.user;
 if(error||account?.email?.toLowerCase()!==OWNER)
   throw Error("Not signed in as the HUMKIN owner. Use the crate loader sign-in first.");
 user=account;return account;
}
function setBusy(v){
 busy=v;
 for(const id of ["save-show","edit-save","edit-delete","refresh","new-show","bulk-on","bulk-off","auto-save","art-upload","r2-migrate","r2-cleanup"])
   $(id).disabled=v;
}
async function checkOne(result,action){
 if(result.error)throw result.error;
 if(!result.data)throw Error(action+" returned no authorized record");
 return result.data;
}
async function loadDesk(){
 if(busy)return;
 $("auth-status").textContent="Checking your session…";
 try{await requireOwner()}catch(err){
   $("auth-status").textContent=err.message;
   $("login-link").classList.remove("hidden");
   $("logout").classList.add("hidden");
   $("catalog").replaceChildren(el("p","Sign in to manage the library."));
   $("show-list").replaceChildren(el("p","Sign in to manage programming."));
   return;
 }
 $("login-link").classList.add("hidden");
 $("logout").classList.remove("hidden");
 $("auth-status").textContent="UNLOCKED · "+user.email+" · owner-only control";
 try{
  const [configResponse,cloudResult,staticResult,showsResult,settingsResult,artResult,fieldCarts,r2Manifest]=await Promise.all([
   fetch("../rotation.json",{cache:"no-store"}),
   db.from("humkin_radio_tracks")
    .select("id,uploaded_by,storage_path,original_name,title,artist,album,duration_seconds,bytes,enabled,kind,is_single,art_asset_id,published_at,created_at,storage_provider,r2_object_key,supabase_source_removed_at")
    .order("created_at",{ascending:false}).limit(2000),
   db.from("humkin_radio_static_overrides").select("track_id,title,artist,album,enabled,kind,art_asset_id").limit(1000),
   db.from("humkin_radio_programs").select("id,name,days,start_minute,end_minute,track_ids,is_active,priority,owner_id,updated_at,art_asset_id")
    .order("start_minute",{ascending:true}).limit(500),
   db.from("humkin_radio_settings").select("id,owner_id,bumper_every,station_label").eq("id","main").limit(1),
   db.from("humkin_radio_art_assets").select("id,owner_id,sha256,storage_path,label,width,height,bytes,created_at")
    .order("created_at",{ascending:false}).limit(500),
   fetch("../air-carts.json",{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null),
   fetch("../r2-tracks.json",{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null)
  ]);
  if(!configResponse.ok)throw Error("Original rotation not reachable");
  for(const [name,result] of [["cloud catalog",cloudResult],["static overrides",staticResult],["shows",showsResult],["station settings",settingsResult],["art shelf",artResult]])
    if(result.error)throw Error(name+": "+result.error.message);
  const config=await configResponse.json();
  if(!Array.isArray(config.tracks))throw Error("Original rotation is incomplete");
  bumperPolicy=config.bumper_brain||{};
  artAssets=[...window.HUMKIN_ART.libraryMap(artResult.data||[]).values()];
  const overrides=new Map((staticResult.data||[]).map(t=>[t.track_id,t]));
  const approved=fieldCarts?.schema_version==="humkin.radio.air-carts/v1"&&
    Array.isArray(fieldCarts.carts)?fieldCarts.carts.filter(c=>
      /^field-fm-[0-9]{3}$/.test(c.id||"")&&/^[0-9a-f]{64}$/.test(c.sha256||"")&&
      typeof c.src==="string"&&
      c.src.startsWith("./studio/recordings/")&& /^[a-z0-9-]+[.]mp3$/.test(c.src.slice("./studio/recordings/".length))&&
      Number(c.duration_seconds)>1&&Number(c.duration_seconds)<=120)
      .map(c=>({id:"air-"+c.id,title:c.title,artist:"HUMKIN",
        album:"HUMKIN RADIO · FIELD CARTS",kind:"bumper",
        duration:c.duration_seconds,src:c.src})): [];
  staticList=[...config.tracks,...approved].map(track=>{
   const override=overrides.get(track.id);
   return {id:track.id,source:"static",title:override?.title||track.title,
     artist:override?.artist||track.artist||"HUMKIN",
     album:override?.album||track.album||"HUMKIN RADIO",
     kind:override?override.kind==="bumper"?"bumper":"song":track.kind==="bumper"?"bumper":"song",
     enabled:override?.enabled!==false,published:true,art_asset_id:override?.art_asset_id||null,
     artwork:new URL(track.artwork||"../cover.jpg","https://humkin.abundent.org/fm/").href,
     duration:Number(track.duration),url:new URL(track.src,"https://humkin.abundent.org/fm/").href,
     originalName:String(track.src),bytes:null};
  });
  const cloud=(cloudResult.data||[]).map(track=>{
   const provider=track.storage_provider==="r2"?"r2":"supabase";
   const r2Url=provider==="r2"?window.HUMKIN_R2_CATALOG?.objectUrl(track.r2_object_key):"";
   return {
    id:"crate-"+track.id,dbId:track.id,source:"cloud",title:track.title,
    artist:track.artist,album:track.album,kind:track.kind,is_single:track.is_single===true,
    enabled:track.enabled,published:!!track.published_at,art_asset_id:track.art_asset_id||null,
    artwork:new URL("../../cover.jpg",location.href).href,
    duration:Number(track.duration_seconds),bytes:track.bytes,
    originalName:track.original_name,
    url:track.published_at?(provider==="r2"?r2Url:publicSrc(track.storage_path)):"",
    storage_provider:provider,r2ObjectKey:track.r2_object_key||null,
    sourceRemoved:!!track.supabase_source_removed_at,
    storagePath:track.storage_path,publishedAt:track.published_at
   };
  });
  // Read-only catalog entries explicitly approved in the GitHub R2 manifest.
  // Do not expose a public-bucket listing or infer consent from arbitrary uploads.
  const r2Static=(window.HUMKIN_R2_CATALOG?.parse(r2Manifest,
      new URL("../../cover.jpg",location.href).href)||[]).map(t=>({
    ...t,source:"r2",storage_provider:"r2",url:t.src,
    originalName:t.src,enabled:true,published:true,bytes:null,
    art_asset_id:null,readonly:true
  }));
  library=[...cloud,...staticList,...r2Static];
  shows=showsResult.data||[];
  stationSettings={
    bumper_every:Number(settingsResult.data?.[0]?.bumper_every)||0,
    station_label:settingsResult.data?.[0]?.station_label||"HUMKIN RADIO"
  };
  for(const id of [...selected])if(!library.find(t=>t.id===id))selected.delete(id);
  renderArtShelf();renderLibrary();renderShows();renderSlots();renderNow();renderAutoDj();note("");
  await refreshR2VaultStatus();
 }catch(err){note("Could not read station: "+err.message);$("auth-status").textContent="Signed in · data unavailable"}
}

function artMap(){return new Map(artAssets.map(asset=>[asset.id,asset]))}
function coverUrl(artId,fallback="../../cover.jpg"){
 const asset=artAssets.find(a=>a.id===artId);
 return asset?.url||fallback;
}
function renderArtSelect(id,chosen=null){
 const field=$(id);field.replaceChildren();
 const first=el("option",id==="show-art"?"No program cover — use the song art":"No custom cover — use existing art");
 first.value="";field.append(first);
 for(const asset of artAssets){
   const option=el("option",asset.label+" · "+asset.id.slice(0,8));
   option.value=asset.id;field.append(option);
 }
 field.value=chosen&&artAssets.some(a=>a.id===chosen)?chosen:"";
}
function updateArtPreview(kind){
 const isProgram=kind==="show";
 const input=$(isProgram?"show-art":"edit-art");
 const preview=$(isProgram?"show-art-preview":"edit-art-preview");
 const track=library.find(t=>t.id===editing);
 const fallback=isProgram?"../../cover.jpg":track?.artwork||"../../cover.jpg";
 preview.src=coverUrl(input.value,fallback);
 preview.alt=(isProgram?"Program":"Track")+" cover preview";
}
function selectArtwork(id){
 if($("edit-dialog").open){
   renderArtSelect("edit-art",id);updateArtPreview("edit");
   $("art-status").textContent="Selected for the open track. Press SAVE CHANGES to assign it.";
 }else if(!$("show-form").classList.contains("hidden")){
   renderArtSelect("show-art",id);updateArtPreview("show");
   $("art-status").textContent="Selected for this program. Press SAVE PROGRAM to assign it.";
 }else{
   $("art-status").textContent="Artwork ready. Open a track's EDIT screen or a show's editor to assign it.";
 }
}
function renderArtShelf(){
 const shelf=$("art-library");shelf.replaceChildren();
 const bytes=artAssets.reduce((s,a)=>s+(Number(a.bytes)||0),0);
 $("art-count").textContent=artAssets.length+" reusable covers · "+(bytes/1024/1024).toFixed(1)+" MiB";
 if(!artAssets.length){
   shelf.append(el("p","No covers added yet. Upload your first image above."));
 }
 for(const asset of artAssets){
   const tile=button("",()=>{},"art-tile"); // Keyboard-accessible gallery tile.
   // Remove the default click action; this tile chooses art for an open editor.
   const picture=el("img");picture.src=asset.url;picture.alt=asset.label+" cover";
   picture.loading="lazy";
   tile.replaceChildren(picture,el("span",asset.label));
   tile.addEventListener("click",()=>selectArtwork(asset.id));
   tile.title="Use "+asset.label+" in the open editor";
   shelf.append(tile);
 }
}
async function sha256(file){
 const data=await file.arrayBuffer(),hash=await crypto.subtle.digest("SHA-256",data);
 return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function uploadArtwork(original){
 if(busy)return;
 setBusy(true);
 const status=$("art-status");
 status.textContent="Preparing cover locally; original image will not be uploaded…";
 try{
   await requireOwner();
   const prepared=await prepareCover(original);
   const fingerprint=await sha256(prepared.file);
   const existing=artAssets.find(x=>x.sha256===fingerprint);
   if(existing){
     setBusy(false);selectArtwork(existing.id);
     status.textContent="This exact cover is already in the shelf — reused without another upload.";
     return;
   }
   const storagePath=user.id+"/"+fingerprint+".jpg";
   status.textContent="Uploading square JPEG ("+(prepared.file.size/1024).toFixed(0)+" KB)…";
   const uploaded=await db.storage.from(ART).upload(storagePath,prepared.file,{
     contentType:"image/jpeg",cacheControl:"3600",upsert:false
   });
   if(uploaded.error){
     // An interrupted prior save can leave the immutable content-addressed JPEG
     // in Storage. Only allow metadata retry when its exact hash/path already exists.
     if(!/(duplicate|already exists|409)/i.test(uploaded.error.message||""))throw uploaded.error;
   }
   const label=(original.name||"HUMKIN cover").replace(/\.(jpeg|jpg|png|webp)$/i,"")
      .replace(/[_-]+/g," ").trim().slice(0,120)||"HUMKIN cover";
   const row={owner_id:user.id,sha256:fingerprint,storage_path:storagePath,
     label,width:prepared.width,height:prepared.height,bytes:prepared.file.size};
   const {data,error}=await db.from("humkin_radio_art_assets")
      .insert(row).select("id,sha256,storage_path,label,width,height,bytes").single();
   if(error){
     if(error.code==="23505"){
       const prior=await db.from("humkin_radio_art_assets")
         .select("id").eq("sha256",fingerprint).maybeSingle();
       if(prior.error||!prior.data)throw error;
       setBusy(false);await loadDesk();selectArtwork(prior.data.id);
       status.textContent="Existing artwork recovered and selected.";
       return;
     }
     throw Error("JPEG uploaded, but catalog registration failed: "+error.message+
       ". Retry the same image; the content-addressed file is reusable.");
   }
   setBusy(false);await loadDesk();selectArtwork(data.id);
   status.textContent="Added "+label+". Choose a track or show and save to publish its cover.";
 }catch(err){
   setBusy(false);status.textContent="Cover upload failed: "+err.message;
 }
}

function renderNow(){
 const usable=library.filter(trackAvailable);
 const songs=usable.filter(t=>t.kind!=="bumper");
 const bumpers=usable.filter(t=>t.kind==="bumper");
 const count=library.filter(t=>t.source==="cloud"&&t.published).length;
 const disabled=library.filter(t=>!t.enabled).length;
 $("stats").textContent=songs.length+" music tracks · "+bumpers.length+" ready bumpers · "+disabled+" hidden · "+count+" cloud releases. "+duration(songs.reduce((a,t)=>a+t.duration,0))+" of music.";
 const program=window.HUMKIN_SCHEDULE?.currentProgram(shows,Date.now());
 const playable=program?.track_ids.some(id=>usable.some(t=>t.id===id));
 const day=window.HUMKIN_SCHEDULE?.localParts(Date.now());
 $("now").textContent=playable?"NOW SCHEDULED · "+program.name+" · "+
    formatMinute(program.start_minute)+"–"+formatMinute(program.end_minute):
    "NOW SCHEDULED · ALL-SONGS ROTATION";
 $("now").title=day?"Station-local time "+formatMinute(day.minuteOfDay)+" "+day.timezone:"";
}
function renderLibrary(){
 const text=$("track-search").value.trim().toLowerCase(),filter=$("filter").value;
 const matching=library.filter(t=>{
   if(filter==="songs"&&t.kind!=="song"||filter==="bumpers"&&t.kind!=="bumper"||
     filter==="hidden"&&t.enabled||filter==="cloud"&&t.source!=="cloud"||
     filter==="static"&&t.source!=="static")return false;
   const hay=[t.id,t.title,t.artist,t.album,t.originalName].join(" ").toLowerCase();
   return !text||hay.includes(text);
 });
 const list=$("catalog");list.replaceChildren();
 if(!matching.length)list.append(el("p","No recordings match. Clear the filter."));
 for(const track of matching){
   const item=el("div",null,"track"+(!track.enabled?" disabled":""));
   const check=el("input");check.type="checkbox";check.checked=selected.has(track.id);
   check.setAttribute("aria-label","Select "+track.title+" "+track.id);
   check.addEventListener("change",()=>{
     if(check.checked)selected.add(track.id);else selected.delete(track.id);
     $("selected-count").textContent=selected.size+" selected";
   });
   const content=el("div");
   const thumbnail=el("img",null,"track-thumb");
   thumbnail.src=coverUrl(track.art_asset_id,track.artwork);
   thumbnail.alt=track.title+" cover";
   thumbnail.loading="lazy";content.append(thumbnail);
   content.append(el("div",track.title,"track-title"));
   const status=el("div",null,"row");
   for(const label of [track.artist,track.kind==="bumper"?"BUMPER":track.is_single?"SINGLE ✳":"SONG",
       !track.enabled?"OFF AIR":!track.published?"PRIVATE DRAFT":"ON AIR",
       track.source==="cloud"?"CLOUD":"ORIGINAL"]){
      status.append(el("span",label,"pill"));
   }
   content.append(status);
   // These are storage/ingestion labels, not programming categories.
   // Preserve the underlying value for editing and source audit only.
   const displayCollection=track.kind==="bumper"?"HUMKIN RADIO · STATION BUMPERS":track.album;
   content.append(el("div",displayCollection+" · "+duration(track.duration),"sub"));
   content.append(el("div",(track.originalName||track.id)+" · ID "+track.id.slice(-12),"track-info"));
   const actions=el("div",null,"track-actions");
   actions.append(button("EDIT",()=>openEdit(track),"primary"));
   actions.append(button("PREVIEW",()=>preview(track)));
   actions.append(button(track.enabled?"HIDE":"ENABLE",()=>toggleTrack(track),track.enabled?"secondary":"primary"));
   item.append(check,content,actions);list.append(item);
 }
 $("selected-count").textContent=selected.size+" selected";
}


function renderBumperPreview(){
 const list=$("bumper-preview");list.replaceChildren();
 const engine=window.HUMKIN_BUMPER_BRAIN;
 if(!engine){
  list.append(el("li","Bumper Brain is not available; refresh this page."));
  return;
 }
 const songs=library.map((t,i)=>trackAvailable(t)&&t.kind==="song"?i:-1).filter(i=>i>=0);
 const bumpers=library.map((t,i)=>trackAvailable(t)&&t.kind==="bumper"?i:-1).filter(i=>i>=0);
 const policy=bumperPolicy;
 const draft=engine.plan(songs,bumpers,stationSettings.bumper_every,library,policy);
 const held=draft.held.map(t=>t.title);
 $("bumper-held").textContent=draft.eligible+" routine-ready · "+
   draft.held.length+" on program hold (not in routine rotation). "+
   (held.length?"Held: "+held.slice(0,8).join(" · ")+(held.length>8?" …":""):"");
 if(!draft.breaks.length){
  list.append(el("li","No routine breaks at this cadence or with this inventory."));
  return;
 }
 for(const step of draft.breaks.slice(0,10)){
   list.append(el("li","After song "+step.afterSong+" · "+
     step.title+" · "+step.lane.toUpperCase()+" · "+
     Math.round(step.seconds)+" seconds · ~"+step.estimatedMinute+"m"));
 }
}

function renderAutoDj(){
 const value=String(stationSettings.bumper_every);
 const option=[...$("bumper-frequency").options].some(opt=>opt.value===value);
 $("bumper-frequency").value=option?value:"0";
 $("station-label").value=stationSettings.station_label;
 const active=library.filter(t=>t.kind==="bumper"&&trackAvailable(t));
 const cadence=stationSettings.bumper_every;
 $("auto-status").textContent=active.length+" published recorded bumper(s) enabled. "+
   (cadence&&active.length?"φ-short drops; a feature break ~11–12 minutes, alternating medium and long (~22 minutes for long) at standard density (4).":
   cadence?"Cadence set, but nothing will play until you enable a bumper in the library.":
   "Automatic station IDs are currently OFF. The station plays music as before.");
 renderBumperPreview();
}
async function saveAutoDj(){
 if(busy)return;
 const frequency=Number($("bumper-frequency").value);
 const label=$("station-label").value.trim();
 if(!Number.isInteger(frequency)||frequency<0||frequency>20||!label||label.length>90){
   note("Choose a valid frequency and station name.");return;
 }
 setBusy(true);
 try{
   await requireOwner();
   const row={id:"main",owner_id:user.id,bumper_every:frequency,
      station_label:label,updated_at:new Date().toISOString()};
   const response=await db.from("humkin_radio_settings")
      .upsert(row,{onConflict:"id"}).select("id").single();
   await checkOne(response,"AutoDJ settings");
   setBusy(false);await loadDesk();
   note("Saved AutoDJ: "+(frequency?"station IDs every "+frequency+" songs":"OFF")+
     ". Listeners refresh to receive the change.");
 }catch(err){setBusy(false);note("Could not save AutoDJ: "+err.message)}
}

function preview(track){
 const player=$("preview");
 if(!track.url){note("That private draft is not published. Use the loader to put it on air.");return}
 player.src=track.url;$("preview-label").textContent=track.title+" · "+track.artist+
   " · "+(track.originalName||track.id);
 player.play().catch(()=>note("Tap play on the preview player to begin."));
}
function openEdit(track){
 editing=track.id;
 $("edit-title").value=track.title;
 $("edit-artist").value=track.artist;
 $("edit-album").value=track.album;
 $("edit-kind").value=track.kind==="bumper"?"bumper":"song";
 $("edit-single").checked=track.source==="cloud"&&track.is_single===true;
 $("edit-single").disabled=track.source!=="cloud"||track.kind==="bumper";
 $("edit-single-row").hidden=track.source!=="cloud";
 $("edit-enabled").checked=track.enabled;
 renderArtSelect("edit-art",track.art_asset_id||null);
 updateArtPreview("edit");
 $("edit-source").textContent=(track.source==="cloud"?"CLOUD FILE":"ORIGINAL WEBSITE ASSET")+
  " · "+track.originalName+" · ID "+track.id;
 $("edit-delete").hidden=track.source!=="cloud";
 $("edit-warning").textContent=track.source==="static"
   ?"This legacy recording stays in GitHub Pages. HIDE removes it from the radio without deleting its file."
   :"Deleting cloud audio is permanent. HIDE is reversible and safer.";
 $("edit-dialog").showModal();
}
async function persistTrack(track,fields){
 await requireOwner();
 // Static legacy tracks use UPSERT. Always preserve the previous art reference
 // during a hide/enable/bulk toggle, even if the caller edits other fields.
 fields={art_asset_id:track.art_asset_id||null,...fields};
 if(track.source==="cloud"){
   await checkOne(await db.from("humkin_radio_tracks")
      .update({...fields,updated_at:new Date().toISOString()})
      .eq("id",track.dbId).eq("uploaded_by",user.id).select("id").single(),"Track update");
 }else{
   await checkOne(await db.from("humkin_radio_static_overrides")
      .upsert({track_id:track.id,owner_id:user.id,...fields,updated_at:new Date().toISOString()},
       {onConflict:"track_id"}).select("track_id").single(),"Legacy override");
 }
}
async function saveEdit(){
 const track=library.find(t=>t.id===editing);if(!track||busy)return;
 const fields={title:$("edit-title").value.trim(),artist:$("edit-artist").value.trim(),
   album:$("edit-album").value.trim(),kind:$("edit-kind").value,
   enabled:$("edit-enabled").checked,art_asset_id:$("edit-art").value||null};
 if(track.source==="cloud")fields.is_single=fields.kind==="song"&&$("edit-single").checked;
 if(!fields.title||!fields.artist||!fields.album){note("Title, artist, and album cannot be empty.");return}
 setBusy(true);
 try{await persistTrack(track,fields);$("edit-dialog").close();note("Saved "+fields.title);setBusy(false);await loadDesk()}
 catch(err){setBusy(false);note("Save failed: "+err.message)}
}
async function toggleTrack(track){
 if(busy)return;
 setBusy(true);
 try{await persistTrack(track,{title:track.title,artist:track.artist,album:track.album,
   kind:track.kind,enabled:!track.enabled});setBusy(false);await loadDesk();
  note((track.enabled?"Hidden ":"Enabled ")+track.title+". Listener refresh required.");
 }catch(err){setBusy(false);note("Update failed: "+err.message)}
}
async function bulk(enabled){
 if(busy||!selected.size)return;
 const items=library.filter(t=>selected.has(t.id));
 if(!confirm((enabled?"Enable ":"Hide ")+items.length+" selected recordings?"))return;
 setBusy(true);let done=0,errors=[];
 try{
   for(const t of items){
     try{await persistTrack(t,{title:t.title,artist:t.artist,album:t.album,kind:t.kind,enabled});done++}
     catch(err){errors.push(t.title+": "+err.message)}
   }
 }finally{setBusy(false);selected.clear();await loadDesk()}
 note(done+" updated. "+(errors.length?errors.length+" failed: "+errors.slice(0,3).join(" · "):"No errors."));
}
async function deleteTrack(){
 const t=library.find(x=>x.id===editing);
 if(!t||t.source!=="cloud"||busy)return;
 if(!confirm("Permanently DELETE the audio for "+t.title+"? This is NOT reversible. HIDE is safer."))return;
 if(prompt("Type DELETE to permanently erase the audio file and library record:")!=="DELETE")return;
 setBusy(true);
 try{
   await requireOwner();
   const bucket=t.published?LIVE:INBOX;
   const {error:storageError}=await db.storage.from(bucket).remove([t.storagePath]);
   if(storageError)throw Error("Audio was NOT removed: "+storageError.message);
   const {error:rowError,data}=await db.from("humkin_radio_tracks")
      .delete().eq("id",t.dbId).eq("uploaded_by",user.id).select("id").single();
   if(rowError||!data)throw Error("Audio removed but database record needs cleanup: "+(rowError?.message||"no record returned"));
   $("edit-dialog").close();editing=null;setBusy(false);
   await loadDesk();note("Permanently deleted "+t.title+". Programs containing its ID will skip it.");
 }catch(err){setBusy(false);note("Delete stopped: "+err.message)}
}
function chooseShows(){
 const chooser=$("slot-select");
 const previous=chooser.value;chooser.replaceChildren();
 const option=el("option","Choose a recording…");option.value="";chooser.append(option);
 const available=library.filter(trackAvailable).sort((a,b)=>a.title.localeCompare(b.title));
 for(const track of available){
   const option=el("option",track.title+" · "+track.artist+
     (track.kind==="bumper"?" [BUMPER]":"")+" · "+track.id.slice(-8));
   option.value=track.id;chooser.append(option);
 }
 chooser.value=available.some(t=>t.id===previous)?previous:"";
}
function renderSlots(){
 chooseShows();
 const list=$("slot-list");list.replaceChildren();
 if(!slots.length)list.append(el("li","No tracks added yet. Choose a recording and press + ADD."));
 for(let i=0;i<slots.length;i++){
   const id=slots[i],track=library.find(t=>t.id===id);
   const li=el("li"),title=el("span",(track?.title||"Missing track")+" · "+
      (track?.artist||id)+(track?.kind==="bumper"?" · BUMPER":""));
   if(!track||!trackAvailable(track))title.textContent+=" · NOT CURRENTLY ON AIR";
   li.append(title,el("span"," "));
   li.append(button("↑",()=>moveSlot(i,-1)),button("↓",()=>moveSlot(i,1)),
     button("×",()=>{slots.splice(i,1);renderSlots()},"danger"));list.append(li);
 }
 $("slot-duration").textContent="Loop: "+duration(slots.reduce((a,id)=>{
   const t=library.find(t=>t.id===id);
   return a+(t&&trackAvailable(t)?t.duration:0);
 },0))+" · "+slots.length+" positions (repeat allowed).";
}
function moveSlot(i,delta){
 const j=i+delta;if(j<0||j>=slots.length)return;
 [slots[i],slots[j]]=[slots[j],slots[i]];renderSlots();
}
function showEditor(show=null){
 editingShow=show?.id||null;slots=[...(show?.track_ids||[])];
 $("show-editor-title").textContent=show?"EDIT SHOW · "+show.name:"NEW TIME SLOT";
 $("show-name").value=show?.name||"";
 $("show-start").value=formatMinute(show?.start_minute??420);
 $("show-end").value=formatMinute(show?.end_minute??540);
 $("show-priority").value=show?.priority??0;
 $("show-active").checked=show?.is_active!==false;
 renderArtSelect("show-art",show?.art_asset_id||null);
 updateArtPreview("show");
 document.querySelectorAll('input[name="show-day"]').forEach(input=>{
   input.checked=(show?.days||[0,1,2,3,4,5,6]).includes(Number(input.value));
 });
 $("show-form").classList.remove("hidden");
 renderSlots();$("show-form").scrollIntoView({behavior:"smooth",block:"start"});
}
function renderShows(){
 const list=$("show-list");list.replaceChildren();
 if(!shows.length){list.append(el("p","No scheduled shows yet. Same-Time RADIO currently plays the all-songs rotation."));return}
 for(const program of shows){
  const card=el("div",null,"show"+(!program.is_active?" inactive":""));
  if(program.art_asset_id){
    const picture=el("img",null,"track-thumb");
    picture.src=coverUrl(program.art_asset_id);
    picture.alt=program.name+" program art";picture.loading="lazy";
    card.append(picture);
  }
  card.append(el("h3",program.name));
  const description=program.days.map(d=>days[d]||"?").join(" ")+" · "+
    formatMinute(program.start_minute)+"–"+formatMinute(program.end_minute)+" Central"+
    " · "+program.track_ids.length+" positions"+
    (program.is_active?" · ACTIVE":" · PAUSED");
  card.append(el("small",description));
  const row=el("div",null,"row");
  row.append(button("EDIT LINEUP",()=>showEditor(program),"primary"),
    button(program.is_active?"PAUSE SHOW":"ENABLE SHOW",()=>toggleShow(program)),
    button("DELETE SHOW",()=>deleteShow(program),"danger"));
  card.append(row);list.append(card);
 }
}
async function saveShow(){
 if(busy)return;
 const name=$("show-name").value.trim();
 const start=timeMinute($("show-start").value),end=timeMinute($("show-end").value);
 const priority=Number($("show-priority").value);
 const chosen=[...document.querySelectorAll('input[name="show-day"]:checked')].map(e=>Number(e.value));
 if(!name||name.length>100||!chosen.length||!Number.isInteger(start)||!Number.isInteger(end)||
    start>=end||end>1439||!Number.isInteger(priority)||priority<0||priority>100||
    slots.length===0||slots.length>200){
   note("Give the show a name, at least one day, valid times (start before end), priority 0–100, and at least one recording. Use separate slots for overnight shows.");
   return;
 }
 const missing=slots.filter(id=>!library.some(t=>t.id===id&&trackAvailable(t)));
 if(missing.length){note("Remove hidden, unpublished or missing recordings from the show before saving.");return}
 const fields={name,days:chosen,start_minute:start,end_minute:end,priority,
   is_active:$("show-active").checked,track_ids:[...slots],
   art_asset_id:$("show-art").value||null,updated_at:new Date().toISOString()};
 setBusy(true);
 try{
   await requireOwner();
   const result=editingShow
      ?await db.from("humkin_radio_programs").update(fields).eq("id",editingShow).eq("owner_id",user.id).select("id").single()
      :await db.from("humkin_radio_programs").insert({...fields,owner_id:user.id}).select("id").single();
   await checkOne(result,"Show save");
   $("show-form").classList.add("hidden");editingShow=null;setBusy(false);
   await loadDesk();note("Saved "+name+". Active listeners apply schedule on refresh.");
 }catch(err){setBusy(false);note("Program save failed: "+err.message)}
}
async function toggleShow(program){
 if(busy)return;setBusy(true);
 try{await requireOwner();
   await checkOne(await db.from("humkin_radio_programs")
       .update({is_active:!program.is_active,updated_at:new Date().toISOString()})
       .eq("id",program.id).eq("owner_id",user.id).select("id").single(),"Show toggle");
   setBusy(false);await loadDesk();note(program.name+(program.is_active?" paused.":" enabled."));
 }catch(err){setBusy(false);note("Show change failed: "+err.message)}
}
async function deleteShow(program){
 if(busy||!confirm("Delete the scheduled show "+program.name+"? Audio files stay in your library."))return;
 setBusy(true);
 try{
   await requireOwner();
   await checkOne(await db.from("humkin_radio_programs").delete().eq("id",program.id)
     .eq("owner_id",user.id).select("id").single(),"Show delete");
   setBusy(false);await loadDesk();note("Deleted schedule "+program.name+". All recordings remain safe.");
 }catch(err){setBusy(false);note("Schedule delete failed: "+err.message)}
}
$("refresh").addEventListener("click",loadDesk);
$("art-upload").addEventListener("change",async event=>{
 const file=event.target.files?.[0];event.target.value="";
 if(file)await uploadArtwork(file);
});
$("edit-art").addEventListener("change",()=>updateArtPreview("edit"));
$("show-art").addEventListener("change",()=>updateArtPreview("show"));
$("auto-save").addEventListener("click",saveAutoDj);
$("edit-kind").addEventListener("change",()=>{
 $("edit-single").disabled=$("edit-kind").value!=="song";
 if($("edit-kind").value!=="song")$("edit-single").checked=false;
});
$("track-search").addEventListener("input",renderLibrary);
$("filter").addEventListener("change",renderLibrary);
$("bulk-on").addEventListener("click",()=>bulk(true));
$("bulk-off").addEventListener("click",()=>bulk(false));
$("clear-selected").addEventListener("click",()=>{selected.clear();renderLibrary()});
$("edit-save").addEventListener("click",saveEdit);
$("edit-delete").addEventListener("click",deleteTrack);
$("edit-close").addEventListener("click",()=>$("edit-dialog").close());
$("new-show").addEventListener("click",()=>showEditor());
$("cancel-show").addEventListener("click",()=>{$("show-form").classList.add("hidden");editingShow=null});
$("slot-add").addEventListener("click",()=>{
 const id=$("slot-select").value;if(!id)return;
 slots.push(id);renderSlots();
});
$("save-show").addEventListener("click",saveShow);
$("logout").addEventListener("click",async()=>{
 await db.auth.signOut();user=null;library=[];shows=[];selected.clear();await loadDesk();
});
db.auth.onAuthStateChange((event)=>{if(event==="SIGNED_IN"||event==="SIGNED_OUT")setTimeout(loadDesk,0)});
loadDesk();
