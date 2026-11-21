import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import {installProtonLogin} from "../proton-auth.mjs";
import {humkinAuthOptions} from "../browser-safe-auth.mjs";
import * as tus from "https://esm.sh/tus-js-client@4.3.1";
import {r2Bridge} from "../r2-bridge-client.js";
import {r2Direct,putPrivateMp3} from "./r2-direct-client.mjs";
import {inferFileMetadata,parseLayout,titleFromFile} from "./folder-metadata.mjs";
import {inspectTowerFolder,towerAudioDigest} from "./tower-sidecars.mjs";
import {mountFeatureDesk} from "./feature-desk.mjs";
import {mountCloudReceipt} from "./cloud-house-receipt.mjs";
import {mountLivingControl} from "./living-control.mjs";

const API = "https://kbhqacsdvjsstzyplqij.supabase.co";
const KEY = "sb_publishable_Bv9JuOctSQTmnE3O1dP8RA_MKRNSD-o"; // Public, RLS-scoped key. Never a secret/service key.
const INBOX = "humkin-radio-inbox", LIVE = "humkin-radio-live";
const OWNER = "us@abundent.org", BUDGET = 700 * 1024 * 1024;
const MAX_FILE = 50 * 1024 * 1024;
const db = createClient(API, KEY, {auth: humkinAuthOptions()});
const $ = id => document.getElementById(id);
let selected = [], busy = false, stopRequested = false, drafts = [], known = [], activeUser = null;
let featureDesk = null;
let livingControl = null;
let scanPromise=Promise.resolve();
let directReady=false;
const fmtTime = seconds => {
  seconds = Math.max(0, Math.round(Number(seconds)||0));
  return String(Math.floor(seconds / 3600)).padStart(2,"0") + ":" + String(Math.floor(seconds % 3600 / 60)).padStart(2,"0") + ":" + String(seconds % 60).padStart(2,"0");
};
const fmtBytes = n => (n / (1024*1024)).toFixed(1) + " MiB";
const log = message => {
  $("history").textContent = new Date().toLocaleTimeString() + " · " + message + "\n" + $("history").textContent.slice(0,11000);
};
function feedback(msg) { $("feedback").textContent = msg; log(msg) }
function isWav(f) {return /\.wav$/i.test(f.name)}
function isMp3(f) {return /\.mp3$/i.test(f.name)}
function isM4a(f) {return /\.m4a$/i.test(f.name)}
function titleFromName(name){return titleFromFile(name)}
function currentLayout(){
 return $("folder-layout").value==="custom"?$("folder-custom").value:$("folder-layout").value;
}
function inferItem(item){
 const mapping=inferFileMetadata(item.file.webkitRelativePath||item.file.name,currentLayout());
 item.folderInfo=mapping;
 const defaults={artist:$("fallback-artist").value.trim(),album:$("fallback-album").value.trim()};
 for(const field of ["title","artist","album"]){
   if(!item.edited[field])item[field]=mapping[field]||defaults[field]||"";
 }
}
function refreshFolderRules(){
 $("custom-layout-row").classList.toggle("hidden",$("folder-layout").value!=="custom");
 try{
  parseLayout(currentLayout());
  for(const item of selected)inferItem(item);
  $("folder-note").textContent="Using "+(currentLayout()||"none")+" for "+selected.length+" selected files. Folder paths are used only to infer editable metadata.";
 }catch(error){
  $("folder-note").textContent=error.message;
 }
 drawQueue();
}
function drawQueue(){
 $("queue").replaceChildren();
 const pending=selected.filter(item=>!item.duration).length;
 const knownSeconds=selected.reduce((s,item)=>s+(Number(item.duration)||0),0);
 const filter=$("queue-search").value.toLowerCase().trim(),sort=$("queue-sort").value;
 const matches=selected.filter(item=>!filter||
   [item.title,item.artist,item.album,item.folderInfo?.genre,item.folderInfo?.collection,item.folderInfo?.disc,item.file.name,item.folderInfo?.relativePath]
    .some(value=>String(value||"").toLowerCase().includes(filter)));
 const ordered=matches.slice().sort((a,b)=>{
   const key=item=>sort==="path"?(item.folderInfo?.relativePath||item.file.name):
     (["genre","collection","disc"].includes(sort)?item.folderInfo?.[sort]:item[sort])||"";
   return String(key(a)).localeCompare(String(key(b)),undefined,{numeric:true,sensitivity:"base"});
 });
 for(const item of ordered.slice(0,150)){
   const li=document.createElement("li"),details=document.createElement("div"),
     name=document.createElement("span"),status=document.createElement("span"),row=document.createElement("div");
   name.textContent=(item.folderInfo?.relativePath||item.file.name)+" · "+fmtBytes(item.file.size)+
     (item.duration?" · "+fmtTime(item.duration):"")+
     (item.folderInfo?.genre?" · GENRE "+item.folderInfo.genre:"")+
     (item.folderInfo?.collection?" · COLLECTION "+item.folderInfo.collection:"")+
     (item.folderInfo?.disc?" · "+item.folderInfo.disc:"")+
     (item.towerDigest&&!item.towerMeta?" · TOWER SIDECAR MISSING: CHECK TITLE":"");
   row.className="queue-controls";
   for(const [field,limit] of [["title",120],["artist",160],["album",160]]){
     const input=document.createElement("input");input.type="text";input.maxLength=limit;
     input.value=item[field]||"";input.placeholder=field.toUpperCase();
     input.setAttribute("aria-label",field+" for "+item.file.name);
     input.addEventListener("input",()=>{item[field]=input.value;item.edited[field]=true});
     row.append(input);
   }
   const kind=document.createElement("select");
   kind.className="kind";kind.setAttribute("aria-label","Recording category for "+item.file.name);
   for(const [value,label] of [["song","RADIO-ONLY SONG"],["single","OFFICIAL SINGLE ✳"],["bumper","STATION BUMPER / SPOKEN FEATURE"]]){
     const option=document.createElement("option");option.value=value;option.textContent=label;kind.append(option);
   }
   kind.value=item.kind;kind.addEventListener("change",()=>{item.kind=kind.value});
   row.append(kind);details.append(name,row);
   status.className="state";status.textContent=item.status;
   li.append(details,status);$("queue").append(li);
 }
 $("queue-note").textContent="Showing "+Math.min(150,matches.length)+" of "+matches.length+
   " matching files. Edit title / artist / album; use search to review the rest. Staging covers ALL "+selected.length+" selected files.";
 $("selection").textContent=selected.length+" files selected; "+pending+" durations still being scanned.";
 $("selected-time").textContent=fmtTime(knownSeconds)+" total duration detected.";
 $("stage").disabled=busy||!selected.length||!activeUser;
 $("cancel").disabled=!busy;$("clear").disabled=busy;
}
function drawAuth(){
 $("signed-out").classList.toggle("hidden",!!activeUser);
 $("signed-in").classList.toggle("hidden",!activeUser);
 $("signed-label").textContent=activeUser?"Connected: "+activeUser.email:"";
 drawQueue();
 $("publish").disabled=busy||!activeUser||!drafts.some(row=>row.kind!=="bumper"&&
  (row.storage_provider!=="r2_private"||row.r2_upload_verified_at));
}
function setBusy(value){
 busy=value;drawQueue();drawAuth();$("refresh-drafts").disabled=busy;
 $("send-link").disabled=busy;$("sign-out").disabled=busy;
}
async function getDuration(file){
 return new Promise((resolve,reject)=>{
   const url=URL.createObjectURL(file),a=document.createElement("audio");
   let complete=false;
   const finish=(duration,error)=>{
     if(complete)return;complete=true;clearTimeout(timer);
     a.removeAttribute("src");a.load();URL.revokeObjectURL(url);
     if(error)reject(error);else resolve(duration);
   };
   const timer=setTimeout(()=>finish(0,new Error("Metadata timeout")),15000);
   a.preload="metadata";a.addEventListener("loadedmetadata",()=>{
     if(Number.isFinite(a.duration)&&a.duration>0)finish(a.duration);
     else finish(0,new Error("Unknown duration"));
   },{once:true});
   a.addEventListener("error",()=>finish(0,new Error("Audio format unreadable")),{once:true});
   a.src=url;
 });
}
async function scanDurations(){
 const pending=selected.filter(item=>item.status==="READY"&&!item.duration);
 let next=0,finished=0;
 await Promise.all(Array.from({length:Math.min(4,pending.length)},async()=>{
   while(next<pending.length){
     const item=pending[next++];
     try{item.duration=await getDuration(item.file)}
     catch(err){item.status="NEEDS CHECK";log(item.file.name+": "+err.message)}
     finished++;
     if(finished%8===0||finished===pending.length)drawQueue();
   }
 }));
}
async function addFiles(files,towerScan=null){
 const existing=new Set(selected.map(x=>[
   x.file.webkitRelativePath||x.file.name,x.file.size,x.file.lastModified].join("|")));
 try{parseLayout(currentLayout())}catch(error){feedback(error.message);return}
 for(const file of files){
   if(!isMp3(file)&&!isWav(file)&&!isM4a(file))continue;
   const key=[file.webkitRelativePath||file.name,file.size,file.lastModified].join("|");
   if(existing.has(key))continue;existing.add(key);
   const item={file,status:"READY",duration:0,kind:"song",
     title:titleFromName(file.name),artist:"",album:"",edited:{title:false,artist:false,album:false}};
   inferItem(item);
   // Imported Tower audio has a matching <SHA256>.json sidecar.
   // Do not replace its editorial metadata with a hash filename.
   const digestFromName=towerAudioDigest(file.name);
   const sidecar=digestFromName&&towerScan?.metadata.get(digestFromName);
   if(digestFromName){
     item.towerDigest=digestFromName;
     item.towerMeta=Boolean(sidecar);
   }
   if(sidecar){
     item.title=sidecar.title;
     item.artist=sidecar.artist||$("fallback-artist").value.trim();
     item.album=sidecar.album||$("fallback-album").value.trim();
     item.duration=sidecar.duration;item.kind=sidecar.kind;
     for(const field of ["title","artist","album"])item.edited[field]=true;
   }
   selected.push(item);
 }
 refreshFolderRules();
 scanPromise=scanPromise.then(scanDurations);
 await scanPromise;
}
async function addTowerFolder(files){
 try{
   const report=await inspectTowerFolder(files);
   const summary=report.towerAudioCount
     ? "ACER TOWER: "+report.paired+" metadata pairs found in "+report.towerAudioCount+
       " hash-named audio files; "+report.rejected+" invalid sidecars, "+
       report.unpaired+" unmatched sidecars, "+report.unsupported+
       " audio files requiring local MP3 conversion. No files uploaded."
     : "Ordinary music folder selected. Inferring metadata from paths as before.";
   $("tower-note").textContent=summary;
   await addFiles(files,report);
 }catch(error){feedback("Tower catalog scan failed: "+error.message)}
}
async function assertTowerSource(item,originalSha){
 if(!item.towerDigest)return;
 if(originalSha!==item.towerDigest)
   throw Error("Tower audio bytes differ from the source SHA-256 filename. File withheld.");
 if(!item.towerMeta&&!item.edited.title)
   throw Error("Tower metadata sidecar missing. Edit this track's title explicitly before staging.");
}
async function convertWav(item){
 if(!window.lamejs?.Mp3Encoder) throw Error("WAV encoder not loaded. Retry online or use the desktop batch converter.");
 const Context=window.AudioContext||window.webkitAudioContext;
 if(!Context)throw Error("Browser cannot decode this WAV. Use desktop FFmpeg.");
 const ctx=new Context();
 try{
   const data=await item.file.arrayBuffer();
   const pcm=await ctx.decodeAudioData(data);
   if(pcm.numberOfChannels>2)throw Error("Multichannel WAV not supported; use desktop converter.");
   if(![32000,44100,48000].includes(pcm.sampleRate))throw Error("Unsupported WAV sample rate; use desktop converter.");
   item.duration=pcm.duration;drawQueue();
   const channels=Math.min(2,pcm.numberOfChannels),encoder=new window.lamejs.Mp3Encoder(channels,pcm.sampleRate,128);
   const left=pcm.getChannelData(0),right=channels===2?pcm.getChannelData(1):null;
   const block=1152,l=new Int16Array(block),r=new Int16Array(block),out=[];
   for(let pos=0;pos<left.length;pos+=block){
     if(stopRequested)throw Error("Stopped before upload");
     const count=Math.min(block,left.length-pos);
     for(let i=0;i<count;i++){
       l[i]=Math.round(Math.max(-1,Math.min(1,left[pos+i]))*32767);
       if(right)r[i]=Math.round(Math.max(-1,Math.min(1,right[pos+i]))*32767);
     }
     const chunk=channels===2?encoder.encodeBuffer(l.subarray(0,count),r.subarray(0,count)):encoder.encodeBuffer(l.subarray(0,count));
     if(chunk.length)out.push(new Uint8Array(chunk));
     if(pos%(block*256)===0){item.status="ENCODING "+Math.round(pos/left.length*100)+"%";drawQueue();await new Promise(done=>setTimeout(done,0))}
   }
   const tail=encoder.flush();if(tail.length)out.push(new Uint8Array(tail));
   const result=new File(out,item.file.name.replace(/\.(wav|m4a)$/i,".mp3"),{type:"audio/mpeg"});
   log("Converted "+item.file.name+" → "+fmtBytes(result.size)+" MP3. Original unchanged.");
   return result;
 }finally{await ctx.close()}
}
async function digest(file){
 const bytes=await file.arrayBuffer();
 return [...new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))].map(x=>x.toString(16).padStart(2,"0")).join("");
}
async function ensureSession(){
 const {data,error}=await db.auth.getSession();
 if(error||!data?.session?.user)throw Error("Sign in to upload.");
 const user=data.session.user;
 if(user.email?.toLowerCase()!==OWNER)throw Error("This uploader is reserved for the HUMKIN owner.");
 activeUser=user;return data.session;
}
async function uploadFile(file,path,onProgress){
 if(file.size<=6*1024*1024){
   const {error}=await db.storage.from(INBOX).upload(path,file,{upsert:false,contentType:"audio/mpeg",cacheControl:"3600"});
   if(error)throw error;onProgress(1);return;
 }
 const session=await ensureSession();
 await new Promise(async(resolve,reject)=>{
   const upload=new tus.Upload(file,{
     endpoint: API+"/storage/v1/upload/resumable",
     headers:{authorization:"Bearer "+session.access_token,apikey:KEY,"x-upsert":"false"},
     uploadDataDuringCreation:true,
     retryDelays:[0,1000,3000,5000,10000],
     metadata:{bucketName:INBOX,objectName:path,contentType:"audio/mpeg",cacheControl:"3600"},
     chunkSize:6*1024*1024,
     removeFingerprintOnSuccess:true,
     onProgress:(done,total)=>onProgress(total?done/total:0),
     onError:reject,onSuccess:resolve
   });
   try{
     const previous=await upload.findPreviousUploads();
     if(previous.length)upload.resumeFromPreviousUpload(previous[0]);
     upload.start();
   }catch(err){reject(err)}
 });
}
async function loadKnown(){
 const {data,error}=await db.from("humkin_radio_tracks")
   .select("id,sha256,storage_path,title,artist,album,kind,is_single,enabled,bytes,duration_seconds,published_at,storage_provider,r2_upload_verified_at,supabase_source_removed_at")
   .order("created_at",{ascending:false}).limit(2000);
 if(error)throw error;
 known=data||[];
 drafts=known.filter(x=>!x.published_at);
 $("draft-list").replaceChildren();
 if(!drafts.length){
   const li=document.createElement("li");li.textContent="Nothing staged. Choose a batch above."; $("draft-list").append(li);
 }else for(const row of drafts){
   const li=document.createElement("li");
   const label=document.createElement("span");
   label.textContent=(row.kind==="bumper"?"BUMPER · ":row.is_single?"SINGLE ✳ · ":"RADIO-ONLY SONG · ")+row.title+
     " · "+fmtTime(row.duration_seconds)+" · "+fmtBytes(row.bytes);
   const action=document.createElement("button");
   action.type="button";action.className="accent";
   const awaiting=row.storage_provider==="r2_private"&&!row.r2_upload_verified_at;
   action.disabled=awaiting;
   action.textContent=awaiting?"TRANSFER NOT VERIFIED":row.kind==="bumper"?"REVIEW + AIR THIS BUMPER":row.is_single?"REVIEW + AIR THIS SINGLE":"REVIEW + AIR THIS SONG";
   action.addEventListener("click",()=>publishOne(row));
   li.append(label,action);$("draft-list").append(li);
 }
 const used=known.filter(r=>r.storage_provider!=="r2_private"&&!r.supabase_source_removed_at)
   .reduce((s,r)=>s+Number(r.bytes||0),0);
 const secs=known.filter(x=>x.published_at).reduce((s,r)=>s+Number(r.duration_seconds||0),0);
 $("stats").textContent=known.filter(x=>x.published_at).length+ " published catalog recordings · "+drafts.length+" private drafts · "+fmtBytes(used)+" still in Supabase storage · "+known.filter(x=>x.storage_provider==="r2").length+" served by R2";
 $("total").textContent=fmtTime(secs)+" new cloud airtime";
 $("publish").disabled=busy||!drafts.some(row=>row.kind!=="bumper"&&
   (row.storage_provider!=="r2_private"||row.r2_upload_verified_at));
 featureDesk?.refresh();
 livingControl?.refresh();
}

async function refreshDirectStatus(){
 if(!activeUser){directReady=false;return;}
 try{
  const info=await r2Direct(db,"status");
  directReady=info.ready===true;
  $("direct-r2-status").textContent=directReady?
    "DIRECT PRIVATE R2 READY · 3 simultaneous uploads · no Supabase file staging · "+(info.credential_mode==="existing"?"existing R2 credentials reused":"separate private R2 credentials")+".":
    "DIRECT PRIVATE R2 NOT READY ("+String(info.reason||"configuration required")+
    "). "+(info.credential_mode==="existing"?"The existing R2 token may be limited to the public bucket. ":"")+
    "Existing private Supabase loader remains available.";
 }catch(error){
  directReady=false;
  $("direct-r2-status").textContent="DIRECT R2 OFFLINE ("+error.message+"). Existing loader remains available.";
 }
 $("stage").textContent=directReady?"STAGE DIRECTLY TO PRIVATE R2 ↗":"STAGE THIS CRATE ↗";
}
// Each item can be retried by pressing Stage again or by reselecting the folder.
// Completed hashes are deduplicated against the authoritative catalog.
async function stageDirect(){
 if(busy||!selected.length)return;
 try{await ensureSession();await scanPromise}catch(error){feedback(error.message);return}
 setBusy(true);stopRequested=false;
 const tasks=selected.filter(item=>item.status!=="STAGED"&&item.status!=="DUPLICATE");
 let next=0,uploaded=0,skipped=0,failed=0,finished=0;
 const setProgress=()=>{$("progress").value=tasks.length?100*finished/tasks.length:0;};
 const runOne=async item=>{
  item.status="PREPARING";drawQueue();
  try{
   if(!(item.duration>=1&&item.duration<=14400))item.duration=await getDuration(item.file);
   if(!item.title.trim()||!item.artist.trim()||!item.album.trim())
     throw Error("Title, artist and album are required.");
   if(item.album.trim().length>160)throw Error("Album exceeds 160 characters.");
   const mp3=isWav(item.file)||isM4a(item.file)?await convertWav(item):item.file;
   if(mp3.size>MAX_FILE)throw Error("MP3 exceeds 50 MiB; convert locally first.");
   const hash=await digest(mp3);
   await assertTowerSource(item,mp3===item.file?hash:await digest(item.file));
   if(known.some(x=>x.sha256===hash&&x.storage_provider!=="r2_private")){
     skipped++;item.status="DUPLICATE";return;
   }
   const preparation=await r2Direct(db,"prepare",{
     sha256:hash,bytes:mp3.size,original_name:item.file.name,
     title:item.title.trim(),artist:item.artist.trim(),album:item.album.trim(),
     duration_seconds:item.duration,kind:item.kind==="bumper"?"bumper":"song",
     is_single:item.kind==="single"
   });
   if(preparation.already_cataloged){skipped++;item.status="DUPLICATE";return}
   if(!preparation.already_staged){
     item.status="UPLOADING TO PRIVATE R2";drawQueue();
     let last=-1;
     await putPrivateMp3(mp3,preparation.put_url,(written,total)=>{
       const pct=Math.floor(100*written/Math.max(1,total));
       if(pct>=last+10){last=pct;item.status="UPLOADING "+pct+"%";drawQueue();}
     });
     item.status="VERIFYING SHA-256";drawQueue();
     await r2Direct(db,"finalize",{track_id:preparation.track_id});
   }
   uploaded++;item.status="STAGED";
  }catch(error){
   failed++;item.status="ERROR";log(item.file.name+" — "+error.message);
  }finally{finished++;setProgress();drawQueue();}
 };
 try{
  await loadKnown();
  await Promise.all(Array.from({length:Math.min(3,tasks.length)},async()=>{
   while(next<tasks.length&&!stopRequested){
    const item=tasks[next++];await runOne(item);
   }
  }));
  feedback("Direct R2 crate: "+uploaded+" verified private drafts, "+skipped+
    " duplicates, "+failed+" errors"+(stopRequested?", stopped early":"")+
    ". Nothing was published.");
 }finally{
  setBusy(false);
  try{await loadKnown()}catch(error){log("Catalog refresh: "+error.message)}
 }
}

async function stage(){
 if(directReady)return stageDirect();
 if(busy||!selected.length)return;
 try{await ensureSession()}catch(err){feedback(err.message);return}
 setBusy(true);stopRequested=false;let uploaded=0,skipped=0,failed=0;
 try{
   await loadKnown();
   for(let k=0;k<selected.length;k++){
     if(stopRequested)break;
     const item=selected[k];
     if(item.status==="STAGED"||item.status==="DUPLICATE")continue;
     item.status="PREPARING";drawQueue();
     try{
       if(!(item.duration>0&&item.duration<14400))item.duration=await getDuration(item.file);
       if(!item.title.trim()||!item.artist.trim()||!item.album.trim())
         throw Error("Missing title, artist or album. Set these in the preview before staging.");
       const mp3=isWav(item.file)||isM4a(item.file)?await convertWav(item):item.file;
       if(mp3.size>MAX_FILE)throw Error("MP3 larger than 50 MiB; use desktop converter at 128 kbps.");
       if(!(item.duration>0&&item.duration<14400))throw Error("Cannot determine track duration.");
       const sha=await digest(mp3);
       await assertTowerSource(item,mp3===item.file?sha:await digest(item.file));
       if(known.some(x=>x.sha256===sha)){
         skipped++;item.status="DUPLICATE";drawQueue();continue;
       }
       const used=known.filter(x=>x.storage_provider!=="r2_private"&&!x.supabase_source_removed_at)
         .reduce((s,x)=>s+Number(x.bytes||0),0);
       if(used+mp3.size>BUDGET)throw Error("700 MiB radio soft budget reached; stop and choose larger storage before continuing.");
       const {user}=await ensureSession();
       const path=user.id+"/"+sha+".mp3";
       item.status="UPLOADING";drawQueue();
       $("progress").value=0;
       try{await uploadFile(mp3,path,ratio=>{$("progress").value=ratio*100})}
       catch(err){
         // A prior successful upload may have left a private object when DB registration failed.
         if(!/(already exists|duplicate|resource already exists|409)/i.test(String(err.message||err)))throw err;
         log("Object already staged; retrying metadata registration.");
       }
       const record={uploaded_by:user.id,sha256:sha,storage_path:path,original_name:item.file.name,
         title:item.title.trim().slice(0,120),
         artist:item.artist.trim().slice(0,160),album:item.album.trim().slice(0,160),
         kind:item.kind==="bumper"?"bumper":"song",
         is_single:item.kind==="single",enabled:item.kind!=="bumper",
         duration_seconds:item.duration,bytes:mp3.size};
       const {data,error}=await db.from("humkin_radio_tracks").insert(record).select("id,sha256,storage_path,title,kind,is_single,enabled,bytes,duration_seconds,published_at").single();
       if(error){
         if(error.code==="23505"){skipped++;item.status="DUPLICATE";drawQueue();continue}
         throw error;
       }
       known.unshift(data);drafts.unshift(data);uploaded++;
       item.status="STAGED";drawQueue();
       feedback("Private: "+data.title+" · "+uploaded+" of "+selected.length+" new songs staged.");
     }catch(err){failed++;item.status="ERROR";drawQueue();log(item.file.name+" — "+err.message)}
   }
   feedback("Crate finished: "+uploaded+" staged, "+skipped+" duplicates, "+failed+" errors. Explicitly publish when ready.");
 }finally{
   setBusy(false);$("progress").value=0;
   try{await loadKnown()}catch(err){log("Refresh failure: "+err.message)}
 }
}
// R2 becomes the publication destination; the Supabase inbox is temporary.
async function publishStorage(row){
 if(row.storage_provider==="r2_private"){
   if(!row.r2_upload_verified_at)throw Error("Finish or retry the private upload before publication.");
   const result=await r2Direct(db,"publish",{track_id:row.id});
   log("R2 DIRECT ON AIR: "+row.title+" · "+result.object_key);
   return "R2 DIRECT";
 }
 try{
  const result=await r2Bridge(db,"publish",row.id);
  log("R2 ON AIR: "+row.title+" · "+result.object_key);
  return "R2";
 }catch(error){
  if(error.code!=="R2_NOT_CONFIGURED")throw error;
  // Safe reversible compatibility until restricted R2 credentials are installed.
  log("R2 credentials absent; using the existing Supabase publishing path.");
  const moved=await db.storage.from(INBOX).move(row.storage_path,row.storage_path,{destinationBucket:LIVE});
  if(moved.error){
   const parent=row.storage_path.slice(0,row.storage_path.lastIndexOf("/"));
   const name=row.storage_path.slice(parent.length+1);
   const {data:objects,error:listingError}=await db.storage.from(LIVE).list(parent,{search:name,limit:100});
   if(listingError||!objects?.some(x=>x.name===name))throw moved.error;
  }
  const {error:writeError}=await db.from("humkin_radio_tracks")
   .update({published_at:new Date().toISOString(),enabled:true}).eq("id",row.id);
  if(writeError)throw writeError;
  return "Supabase (R2 not configured yet)";
 }
}
async function refreshR2Status(){
 if(!activeUser)return;
 try{
  const status=await r2Bridge(db,"status");
  $("r2-storage-note").textContent=(status.configured?"R2 CREDENTIALS PRESENT":"R2 CREDENTIALS REQUIRED")+
    " · "+status.migrated_tracks+" R2 tracks · "+status.pending_tracks+
    " Supabase published · "+fmtBytes(status.supabase_storage_estimate_bytes)+
    " still stored in Supabase";
 }catch(err){$("r2-storage-note").textContent="R2 connection: "+err.message}
}
async function publish(){
 if(busy)return;
 try{await ensureSession();await loadKnown()}catch(err){feedback(err.message);return}
 const songDrafts=drafts.filter(row=>row.kind!=="bumper"&&
   (row.storage_provider!=="r2_private"||row.r2_upload_verified_at));
 if(!songDrafts.length)return;
 if(!confirm("Approve and publish all "+songDrafts.length+" SONG/SINGLE draft(s)? Single designations are retained. Bumpers require individual review."))return;
 setBusy(true);let live=0,failed=0;
 try{
   for(const row of songDrafts){
     try{
       const provider=await publishStorage(row);
       live++;log("ON AIR via "+provider+": "+row.title);
     }catch(err){failed++;log("Publication failed for "+row.title+": "+err.message)}
   }
   feedback("Published "+live+" songs to the approved catalog. "+failed+
     " need retry. Same-Time/TOWER may pick them up on refresh; the independent Cloud HOUSE HLS schedule does NOT rebuild automatically yet.");
 }finally{setBusy(false);try{await loadKnown()}catch(err){log(err.message)}}
}


async function publishOne(selectedRow){
 if(busy)return;
 try{await ensureSession();await loadKnown()}catch(err){feedback(err.message);return}
 const row=drafts.find(r=>r.id===selectedRow.id);
 if(!row)return feedback("This draft is already published or unavailable. Refresh the crate.");
 if(row.storage_provider==="r2_private"&&!row.r2_upload_verified_at)
   return feedback("This draft still needs a verified private R2 upload. Reselect the file and retry staging.");
 const isBumper=row.kind==="bumper";
 const claim=isBumper
  ?"Approve this exact bumper for public between-song rotation? Confirm content, voice rights, and any references to time, weather, or requests are appropriate. Longer spots may play in the ordinary bumper lottery."
  :"Approve this exact "+(row.is_single?"OFFICIAL SINGLE (featured at 2× base rotation)":"radio-only song")+" for public rotation? Confirm you own or have permission to air the recording.";
 if(!confirm(claim+"\n\n"+row.title))return;
 setBusy(true);
 try{
   const provider=await publishStorage(row);
   feedback("PUBLISHED TO CATALOG + ENABLED via "+provider+" · "+row.title+
     ". Browser/TOWER eligibility is updated, but Cloud HOUSE still needs a separately reviewed schedule publication. Check a real receiver for playback.");
 }catch(err){feedback("Could not publish "+row.title+": "+err.message)}
 finally{setBusy(false);try{await loadKnown()}catch(err){log("Refresh failure: "+err.message)}}
}

$("pick").addEventListener("change",e=>addFiles(e.target.files));
$("pick-folder").addEventListener("change",e=>addTowerFolder(e.target.files));
for(const field of ["folder-layout","folder-custom","fallback-artist","fallback-album"])
 $(field).addEventListener(field==="folder-layout"?"change":"input",refreshFolderRules);
$("queue-search").addEventListener("input",drawQueue);
$("queue-sort").addEventListener("change",drawQueue);
const drop=$("drop");
for(const event of ["dragenter","dragover"]){drop.addEventListener(event,e=>{e.preventDefault();drop.classList.add("over")})}
for(const event of ["dragleave","drop"]){drop.addEventListener(event,e=>{e.preventDefault();drop.classList.remove("over")})}
drop.addEventListener("drop",e=>addFiles(e.dataTransfer.files));
$("stage").addEventListener("click",stage);
$("cancel").addEventListener("click",()=>{stopRequested=true;feedback("Finishing the current file, then stopping.")});
$("clear").addEventListener("click",()=>{selected=[];$("pick").value="";$("pick-folder").value="";$("tower-note").textContent="No Tower folder selected.";drawQueue()});
$("publish").addEventListener("click",publish);
$("refresh-drafts").addEventListener("click",async()=>{try{await ensureSession();await loadKnown()}catch(e){feedback(e.message)}});
$("send-link").addEventListener("click",async()=>{
 $("auth-message").textContent="Requesting a fresh sign-in link…";
 const email=$("email").value.trim().toLowerCase();
 if(email!==OWNER){$("auth-message").textContent="Only the HUMKIN owner's verified email can publish.";return}
 $("send-link").disabled=true;
 try{
   const {error}=await db.auth.signInWithOtp({
     email,options:{emailRedirectTo:location.origin+"/fm/load/",shouldCreateUser:false}
   });
   $("auth-message").textContent=error
     ?"Email error: "+error.message
     :"New link requested. Until Supabase's localhost redirect is fixed, COPY the link address in the email (do not tap it), and paste it below.";
 }catch(error){$("auth-message").textContent="Could not request a link: "+error.message}
 finally{$("send-link").disabled=false}
});
// One-time link recovery avoids an incorrect default Supabase redirect. Never log,
// store, navigate to, or send the pasted secret anywhere except our configured Auth API.
$("verify-link").addEventListener("click",async()=>{
 const input=$("paste-link");
 const raw=input.value.trim();
 input.value=""; // Prevent leaving the one-time token in the visible DOM.
 $("auth-message").textContent="Checking your email link…";
 let token,type;
 try{
   const link=new URL(raw);
   if(link.origin!==API||link.pathname!=="/auth/v1/verify")throw Error("That is not a HUMKIN Supabase confirmation link.");
   token=link.searchParams.get("token");
   type=link.searchParams.get("type");
   if(!/^[a-fA-F0-9]{40,256}$/.test(token||"")||!["signup","magiclink","email"].includes(type))
     throw Error("The email link is incomplete. Copy its entire address from a fresh message.");
 }catch(error){$("auth-message").textContent=error.message||"Invalid email link.";return}
 $("verify-link").disabled=true;
 try{
   const {data,error}=await db.auth.verifyOtp({token_hash:token,type});
   if(error)throw error;
   if(data?.user?.email?.toLowerCase()!==OWNER){
     await db.auth.signOut();throw Error("This is not the designated HUMKIN account.");
   }
   $("auth-message").textContent="Owner verified. Crate unlocked.";
   await updateSession();
 }catch(error){
   $("auth-message").textContent="Link expired or verification failed: "+error.message+
     ". Request a NEW email and copy its link without opening it.";
 }finally{$("verify-link").disabled=false;token=null}
});
$("sign-out").addEventListener("click",async()=>{await db.auth.signOut();activeUser=null;drafts=[];known=[];drawAuth();featureDesk?.refresh();livingControl?.refresh();$("draft-list").textContent="Sign in to view drafts."});
async function updateSession(){
 const {data,error}=await db.auth.getSession();
 const user=data?.session?.user;
 activeUser=user?.email?.toLowerCase()===OWNER?user:null;
 drawAuth();
 if(user&&!activeUser)$("auth-message").textContent="This account is not the designated HUMKIN owner.";
 if(activeUser){$("auth-message").textContent="Crate unlocked.";try{await loadKnown();await refreshR2Status();await refreshDirectStatus()}catch(e){feedback("Catalog unavailable: "+e.message)}}
 else if(error)log("Authentication: "+error.message);
}
db.auth.onAuthStateChange((_event,_session)=>{setTimeout(updateSession,0)});
featureDesk=mountFeatureDesk({db,rows:()=>activeUser?known:[],onStatus:message=>log("Feature Desk: "+message)});
livingControl=mountLivingControl({db,rows:()=>activeUser?known:[],onStatus:message=>log("Living Control: "+message),onMetadataSaved:loadKnown});
mountCloudReceipt();
installProtonLogin({mount:$("proton-loader"),getClient:async()=>db,onSignedIn:updateSession});
updateSession();
