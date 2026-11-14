import {createClient} from "https://esm.sh/@supabase/supabase-js@2.57.0";

// Publishable key only. Every write is checked again by owner-only Postgres RLS.
const API="https://kbhqacsdvjsstzyplqij.supabase.co";
const KEY="sb_publishable_Bv9JuOctSQTmnE3O1dP8RA_MKRNSD-o";
const OWNER="us@abundent.org",LIVE="humkin-radio-live",INBOX="humkin-radio-inbox";
const db=createClient(API,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=id=>document.getElementById(id);
const days=["SUN","MON","TUE","WED","THU","FRI","SAT"];
let user=null,library=[],shows=[],staticList=[],editing=null,editingShow=null,slots=[],busy=false;
let stationSettings={bumper_every:0,station_label:"HUMKIN RADIO"};
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
 for(const id of ["save-show","edit-save","edit-delete","refresh","new-show","bulk-on","bulk-off","auto-save"])
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
  const [configResponse,cloudResult,staticResult,showsResult,settingsResult]=await Promise.all([
   fetch("../rotation.json",{cache:"no-store"}),
   db.from("humkin_radio_tracks")
    .select("id,uploaded_by,storage_path,original_name,title,artist,album,duration_seconds,bytes,enabled,kind,published_at,created_at")
    .order("created_at",{ascending:false}).limit(2000),
   db.from("humkin_radio_static_overrides").select("track_id,title,artist,album,enabled,kind").limit(1000),
   db.from("humkin_radio_programs").select("id,name,days,start_minute,end_minute,track_ids,is_active,priority,owner_id,updated_at")
    .order("start_minute",{ascending:true}).limit(500),
   db.from("humkin_radio_settings").select("id,owner_id,bumper_every,station_label").eq("id","main").limit(1)
  ]);
  if(!configResponse.ok)throw Error("Original rotation not reachable");
  for(const [name,result] of [["cloud catalog",cloudResult],["static overrides",staticResult],["shows",showsResult],["station settings",settingsResult]])
    if(result.error)throw Error(name+": "+result.error.message);
  const config=await configResponse.json();
  if(!Array.isArray(config.tracks))throw Error("Original rotation is incomplete");
  const overrides=new Map((staticResult.data||[]).map(t=>[t.track_id,t]));
  staticList=config.tracks.map(track=>{
   const override=overrides.get(track.id);
   return {id:track.id,source:"static",title:override?.title||track.title,
     artist:override?.artist||track.artist||"HUMKIN",
     album:override?.album||track.album||"HUMKIN RADIO",
     kind:override?.kind==="bumper"?"bumper":"song",
     enabled:override?.enabled!==false,published:true,
     duration:Number(track.duration),url:new URL(track.src,"https://humkin.abundent.org/fm/").href,
     originalName:String(track.src),bytes:null};
  });
  const cloud=(cloudResult.data||[]).map(track=>({
   id:"crate-"+track.id,dbId:track.id,source:"cloud",title:track.title,
   artist:track.artist,album:track.album,kind:track.kind,
   enabled:track.enabled,published:!!track.published_at,
   duration:Number(track.duration_seconds),bytes:track.bytes,
   originalName:track.original_name,
   url:track.published_at?publicSrc(track.storage_path):"",
   storagePath:track.storage_path,publishedAt:track.published_at
  }));
  library=[...cloud,...staticList];
  shows=showsResult.data||[];
  stationSettings={
    bumper_every:Number(settingsResult.data?.[0]?.bumper_every)||0,
    station_label:settingsResult.data?.[0]?.station_label||"HUMKIN RADIO"
  };
  for(const id of [...selected])if(!library.find(t=>t.id===id))selected.delete(id);
  renderLibrary();renderShows();renderSlots();renderNow();renderAutoDj();note("");
 }catch(err){note("Could not read station: "+err.message);$("auth-status").textContent="Signed in · data unavailable"}
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
   content.append(el("div",track.title,"track-title"));
   const status=el("div",null,"row");
   for(const label of [track.artist,track.kind==="bumper"?"BUMPER":"SONG",
       !track.enabled?"OFF AIR":!track.published?"PRIVATE DRAFT":"ON AIR",
       track.source==="cloud"?"CLOUD":"ORIGINAL"]){
      status.append(el("span",label,"pill"));
   }
   content.append(status);
   content.append(el("div",track.album+" · "+duration(track.duration),"sub"));
   content.append(el("div",(track.originalName||track.id)+" · ID "+track.id.slice(-12),"track-info"));
   const actions=el("div",null,"track-actions");
   actions.append(button("EDIT",()=>openEdit(track),"primary"));
   actions.append(button("PREVIEW",()=>preview(track)));
   actions.append(button(track.enabled?"HIDE":"ENABLE",()=>toggleTrack(track),track.enabled?"secondary":"primary"));
   item.append(check,content,actions);list.append(item);
 }
 $("selected-count").textContent=selected.size+" selected";
}

function renderAutoDj(){
 const value=String(stationSettings.bumper_every);
 const option=[...$("bumper-frequency").options].some(opt=>opt.value===value);
 $("bumper-frequency").value=option?value:"0";
 $("station-label").value=stationSettings.station_label;
 const active=library.filter(t=>t.kind==="bumper"&&trackAvailable(t));
 const cadence=stationSettings.bumper_every;
 $("auto-status").textContent=active.length+" recorded station ID(s) enabled. "+
   (cadence&&active.length?"A station ID will play every "+cadence+" music tracks.":
   cadence?"Cadence set, but nothing will play until you enable a bumper in the library.":
   "Automatic station IDs are currently OFF. The station plays music as before.");
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
 $("edit-enabled").checked=track.enabled;
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
   enabled:$("edit-enabled").checked};
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
   is_active:$("show-active").checked,track_ids:[...slots],updated_at:new Date().toISOString()};
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
$("auto-save").addEventListener("click",saveAutoDj);
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
