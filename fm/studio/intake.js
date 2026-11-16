/* HUMKIN RADIO // living cart intake
 * Browser-only dry audio prep -> owner-approved PRIVATE cloud review draft.
 * No automatic publication, enabling, scheduling or transmission.
 */
import {createClient} from "https://esm.sh/@supabase/supabase-js@2.57.0";
const API="https://kbhqacsdvjsstzyplqij.supabase.co";
const KEY="sb_publishable_Bv9JuOctSQTmnE3O1dP8RA_MKRNSD-o";
const OWNER="us@abundent.org",BUCKET="humkin-radio-inbox";
const db=createClient(API,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const core=window.HUMKIN_CART_INTAKE,$=id=>document.getElementById(id);
let current=null,busy=false,manifestHashes=new Map(),manifestLoaded=false;
const setStatus=value=>{$("intake-status").textContent=value};
function clear(){
 if(current)for(const key of ["originalUrl","preparedUrl"])if(current[key])URL.revokeObjectURL(current[key]);
 current=null;
 for(const id of ["intake-original","intake-preview"]){$(id).removeAttribute("src");$(id).load()}
 $("intake-result").classList.add("hidden");
 $("intake-stage").disabled=true;$("intake-download").disabled=true;
 $("intake-stage").textContent="STAGE PRIVATE EDIT → REVIEW QUEUE";
}
async function owner(){
 const {data,error}=await db.auth.getUser();
 if(error||data?.user?.email?.toLowerCase()!==OWNER)
  throw Error("Sign in as the HUMKIN owner at Crate Loader first.");
 return data.user;
}
async function sha(data){return [...new Uint8Array(await crypto.subtle.digest("SHA-256",data))]
 .map(n=>n.toString(16).padStart(2,"0")).join("")}
async function loadHashes(){
 if(manifestLoaded)return;
 try{
  const r=await fetch("./recordings/field-carts.json",{cache:"no-store"});
  if(!r.ok)throw Error("No manifest");
  const json=await r.json();
  if(json.schema_version!=="humkin.radio.field-carts/v1")throw Error("Unexpected manifest");
  for(const a of json.assets||[])if(/^[0-9a-f]{64}$/.test(a.sha256||""))
   manifestHashes.set(a.sha256,a.title);
  manifestLoaded=true;
 }catch{ /* A missing optional shelf is not permission to publish. */ }
}
async function cloudDuplicate(value){
 const {data,error}=await db.from("humkin_radio_tracks")
  .select("id,title,published_at,enabled").eq("sha256",value).maybeSingle();
 if(error)throw error;
 return data;
}
async function encode(pcm){
 if(!window.lamejs?.Mp3Encoder)throw Error("The MP3 encoder is unavailable. Reload the Studio while online.");
 const encoder=new window.lamejs.Mp3Encoder(1,pcm.sampleRate,128),packets=[];
 const frame=1152,ints=new Int16Array(frame);
 for(let off=0;off<pcm.mono.length;off+=frame){
  const n=Math.min(frame,pcm.mono.length-off);
  for(let i=0;i<n;i++)ints[i]=Math.round(pcm.mono[off+i]*32767);
  const block=encoder.encodeBuffer(ints.subarray(0,n));
  if(block.length)packets.push(new Uint8Array(block));
  if(off%(frame*150)===0){
   setStatus("Preparing the dry radio edit on this device… "+Math.round(off/pcm.mono.length*100)+"%");
   await new Promise(resolve=>setTimeout(resolve,0));
  }
 }
 const tail=encoder.flush();if(tail.length)packets.push(new Uint8Array(tail));
 return new Blob(packets,{type:"audio/mpeg"});
}
function download(blob,name){
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),4000);
}
function receipt(item,stageInfo){
 return {schema:"humkin.radio.intake-receipt/v1",created_at:new Date().toISOString(),
  source:{name:item.file.name,bytes:item.file.size,sha256:item.sourceSha,
   retained:"Original never uploaded; keep the source on your own device"},
  edit:{name:item.edit.name,bytes:item.edit.size,sha256:item.editSha,
   duration_seconds:item.duration,process:"dry mono MP3; conservative leveling and fades; no static"},
  editorial:{title:$("intake-title").value.trim(),department:$("intake-department").value,
   human_review_required:true,rights_reviewed:false,confirmed_aired:false},
  staging:stageInfo};
}
async function receive(file){
 if(busy||!file)return;
 clear();busy=true;$("intake-pick").disabled=true;
 setStatus("Inspecting "+file.name+" locally…");
 try{
  if(file.size<500||file.size>core.MAX_BYTES)
   throw Error("Choose an audio file under 25 MiB; long songs go to the regular Crate Loader.");
  if(!/\.(mp3|m4a|wav|webm|ogg)$/i.test(file.name))
   throw Error("Choose MP3, M4A, WAV, WebM or OGG. Codec support depends on the browser.");
  const raw=await file.arrayBuffer(),sourceSha=await sha(raw);
  await loadHashes();
  if(manifestHashes.has(sourceSha))
   throw Error("This original is already in the Station Desk as "+manifestHashes.get(sourceSha)+". Use the existing shelf.");
  const AudioCtx=window.AudioContext||window.webkitAudioContext;
  if(!AudioCtx)throw Error("This browser cannot decode audio here.");
  const ctx=new AudioCtx();let audio;
  try{audio=await ctx.decodeAudioData(raw.slice(0))}finally{await ctx.close()}
  if(audio.duration>core.MAX_SECONDS||audio.numberOfChannels>2)
   throw Error("Only mono/stereo spoken recordings up to 120 seconds can be auto-edited. Use Crate Loader for longer material.");
  const channels=Array.from({length:audio.numberOfChannels},(_,i)=>audio.getChannelData(i));
  const pcm=core.prepare(channels,audio.sampleRate);
  const mp3=await encode(pcm);
  if(mp3.size>6*1024*1024)throw Error("Prepared edit is too large for the private upload.");
  const suggested=core.infer(file.name,pcm.duration);
  const edit=new File([mp3],core.safeName(suggested.title)+"-dry-radio.mp3",{type:"audio/mpeg"});
  const editSha=await sha(await edit.arrayBuffer());
  if(manifestHashes.has(editSha))
   throw Error("That exact edited cart already exists: "+manifestHashes.get(editSha));
  current={file,sourceSha,edit,editSha,duration:pcm.duration,
   originalUrl:URL.createObjectURL(file),preparedUrl:URL.createObjectURL(edit)};
  $("intake-original").src=current.originalUrl;
  $("intake-preview").src=current.preparedUrl;
  $("intake-title").value=suggested.title;
  $("intake-department").value=suggested.department;
  $("intake-rights").checked=false;
  $("intake-lab-notes").textContent=
   "ORIGINAL · "+audio.duration.toFixed(1)+" s · "+Math.round(file.size/1024)+" KiB · SHA "+sourceSha.slice(0,12)+"…\n"+
   "EDIT · "+pcm.duration.toFixed(1)+" s · "+Math.round(edit.size/1024)+" KiB · dry 128 kbps mono MP3\n"+
   "Level adjustment: "+(20*Math.log10(pcm.gain)).toFixed(1)+" dB; boundary trim/fades; no static.\n"+
   suggested.placement+(suggested.caution?"\nHOLD: clock, weather, phone or request claims need fact-checking before broadcast.":"");
  $("intake-result").classList.remove("hidden");
  $("intake-stage").disabled=false;$("intake-download").disabled=false;
  setStatus("EDIT READY · Listen to both versions, adjust the label and stage privately if you approve.");
 }catch(err){setStatus("Nothing staged · "+(err.message||String(err)))}
 finally{busy=false;$("intake-pick").disabled=false;$("intake-pick").value=""}
}
async function stage(){
 if(!current||busy)return;
 const title=$("intake-title").value.trim().slice(0,120),dept=$("intake-department").value;
 if(!title||!core.ROLES.includes(dept))return setStatus("A title and valid department are required.");
 if(!$("intake-rights").checked)return setStatus("Confirm permission for this PRIVATE draft first.");
 busy=true;$("intake-stage").disabled=true;
 try{
  const user=await owner();
  const originalMatch=await cloudDuplicate(current.sourceSha);
  if(originalMatch)throw Error("Original already in cloud as "+originalMatch.title+". Review it there instead.");
  const match=await cloudDuplicate(current.editSha);
  if(match)throw Error("Edit already registered as "+match.title+
    (match.published_at?" (published).":" (private draft)."));
  const path=user.id+"/"+current.editSha+".mp3";
  setStatus("Uploading ONLY the processed edit to the private review crate…");
  const upload=await db.storage.from(BUCKET).upload(path,current.edit,
    {upsert:false,contentType:"audio/mpeg",cacheControl:"3600"});
  if(upload.error&&!/(already exists|duplicate|409)/i.test(upload.error.message||""))
   throw upload.error;
  const saved=await db.from("humkin_radio_tracks").insert({
   uploaded_by:user.id,sha256:current.editSha,storage_path:path,original_name:current.file.name,
   title,artist:"HUMKIN",
   album:dept==="feature"?"HUMKIN RADIO · LONG FEATURE HOLD":"HUMKIN RADIO · REVIEW CARTS",
   duration_seconds:current.duration,bytes:current.edit.size,
   kind:"bumper",enabled:false
  }).select("id").single();
  if(saved.error)throw saved.error;
  download(new Blob([JSON.stringify(receipt(current,{
   state:"PRIVATE_STAGED",cloud_track_id:saved.data.id,published:false,
   enabled:false,owner_review_required:true}),null,2)+"\n"],
   {type:"application/json"}),core.safeName(title)+"-intake-receipt.json");
  $("intake-stage").textContent="STAGED · DISABLED";
  setStatus("PRIVATE REVIEW QUEUE ✓ · MP3 uploaded, unpublished, disabled, not broadcast. Receipt saved; original stays on your device.");
 }catch(err){
  setStatus("Not staged · "+(err.message||String(err)));
  $("intake-stage").disabled=false;
 }finally{busy=false}
}
$("intake-pick").addEventListener("change",e=>receive(e.target.files?.[0]));
const drop=$("intake-drop");
for(const event of ["dragenter","dragover"])drop.addEventListener(event,e=>{
 e.preventDefault();drop.classList.add("over")
});
for(const event of ["dragleave","drop"])drop.addEventListener(event,e=>{
 e.preventDefault();drop.classList.remove("over")
});
drop.addEventListener("drop",e=>{e.preventDefault();receive(e.dataTransfer?.files?.[0])});
$("intake-stage").addEventListener("click",stage);
$("intake-download").addEventListener("click",()=>{if(current)download(current.edit,current.edit.name)});
$("intake-start-over").addEventListener("click",()=>{if(!busy){clear();setStatus("Choose another recording. Nothing is automatically published.")}});
