import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import * as tus from "https://esm.sh/tus-js-client@4.3.1";

const API = "https://kbhqacsdvjsstzyplqij.supabase.co";
const KEY = "sb_publishable_Bv9JuOctSQTmnE3O1dP8RA_MKRNSD-o"; // Public, RLS-scoped key. Never a secret/service key.
const INBOX = "humkin-radio-inbox", LIVE = "humkin-radio-live";
const OWNER = "us@abundent.org", BUDGET = 700 * 1024 * 1024;
const MAX_FILE = 50 * 1024 * 1024;
const db = createClient(API, KEY, {auth: {persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $ = id => document.getElementById(id);
let selected = [], busy = false, stopRequested = false, drafts = [], known = [], activeUser = null;
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
function titleFromName(name){
 return name.replace(/\.(mp3|wav)$/i,"").replace(/^\d{1,3}[\s._-]+/,"")
   .replace(/[_]+/g," ").replace(/\s+/g," ").trim().slice(0,240) || "Untitled song";
}
function drawQueue(){
 $("queue").replaceChildren();
 let knownSeconds=0, pending=0;
 for(const item of selected){
   if(item.duration) knownSeconds += item.duration; else pending++;
   const li=document.createElement("li"),name=document.createElement("span"),status=document.createElement("span");
   name.textContent=item.file.name+" · "+fmtBytes(item.file.size)+(item.duration?" · "+fmtTime(item.duration):"");
   status.className="state";status.textContent=item.status;li.append(name,status);$("queue").append(li);
 }
 $("selection").textContent=selected.length+" files selected; "+pending+" durations still being scanned.";
 $("selected-time").textContent=fmtTime(knownSeconds)+" total duration detected.";
 $("stage").disabled=busy||!selected.length||!activeUser;
 $("cancel").disabled=!busy;
 $("clear").disabled=busy;
}
function drawAuth(){
 $("signed-out").classList.toggle("hidden",!!activeUser);
 $("signed-in").classList.toggle("hidden",!activeUser);
 $("signed-label").textContent=activeUser?"Connected: "+activeUser.email:"";
 drawQueue();
 $("publish").disabled=busy||!activeUser||!drafts.length;
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
async function addFiles(files){
 const existing=new Set(selected.map(x=>[x.file.name,x.file.size,x.file.lastModified].join("|")));
 for(const file of files){
   if(!isMp3(file)&&!isWav(file))continue;
   const key=[file.name,file.size,file.lastModified].join("|");
   if(existing.has(key))continue;existing.add(key);
   selected.push({file,status:"READY",duration:0});
 }
 drawQueue();
 for(const item of selected){
   if(item.status!=="READY"||item.duration)continue;
   try {item.duration=await getDuration(item.file)}
   catch(err){item.status="NEEDS CHECK";log(item.file.name+": "+err.message)}
   drawQueue();
 }
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
   const result=new File(out,item.file.name.replace(/\.wav$/i,".mp3"),{type:"audio/mpeg"});
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
   .select("id,sha256,storage_path,title,bytes,duration_seconds,published_at")
   .order("created_at",{ascending:false}).limit(2000);
 if(error)throw error;
 known=data||[];
 drafts=known.filter(x=>!x.published_at);
 $("draft-list").replaceChildren();
 if(!drafts.length){
   const li=document.createElement("li");li.textContent="Nothing staged. Choose a batch above."; $("draft-list").append(li);
 }else for(const row of drafts){
   const li=document.createElement("li");
   li.textContent=row.title+" · "+fmtTime(row.duration_seconds)+" · "+fmtBytes(row.bytes);
   $("draft-list").append(li);
 }
 const used=known.reduce((s,r)=>s+(r.bytes||0),0);
 const secs=known.filter(x=>x.published_at).reduce((s,r)=>s+Number(r.duration_seconds||0),0);
 $("stats").textContent=known.filter(x=>x.published_at).length+" cloud songs on air · "+drafts.length+" private drafts · "+fmtBytes(used)+" uploaded";
 $("total").textContent=fmtTime(secs)+" new cloud airtime";
 $("publish").disabled=busy||!drafts.length;
}
async function stage(){
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
       const mp3=isWav(item.file)?await convertWav(item):item.file;
       if(mp3.size>MAX_FILE)throw Error("MP3 larger than 50 MiB; use desktop converter at 128 kbps.");
       if(!(item.duration>0&&item.duration<14400))throw Error("Cannot determine track duration.");
       const sha=await digest(mp3);
       if(known.some(x=>x.sha256===sha)){
         skipped++;item.status="DUPLICATE";drawQueue();continue;
       }
       const used=known.reduce((s,x)=>s+(x.bytes||0),0);
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
         title:titleFromName(item.file.name),artist:"HUMKIN",album:"HUMKIN RADIO · INBOX",
         duration_seconds:item.duration,bytes:mp3.size};
       const {data,error}=await db.from("humkin_radio_tracks").insert(record).select("id,sha256,storage_path,title,bytes,duration_seconds,published_at").single();
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
async function publish(){
 if(busy)return;
 try{await ensureSession();await loadKnown()}catch(err){feedback(err.message);return}
 if(!drafts.length)return;
 if(!confirm("Make "+drafts.length+" staged track(s) PUBLIC and add them to HUMKIN RADIO?"))return;
 setBusy(true);let live=0,failed=0;
 try{
   for(const row of [...drafts]){
     try{
       const result=await db.storage.from(INBOX).move(row.storage_path,row.storage_path,{destinationBucket:LIVE});
       if(result.error){
         // If a previous attempt moved the object but failed to update the row,
         // the live object might already exist. Confirm before updating metadata.
         const parent=row.storage_path.slice(0,row.storage_path.lastIndexOf("/"));
         const name=row.storage_path.slice(parent.length+1);
         const {data:objects,error:listingError}=await db.storage.from(LIVE).list(parent,{search:name,limit:100});
         if(listingError||!objects?.some(x=>x.name===name))throw result.error;
       }
       const {error}=await db.from("humkin_radio_tracks").update({published_at:new Date().toISOString()}).eq("id",row.id);
       if(error)throw error;
       live++;log("ON AIR: "+row.title);
     }catch(err){failed++;log("Publication failed for "+row.title+": "+err.message)}
   }
   feedback("Published "+live+" songs. "+failed+" need retry. Reload the station to hear the new crate.");
 }finally{setBusy(false);try{await loadKnown()}catch(err){log(err.message)}}
}

$("pick").addEventListener("change",e=>addFiles(e.target.files));
const drop=$("drop");
for(const event of ["dragenter","dragover"]){drop.addEventListener(event,e=>{e.preventDefault();drop.classList.add("over")})}
for(const event of ["dragleave","drop"]){drop.addEventListener(event,e=>{e.preventDefault();drop.classList.remove("over")})}
drop.addEventListener("drop",e=>addFiles(e.dataTransfer.files));
$("stage").addEventListener("click",stage);
$("cancel").addEventListener("click",()=>{stopRequested=true;feedback("Finishing the current file, then stopping.")});
$("clear").addEventListener("click",()=>{selected=[];$("pick").value="";drawQueue()});
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
$("sign-out").addEventListener("click",async()=>{await db.auth.signOut();activeUser=null;drafts=[];known=[];drawAuth();$("draft-list").textContent="Sign in to view drafts."});
async function updateSession(){
 const {data,error}=await db.auth.getSession();
 const user=data?.session?.user;
 activeUser=user?.email?.toLowerCase()===OWNER?user:null;
 drawAuth();
 if(user&&!activeUser)$("auth-message").textContent="This account is not the designated HUMKIN owner.";
 if(activeUser){$("auth-message").textContent="Crate unlocked.";try{await loadKnown()}catch(e){feedback("Catalog unavailable: "+e.message)}}
 else if(error)log("Authentication: "+error.message);
}
db.auth.onAuthStateChange((_event,_session)=>{setTimeout(updateSession,0)});
updateSession();
