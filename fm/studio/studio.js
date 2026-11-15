import {createClient} from "https://esm.sh/@supabase/supabase-js@2.57.0";
const API="https://kbhqacsdvjsstzyplqij.supabase.co";
const KEY="sb_publishable_Bv9JuOctSQTmnE3O1dP8RA_MKRNSD-o";
const OWNER="us@abundent.org",BUCKET="humkin-radio-live";
const db=createClient(API,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=id=>document.getElementById(id);
const CLOCK=window.HUMKIN_STUDIO_CLOCK;
const BIBLE=window.HUMKIN_STATION_BIBLE;
const labels=new Map(CLOCK.DEPARTMENTS);
const ORIGIN="https://humkin.abundent.org/fm/";
let user=null,tracks=[],carts=[],draftId=null,rundown=[],busy=false;
let draftSavedAt=0;
let stationBible=null;
const el=(tag,value)=>{const x=document.createElement(tag);if(value!==undefined)x.textContent=String(value);return x};
function feedback(text){$("feedback").textContent=text}
function status(text){$("draft-status").textContent=text}
function track(id){return tracks.find(t=>t.id===id)}
function clean(s,max=120){return String(s||"").trim().slice(0,max)}
function available(t){return !!t?.enabled&&!!t?.published&&t?.duration>0&&!!t?.src}
function button(text,fn,cls){const b=el("button",text);b.type="button";if(cls)b.className=cls;b.addEventListener("click",fn);return b}
function option(value,text){const o=el("option",text);o.value=value;return o}
function format(t){return clean(t.artist||"HUMKIN")+" — "+clean(t.title)+" · "+CLOCK.prettyTime(t.duration)}
function addRundownTrack(t){
 if(!available(t))return feedback("Recording must be published and enabled before it can join a show.");
 if(rundown.length>=CLOCK.MAX_SLOTS)return feedback("The rundown is full.");
 rundown.push({type:"track",trackId:t.id,label:t.title});
 renderRundown();status("Rundown changed; save private draft to sync across devices.");
}
function cue(t){
 if(!available(t))return feedback("This audio is hidden, unpublished or unavailable.");
 const player=$("cue");player.src=t.src;player.load();
 $("cue-name").textContent="LOCAL REHEARSAL · "+format(t);
 player.play().catch(()=>feedback("Tap play on the rehearsal monitor to hear this recording."));
}
async function requireOwner(){
 const {data,error}=await db.auth.getSession();
 const account=data?.session?.user;
 if(error||account?.email?.toLowerCase()!==OWNER)
  throw Error("Owner sign-in required. Open the Crate Loader first.");
 user=account;return account;
}
function setBusy(v){
 busy=v;
 for(const id of ["save-cart","pilot","clear","song-add","save-draft","save-show","export"])
  $(id).disabled=v;
}
function buildLibrary(config,cloud,overrides){
 const base=new Map((overrides||[]).map(o=>[o.track_id,o]));
 const staticTracks=config.tracks.map(t=>{
  const o=base.get(t.id);
  return {id:String(t.id),title:o?.title||t.title,artist:o?.artist||t.artist,
   kind:o?.kind||"song",album:o?.album||t.album,duration:Number(t.duration),
   src:new URL(t.src,ORIGIN).href,enabled:o?.enabled!==false,published:true};
 });
 const cloudTracks=(cloud||[]).map(t=>{
  const path=String(t.storage_path||"");
  if(!/^[0-9a-f-]{36}\/[0-9a-f]{64}\.mp3$/.test(path))return null;
  return {id:"crate-"+t.id,title:t.title,artist:t.artist,album:t.album,kind:t.kind,
   duration:Number(t.duration_seconds),src:API+"/storage/v1/object/public/"+BUCKET+"/"+path,
   enabled:t.enabled,published:!!t.published_at};
 }).filter(Boolean);
 return [...staticTracks,...cloudTracks];
}
function renderPickers(){
 const selection=[$("cart-track"),$("song-pick")];
 for(const node of selection)node.replaceChildren();
 $("cart-track").append(option("","Choose any published recording…"));
 $("song-pick").append(option("","Choose a song…"));
 const sorted=tracks.filter(available).sort((a,b)=>a.title.localeCompare(b.title));
 for(const t of sorted){
  $("cart-track").append(option(t.id,format(t)));
  if(t.kind!=="bumper")$("song-pick").append(option(t.id,format(t)));
 }
 $("cart-department").replaceChildren();
 for(const [key,title] of CLOCK.DEPARTMENTS)
  $("cart-department").append(option(key,title));
 $("cart-department").value="station_id";
}
function renderCarts(){
 const shelf=$("carts");shelf.replaceChildren();
 $("cart-count").textContent=carts.length+" identified carts · Preview is private; adding a cart to a rundown does not interrupt listeners.";
 for(const c of carts){
  const t=track(c.track_id),card=el("div");card.className="cart";
  const badge=el("span",labels.get(c.department)||c.department);badge.className="badge";
  card.append(badge,el("h3",c.label));
  card.append(el("p",(t?t.title+" · "+CLOCK.prettyTime(t.duration):"MISSING RECORDING")+
     (available(t)?"":" · OFF AIR")));
  if(c.notes)card.append(el("p",c.notes));
  const row=el("div");row.className="row";
  const play=button("▶ CUE",()=>cue(t)),add=button("+ RUNDOWN",()=>addRundownTrack(t),"primary");
  play.disabled=!available(t);add.disabled=!available(t);
  row.append(play,add,button("EDIT",()=>{
    $("cart-track").value=c.track_id;
    $("cart-department").value=c.department;
    $("cart-label").value=c.label;
    $("cart-notes").value=c.notes;
    $("save-cart").textContent="UPDATE THIS CART";
    $("save-cart").dataset.editId=c.id;
    window.scrollTo?.({top:0,behavior:"smooth"});
  }));
  row.append(button("REMOVE",()=>removeCart(c),"danger"));
  card.append(row);shelf.append(card);
 }
 if(!carts.length)shelf.append(el("p","No carts yet. Add a recorded station ID, news item, jingle or sketch using the controls above."));
}

function addSceneToRundown(scene){
 if(rundown.length>=CLOCK.MAX_SLOTS)return status("Rundown is full.");
 rundown.push(BIBLE.asRundown(scene));
 renderRundown();
 status((scene.kind==="real_template"?"Unverified producer template":"Unrecorded scripted fiction")+
   " added to the visible rundown. This is NOT an audio file and cannot be scheduled until recorded, reviewed and uploaded.");
}
// Original field-announcer recordings are tracked as audition-only production
// assets. They are not in the public rotation or Cart Machine until the owner
// explicitly stages, reviews, and publishes a bumper.
let fieldCartsLoaded=false;
const FIELD_PREFIX="./recordings/";
async function loadFieldCarts(){
 if(fieldCartsLoaded)return;
 const list=$("field-carts-list"),msg=$("field-carts-status");
 if(!list||!msg)return;
 try{
  const response=await fetch(FIELD_PREFIX+"field-carts.json",{cache:"no-store"});
  if(!response.ok)throw Error("Recording manifest unavailable");
  const manifest=await response.json();
  if(manifest.schema_version!=="humkin.radio.field-carts/v1"||!Array.isArray(manifest.assets))
   throw Error("Recording manifest needs review");
  list.replaceChildren();
  for(const a of manifest.assets){
   if(!/^[a-z0-9-]+\.(mp3|m4a)$/.test(a.file||"")||
      !/^[0-9a-f]{64}$/.test(a.sha256||"")||!(a.duration_seconds>1)||
      !(a.bytes>0&&a.bytes<52428800))
      throw Error("Invalid original recording metadata");
   const box=el("article");box.className="cart";
   box.append(el("h3",a.title),el("p",a.note||"Original HUMKIN production audition"));
   const player=el("audio");
   player.controls=true;player.preload="none";
   player.src=new URL(FIELD_PREFIX+a.file,import.meta.url).href;
   player.setAttribute("aria-label",a.title+" local audition");
   box.append(player);
   if(a.can_stage===true&&a.file.endsWith(".mp3")&&a.kind==="bumper"){
    const action=button("STAGE PRIVATE BUMPER ↗",()=>stageFieldCart(a,action,box),"primary");
    box.append(action);
   }else box.append(el("p","UNALTERED SOURCE · for audition/reference only"));
   list.append(box);
  }
  fieldCartsLoaded=true;
  msg.textContent=manifest.assets.length+" source/edited recordings in the production archive. Some edits may already be in the station rotation; check Station Manager for individual on-air status. Private staging does not air anything.";
 }catch(error){msg.textContent="Audition shelf unavailable: "+error.message}
}
async function stageFieldCart(a,action,box){
 if(busy||action.disabled)return;
 const notice=el("p","Preparing secure upload…");
 notice.setAttribute("role","status");box.append(notice);action.disabled=true;
 try{
  const account=await requireOwner();
  if(!a.can_stage||a.kind!=="bumper"||!a.file.endsWith(".mp3"))
   throw Error("Only edited, owner-reviewed MP3 candidate carts can be staged.");
  const url=new URL(FIELD_PREFIX+a.file,import.meta.url);
  if(url.origin!==location.origin||!url.pathname.startsWith(new URL(FIELD_PREFIX,import.meta.url).pathname))
   throw Error("Unapproved source address");
  const res=await fetch(url,{cache:"no-store"});
  if(!res.ok)throw Error("Source recording missing (HTTP "+res.status+")");
  const bytes=await res.arrayBuffer();
  if(bytes.byteLength!==a.bytes)throw Error("Source recording length changed; do not stage.");
  const hash=[...new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))]
   .map(n=>n.toString(16).padStart(2,"0")).join("");
  if(hash!==a.sha256)throw Error("Source checksum mismatch; do not stage.");
  const existing=await db.from("humkin_radio_tracks")
    .select("id,published_at,enabled").eq("sha256",hash).maybeSingle();
  if(existing.error)throw existing.error;
  if(existing.data){
   notice.textContent=existing.data.published_at
     ?"Already in the cloud catalog; check Station Manager for approval and enablement."
     :"Already staged in the PRIVATE cloud crate; review before publishing.";
   return;
  }
  const path=account.id+"/"+hash+".mp3";
  const file=new File([bytes],a.file,{type:"audio/mpeg"});
  const uploaded=await db.storage.from("humkin-radio-inbox")
   .upload(path,file,{upsert:false,contentType:"audio/mpeg",cacheControl:"3600"});
  if(uploaded.error)throw uploaded.error;
  const recorded=await db.from("humkin_radio_tracks").insert({
   uploaded_by:account.id,sha256:hash,storage_path:path,
   original_name:a.file,title:a.title,artist:"HUMKIN",
   album:"HUMKIN RADIO · PREVIEW CARTS",duration_seconds:a.duration_seconds,
   bytes:a.bytes,kind:"bumper",enabled:false
  }).select("id").single();
  if(recorded.error)throw recorded.error;
  notice.textContent="STAGED IN PRIVATE CRATE · BUMPER · DISABLED · NOT ON AIR. Review it in the Crate Loader; publication and station enablement remain separate decisions.";
  action.textContent="STAGED — NOT ON AIR";
 }catch(error){
  notice.textContent="Could not stage this cart: "+(error.message||String(error));
  action.disabled=false;
 }
}

async function copyScene(scene){
 const text=BIBLE.copyText(scene);
 try{
  if(!navigator.clipboard?.writeText)throw Error("Clipboard unavailable");
  await navigator.clipboard.writeText(text);
  status("Copied \""+scene.label+"\" for recording. The script is not on air.");
 }catch{
  // Mobile browsers without clipboard permissions can save the same source.
  const url=URL.createObjectURL(new Blob([text+"\\n"],{type:"text/plain"}));
  const link=el("a");link.href=url;
  link.download="HUMKIN-"+scene.id+".txt";
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),4000);
  status("Saved the script as a text file for recording.");
 }
}
function renderBible(){
 const panel=$("script-cards"),staff=$("station-staff"),dayparts=$("station-dayparts");
 for(const node of [panel,staff,dayparts])node.replaceChildren();
 if(!stationBible){
  $("script-status").textContent="Station-bible scripts unavailable right now. Existing cart and rundown tools still work.";
  return;
 }
 $("script-status").textContent=stationBible.scenes.length+
  " original scripts · "+stationBible.roles.length+" cast voices · "+
  stationBible.dayparts.length+" proposed dayparts · human review before broadcast.";
 const signature=stationBible.sonic_signature;
 $("station-signature").textContent="THE LANTERN · "+signature.notes.join(" → ")+
  " · "+signature.tempo_bpm+" BPM · "+signature.direction;
 for(const role of stationBible.roles){
  const card=el("article");
  card.append(el("h4",role.name+" · "+role.job),el("p",role.principle),
   el("p","VOICE: "+role.voice));
  staff.append(card);
 }
 for(const day of stationBible.dayparts){
  const card=el("article");
  card.append(el("strong",day.time+" · "+day.name),el("span",day.format));
  dayparts.append(card);
 }
 for(const scene of stationBible.scenes){
  const card=el("article");card.className="scene-card"+
    (scene.kind==="real_template"?" real":"");
  const badge=el("span",scene.kind==="real_template"?
   "VERIFY FIRST · NOT FOR AIR":"ORIGINAL FICTION · NOT RECORDED","badge");
  const heading=el("h3",scene.label);
  const info=el("p",scene.role+" · "+CLOCK.prettyTime(scene.expected_seconds));
  info.className="muted";
  const direction=el("p",scene.direction,"direction");
  const dialogue=el("p",scene.script,"story-text");
  const actions=el("div");actions.className="row";
  actions.append(button("COPY SCRIPT",()=>copyScene(scene),"primary"),
    button("+ RUNDOWN",()=>addSceneToRundown(scene)));
  card.append(badge,heading,info,direction,dialogue,actions);
  panel.append(card);
 }
}
function recordTime(rows){
 return CLOCK.timeOf(rows,new Map(tracks.map(t=>[t.id,t])));
}
function renderRundown(){
 rundown=CLOCK.sanitizeRundown(rundown);
 const list=$("rundown");list.replaceChildren();
 let seconds=0;
 for(const [i,item] of rundown.entries()){
  const li=el("li");if(item.type==="script")li.className="script";
  const time=el("strong",CLOCK.prettyTime(seconds));
  const body=el("div");
  const isScript=item.type==="script";
  const t=isScript?null:track(item.trackId);
  body.append(el("strong",isScript?"✎ SCRIPT NEEDED · "+item.label:
   (available(t)?t.title:"MISSING AUDIO · "+item.label)));
  if(isScript){
   const note=el("span",item.notes||"");note.className="script-note";body.append(note);
  }else{
   const note=el("span",(t?.artist||"Unknown")+" · "+CLOCK.prettyTime(t?.duration||0));
   note.className="script-note";body.append(note);
  }
  seconds+=isScript?item.expectedSeconds:(t?.duration||0);
  const actions=el("div");actions.className="controls";
  const move=(direction)=>{
   const to=i+direction;if(to<0||to>=rundown.length)return;
   [rundown[i],rundown[to]]=[rundown[to],rundown[i]];
   renderRundown();status("Unsaved changes in the rundown.");
  };
  const up=button("↑",()=>move(-1)),down=button("↓",()=>move(1));
  up.disabled=i===0;down.disabled=i===rundown.length-1;actions.append(up,down);
  if(isScript){
   const select=el("select");select.setAttribute("aria-label","Assign recorded cart to "+item.label);
   select.append(option("","Choose recording…"));
   const sorted=[...carts].sort((a,b)=>
     Number(b.department===item.department)-Number(a.department===item.department));
   for(const c of sorted){const target=track(c.track_id);
    if(available(target))select.append(option(target.id,c.label+" · "+(labels.get(c.department)||c.department)));
   }
   select.style.maxWidth="185px";
   actions.append(select,button("ASSIGN",()=>{
    const target=track(select.value);if(!available(target))return status("Choose a recorded cart first.");
    rundown[i]={type:"track",trackId:target.id,label:target.title};
    renderRundown();status("Script beat replaced with recorded audio; save draft.");
   }));
  }else if(available(t))actions.append(button("▶",()=>cue(t)));
  actions.append(button("×",()=>{rundown.splice(i,1);renderRundown();status("Unsaved changes.");},"danger"));
  li.append(time,body,actions);list.append(li);
 }
 const estimated=recordTime(rundown);
 const pending=rundown.filter(x=>x.type==="script").length;
 $("clock").textContent="Estimated runtime · "+CLOCK.prettyTime(estimated)+
  " / 1:00:00 · "+pending+" unrecorded spoken beats"+
  (estimated>3600?" · OVER ONE HOUR":"");
 if(!rundown.length)list.append(el("li","Nothing in the rundown. Choose DRAFT THE FIRST DAY or add a song."));
}
async function saveCart(){
 if(busy)return;
 const id=$("cart-track").value,department=$("cart-department").value;
 const t=track(id),label=clean($("cart-label").value);
 if(!available(t)||!labels.has(department)||!label)
  return feedback("Choose a published recording, a department, and a cart label.");
 setBusy(true);
 try{
  await requireOwner();
  const currentId=$("save-cart").dataset.editId;
  const values={owner_id:user.id,track_id:id,department,label,
   notes:clean($("cart-notes").value,1000),updated_at:new Date().toISOString()};
  const result=currentId?
    await db.from("humkin_radio_carts").update(values).eq("id",currentId)
     .eq("owner_id",user.id).select("id").single():
    await db.from("humkin_radio_carts").insert(values).select("id").single();
  if(result.error)throw result.error;
  delete $("save-cart").dataset.editId;$("save-cart").textContent="+ SAVE TO CARTRIDGE SHELF";
  $("cart-label").value="";$("cart-notes").value="";
  await refreshContent();feedback("Cart saved to the private station shelf.");
 }catch(err){feedback("Cart save failed: "+err.message)}
 finally{setBusy(false)}
}
async function removeCart(c){
 if(busy||!confirm("Remove cartridge label "+c.label+"? The underlying recording is not deleted."))return;
 setBusy(true);
 try{
  const r=await db.from("humkin_radio_carts").delete().eq("id",c.id)
     .eq("owner_id",user.id).select("id").single();
  if(r.error)throw r.error;
  await refreshContent();feedback("Cartridge removed. Audio remains in the main library.");
 }catch(err){feedback("Cart removal failed: "+err.message)}
 finally{setBusy(false)}
}
async function refreshContent(){
 const [cat,drafts]=await Promise.all([
  db.from("humkin_radio_carts").select("id,owner_id,track_id,department,label,notes,created_at")
    .order("created_at",{ascending:false}).limit(500),
  db.from("humkin_radio_production_drafts").select("id,title,rundown,updated_at")
    .order("updated_at",{ascending:false}).limit(10)
 ]);
 if(cat.error)throw cat.error;if(drafts.error)throw drafts.error;
 carts=cat.data||[];
 renderCarts();
 if(!draftId&&drafts.data?.length){
  const d=drafts.data[0];draftId=d.id;
  $("draft-title").value=d.title;
  rundown=CLOCK.sanitizeRundown(d.rundown);
  draftSavedAt=Date.parse(d.updated_at)||0;
  renderRundown();
  status("Loaded your latest saved producer draft.");
 }
}
async function boot(){
 try{
  await requireOwner();
  $("auth").textContent="UNLOCKED · "+user.email+" · this production room is private.";
  $("sign-in").classList.add("hidden");
  const [response,cloud,overrides,bibleRes]=await Promise.all([
   fetch("../rotation.json",{cache:"no-store"}),
   db.from("humkin_radio_tracks").select("id,title,artist,album,duration_seconds,storage_path,enabled,kind,published_at")
     .limit(1500),
   db.from("humkin_radio_static_overrides").select("track_id,title,artist,album,kind,enabled").limit(1000),
   fetch("./station-bible.json",{cache:"no-store"}).catch(()=>null)
  ]);
  if(!response.ok)throw Error("Cannot read published station catalog");
  if(cloud.error||overrides.error)throw Error(cloud.error?.message||overrides.error?.message);
  const config=await response.json();
  try{
   stationBible=bibleRes?.ok?BIBLE.validate(await bibleRes.json()):null;
  }catch{stationBible=null}
  tracks=buildLibrary(config,cloud.data,overrides.data);
  renderPickers();
  renderBible();
  await loadFieldCarts();
  await refreshContent();
  $("workbench").classList.remove("hidden");
  feedback("Production room ready · "+tracks.filter(available).length+" available recordings.");
  renderRundown();
 }catch(err){
  $("auth").textContent=err.message;
  $("sign-in").classList.remove("hidden");
  $("workbench").classList.add("hidden");
 }
}
async function saveDraft(){
 if(busy)return;
 const title=clean($("draft-title").value,120);
 if(!title)return status("Please name the program.");
 setBusy(true);
 try{
  await requireOwner();
  const values={owner_id:user.id,title,rundown:CLOCK.sanitizeRundown(rundown),
    updated_at:new Date().toISOString()};
  const response=draftId?
    await db.from("humkin_radio_production_drafts").update(values)
      .eq("id",draftId).eq("owner_id",user.id).select("id,updated_at").single():
    await db.from("humkin_radio_production_drafts").insert(values)
      .select("id,updated_at").single();
  if(response.error)throw response.error;
  draftId=response.data.id;
  draftSavedAt=Date.parse(response.data.updated_at);
  status("Private producer draft saved to Supabase. Open this room on another signed-in device to continue.");
 }catch(err){status("Could not save draft: "+err.message)}
 finally{setBusy(false)}
}
async function savePausedShow(){
 if(busy)return;
 const title=clean($("draft-title").value,100);
 const result=CLOCK.eligibleBroadcast(rundown,tracks);
 if(!title||!result.ok)
  return status("Cannot make a show yet: "+result.unresolved+
    " unrecorded, hidden, or missing rundown entries. Replace script beats with uploaded and published audio first.");
 if(recordTime(rundown)>3600)
  return status("This rundown exceeds one hour. Remove or shorten recordings before making a one-hour program.");
 if(!confirm("Create an INACTIVE one-hour show draft in Station Manager? It will NOT go live until you explicitly enable and schedule it there."))return;
 setBusy(true);
 try{
  await requireOwner();
  const response=await db.from("humkin_radio_programs").insert({
   owner_id:user.id,name:title,track_ids:result.trackIds,
   days:[0],start_minute:60,end_minute:120,priority:0,is_active:false,
   updated_at:new Date().toISOString()
  }).select("id").single();
  if(response.error)throw response.error;
  status("Created a PAUSED show. Open Station Manager to set a schedule and enable it when ready. Audio remains unchanged.");
 }catch(err){status("Could not create show: "+err.message)}
 finally{setBusy(false)}
}
function exportScript(){
 const title=clean($("draft-title").value,120)||"HUMKIN RADIO";
 let elapsed=0;
 const lines=[title,"HUMKIN RADIO · PRODUCER RUNDOWN","All times approximate. This is a draft, not a broadcast log.",""];
 for(const item of CLOCK.sanitizeRundown(rundown)){
  const t=item.type==="track"?track(item.trackId):null;
  lines.push(CLOCK.prettyTime(elapsed)+" · "+(item.type==="script"?
    "[RECORD ME] "+item.label+" / "+(labels.get(item.department)||item.department):
    "[AUDIO] "+item.label+" — "+(t?.artist||"unavailable")));
  if(item.type==="script"){lines.push("   "+item.notes);elapsed+=item.expectedSeconds}
  else elapsed+=t?.duration||0;
 }
 lines.push("","Estimated running time: "+CLOCK.prettyTime(elapsed));
 const url=URL.createObjectURL(new Blob([lines.join("\n")+"\n"],{type:"text/plain"}));
 const link=el("a");link.href=url;link.download="HUMKIN-FIRST-DAY-RUNDOWN.txt";
 document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),4000);
 status("Downloaded a producer's script; uploading finished audio and approving it remain separate.");
}
$("cart-track").addEventListener("change",()=>{
 const t=track($("cart-track").value);
 if(t&&!$("cart-label").value)$("cart-label").value=t.title.slice(0,120);
});
$("save-cart").addEventListener("click",saveCart);
$("song-add").addEventListener("click",()=>{const t=track($("song-pick").value);if(t)addRundownTrack(t)});
$("pilot").addEventListener("click",()=>{
 if(rundown.length&&!confirm("Replace the UNSAVED visible rundown with a fresh First Day pilot? Saved draft remains until you press SAVE PRIVATE DRAFT."))return;
 const beats=stationBible?BIBLE.pilotBeats(stationBible):undefined;
 const built=CLOCK.pilot(tracks,14,beats);
 rundown=built.rundown;$("draft-title").value="HUMKIN RADIO · THE FIRST DAY";
 renderRundown();
 status("Pilot assembled: "+built.songCount+" real music slots and "+built.unrecorded+
  " scripted spoken beats awaiting recordings (including one HOLD for real, verified community news). Estimated "+CLOCK.prettyTime(built.totalSeconds)+
  ". Save the private draft to make it durable.");
});
$("clear").addEventListener("click",()=>{
 if(!confirm("Clear this displayed rundown? The saved version is not changed until you save again."))return;
 rundown=[];renderRundown();status("Cleared locally; save to update the remote draft.");
});
$("save-draft").addEventListener("click",saveDraft);
$("save-show").addEventListener("click",savePausedShow);
$("export").addEventListener("click",exportScript);
db.auth.onAuthStateChange((event)=>{if(event==="SIGNED_IN"||event==="SIGNED_OUT")setTimeout(boot,0)});
boot();
