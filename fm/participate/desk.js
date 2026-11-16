import {createClient} from "https://esm.sh/@supabase/supabase-js@2.57.0";
const PROJECT="https://kbhqacsdvjsstzyplqij.supabase.co";
const PUBLISHABLE="sb_publishable_Bv9JuOctSQTmnE3O1dP8RA_MKRNSD-o";
const ENDPOINT=PROJECT+"/functions/v1/humkin-participation";
const BUCKET="humkin-contribution-inbox";
const db=createClient(PROJECT,PUBLISHABLE,{auth:{persistSession:false,autoRefreshToken:false}});
const $=id=>document.getElementById(id);
const text=(tag,value,cls)=>{const e=document.createElement(tag);e.textContent=String(value);if(cls)e.className=cls;return e};
const store=(()=>{try{return localStorage}catch{return {getItem:()=>null,setItem:()=>{}}}})();
const PASS="humkin-participation-pass-v1",HANDLE="humkin-participation-handle-v1";
function pass(){
 let key=store.getItem(PASS)||"";
 if(!/^[0-9a-f-]{36}$/i.test(key)){
  key=crypto.randomUUID();store.setItem(PASS,key);
 }
 return key;
}
let listener=pass();
let active="",missions=[],sending=false,photoObject=null;
function localLevel(){
 try{
  const model=window.HumkinOrchard;
  return model?model.level(model.read(store).xp):1;
 }catch{return 1}
}
async function api(path="",body=null,token=""){
 const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),25000);
 try{
  const res=await fetch(ENDPOINT+path,{
   method:body?"POST":"GET",cache:"no-store",signal:ctrl.signal,
   headers:{"Accept":"application/json",...(body?{"Content-Type":"application/json"}:{}),
     ...(token?{"Authorization":"Bearer "+token}:{})},
   ...(body?{body:JSON.stringify({...body,listener})}:{})
  });
  const value=await res.json();
  if(!res.ok||value.error)throw Error(value.error||"Station returned "+res.status);
  return value;
 }finally{clearTimeout(timeout)}
}
function status(message,ok){
 const e=$("send-status");e.textContent=message;e.className="feedback "+(ok===true?"ok":ok===false?"error":"");
}
function savedHandle(){try{return store.getItem(HANDLE)||""}catch{return ""}}
function missionCard(mission){
 const e=text("article","","mission-card");
 const badge=text("div","","overline"),unlocked=localLevel()>=mission.level;
 badge.append(text("span",mission.guild),text("span",unlocked?"✳ UNLOCKED":"LVL "+mission.level+" TREE","level-pill"));
 e.append(badge,text("h3",mission.title),text("p",mission.notes),text("div",mission.reward,"reward"));
 const button=text("button",unlocked?"✳ OPEN MY GUILD WORKBENCH":"OPEN THE GUEST SUBMISSION DOOR");
 button.type="button";button.addEventListener("click",()=>openMission(mission.id));
 e.append(button);return e;
}
async function loadMissions(){
 try{
  const r=await api("?mode=missions");
  if(r.schema!=="humkin.participation.v1"||!Array.isArray(r.missions))throw Error("Unknown mission board");
  missions=r.missions;
  const e=$("mission-grid");e.replaceChildren();
  for(const m of missions)e.append(missionCard(m));
  $("local-level").textContent=String(localLevel()).padStart(2,"0");
 }catch(err){$("mission-grid").textContent="Mission board unavailable: "+err.message}
}
function openMission(kind){
 const m=missions.find(x=>x.id===kind);
 if(!m)return;
 active=kind;
 $("workbench").hidden=false;
 $("mission-kind").value=kind;
 $("work-title").textContent=m.title;
 $("work-guild").textContent=m.guild+" / SUBMISSION DESK";
 $("mission-guidance").textContent=m.notes;
 const social=kind==="street",audio=["bumper","song","segment"].includes(kind);
 const recorded=audio||kind==="video";
 $("social-fields").hidden=!social;
 $("duration-fields").hidden=!recorded;
 $("media-fields").hidden=!recorded;
 $("link-fields").hidden=kind==="script"||kind==="server";
 $("disclosure-row").hidden=!social;
 $("rights-row").hidden=kind==="server";
 $("social-platform").value="none";
 $("social-handle").value=savedHandle();
 $("work-name").value="";
 $("work-details").value="";
 $("work-duration").value="";
 $("work-link").value="";
 $("work-file").value="";
 $("work-disclosure").checked=false;
 $("work-rights").checked=false;
 $("link-label").textContent=social?"PUBLIC LINK TO YOUR ORIGINAL DISCLOSED POST":
  "PUBLIC LINK TO RECORDING (OPTIONAL IF UPLOADING)";
 $("details-label").textContent=kind==="script"?"WRITE THE ORIGINAL SCRIPT (30–500 CHARACTERS)":
  kind==="server"?"DESCRIBE AN UNUSED COMPUTER YOU OWN OR HAVE PERMISSION TO OPERATE":"A SHORT NOTE FOR THE STATION";
 $("work-details").placeholder=kind==="server"?
  "Device model, OS, RAM, network, ownership/permission, electricity/data limits, and what jobs you could volunteer for…":
  kind==="script"?"The station would like to make an announcement…":
  "What did you make? Which song? Any broadcast or licensing restrictions?";
 $("work-file").accept=kind==="video"?"video/mp4,video/webm,.mp4,.webm":
  "audio/mpeg,audio/mp4,audio/wav,.mp3,.m4a,.wav";
 status("Nothing will be posted or broadcast automatically. Submission enters a private human review queue.");
 $("workbench").scrollIntoView({behavior:"smooth",block:"start"});
}
$("close-form").addEventListener("click",()=>{$("workbench").hidden=true;active=""});
$("work-file").addEventListener("change",async()=>{
 const file=$("work-file").files?.[0];
 if(!file)return;
 if(file.size>26214400){status("That file exceeds the 25 MB private-inbox limit. Use a public video link instead.",false);return}
 const tag=file.type.startsWith("video/")?"video":"audio";
 const media=document.createElement(tag);media.preload="metadata";
 const link=URL.createObjectURL(file);
 try{
  const length=await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error("Metadata timed out")),7000);
   media.onloadedmetadata=()=>{clearTimeout(timer);resolve(media.duration)};
   media.onerror=()=>{clearTimeout(timer);reject(Error("Can't read media duration"))};
   media.src=link;
  });
  if(Number.isFinite(length)&&length>0&&length<3601){
   $("work-duration").value=Math.floor(length);
   status("Detected "+Math.floor(length)+" seconds. Review the duration before submitting.");
  }
 }catch{status("Enter the recording duration manually. The station will inspect the file during review.")}
 finally{URL.revokeObjectURL(link);media.removeAttribute("src");media.load()}
});
function fileOptions(file,kind){
 if(!file)return null;
 const ext=(file.name.split(".").pop()||"").toLowerCase();
 const defaultMime={"mp4":"video/mp4","webm":"video/webm",
  "mp3":"audio/mpeg","m4a":"audio/mp4","wav":"audio/wav"};
 const mime=defaultMime[ext];
 if(!mime)throw Error("Unsupported file extension. Use MP4, WebM, MP3, M4A, or WAV.");
 if(file.type&&file.type!=="audio/mp3"&&file.type!==mime)
  throw Error("File type and extension disagree. Export a standard audio or video file.");
 if(file.size>26214400||file.size<1024)
  throw Error("Choose a file between 1 KB and 25 MB.");
 if(kind==="video"&&!mime.startsWith("video/"))throw Error("The Picture Department needs an MP4 or WebM video");
 if(kind!=="video"&&!mime.startsWith("audio/"))throw Error("This department needs an audio file");
 return {ext,mime,size:file.size};
}
async function send(event){
 event.preventDefault();
 if(!active||sending)return;
 const file=$("work-file").files?.[0]||null;
 let media=null;
 try{media=fileOptions(file,active)}catch(error){status(error.message,false);return}
 const name=$("work-name").value.trim(),details=$("work-details").value.trim();
 const platform=$("social-platform").value,handle=$("social-handle").value.trim();
 const link=$("work-link").value.trim(),duration=Number($("work-duration").value||0);
 const mission=active;
 if(mission==="street"&&$("remember-handle").checked)store.setItem(HANDLE,handle);
 const body={action:"submit",kind:mission,title:name,details,
  platform:mission==="street"?platform:"none",
  handle:mission==="street"?handle:"",
  reference_url:link,duration,rights_confirmed:mission==="server"?false:$("work-rights").checked,
  disclosure_confirmed:mission==="street"?$("work-disclosure").checked:false,file:media};
 sending=true;$("send-work").disabled=true;
 status("Filing the work order with the station…");
 try{
  const result=await api("",body);
  if(!result.accepted||!result.id)throw Error("The desk didn't issue a receipt");
  if(result.upload){
   status("Work order filed. Transferring the file to the private station inbox…");
   const {error}=await db.storage.from(BUCKET)
    .uploadToSignedUrl(result.upload.path,result.upload.token,file,{contentType:media.mime});
   if(error)throw Error("Work order saved, but the upload failed: "+error.message+
     ". Your receipt is "+result.id+". Please use a public link in a new submission if this persists.");
   status("File received. Verifying its size and entering the review queue…");
   await api("",{action:"finalize",id:result.id});
  }
  status("✳ WORK ORDER RECEIVED · "+result.id+" · "+result.potential_hum+
   " potential HUM pending human review. Nothing aired or paid automatically.",true);
  $("submission-form").reset();
  if(mission==="street")$("social-handle").value=savedHandle();
  await loadReceipts();
 }catch(error){status(error.message||"Transmission failed",false)}
 finally{sending=false;$("send-work").disabled=false}
}
$("submission-form").addEventListener("submit",send);
async function loadReceipts(){
 try{
  const result=await api("?mode=mine&listener="+encodeURIComponent(listener));
  if(result.schema!=="humkin.participation.v1")throw Error("Unknown receipt format");
  $("earned-hum").textContent=Number(result.verified_hum||0).toLocaleString()+" ⓗ";
  $("pending-hum").textContent=Number(result.pending_hum||0).toLocaleString()+" ⓗ";
  $("submission-count").textContent=(result.submissions||[]).length;
  const board=$("my-work");board.replaceChildren();
  if(!result.submissions.length){
   board.append(text("p","No work orders yet. The station is accepting applications from imagination."));return;
  }
  for(const r of result.submissions){
   const box=text("div","","receipt"),left=text("div");
   left.append(text("strong",r.title),text("small",r.kind.toUpperCase()+" · "+
      new Date(r.created_at).toLocaleDateString()+" · "+r.id.slice(0,8)));
   if(r.review_note)left.append(text("small","STATION REVIEW: "+r.review_note));
   box.append(left,text("span",r.state==="accepted"?"+"+r.potential_hum+" VERIFIED HUM":
      r.state==="pending_review"?"AWAITING REVIEW":
      r.state==="awaiting_upload"?"UPLOAD INCOMPLETE":
      r.state.toUpperCase(),"state "+(r.state==="pending_review"?"waiting":r.state==="declined"?"no":"")));
   if(["pending_review","awaiting_upload"].includes(r.state)){
     const remove=text("button","WITHDRAW");
     remove.type="button";
     remove.addEventListener("click",async()=>{
      if(!confirm("Withdraw this submission and delete its uploaded file, if any?"))return;
      try{await api("",{action:"withdraw",id:r.id});await loadReceipts()}
      catch(e){alert(e.message)}
     });
     box.append(remove);
   }
   board.append(box);
  }
 }catch(error){$("my-work").textContent="Couldn't load your private work orders: "+error.message}
}
$("refresh").addEventListener("click",loadReceipts);
$("backup-pass").addEventListener("click",()=>{
 const data={schema:"humkin.participation.pass/v1",listener,
  warning:"Private bearer pass: anyone who gets this file can read your station work history."};
 const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
 const a=document.createElement("a");a.href=url;a.download="humkin-participation-pass.json";a.click();
 setTimeout(()=>URL.revokeObjectURL(url),2000);
});
$("restore-pass").addEventListener("change",async event=>{
 const file=event.target.files?.[0];event.target.value="";
 if(!file)return;
 if(file.size>3000){alert("That isn't a small participation-pass file.");return}
 try{
  const value=JSON.parse(await file.text());
  if(value.schema!=="humkin.participation.pass/v1"||
      !/^[0-9a-f-]{36}$/i.test(value.listener))throw Error("Unrecognized participation pass");
  if(!confirm("Restore this pass? Your current pass and its on-device identity will be replaced."))return;
  listener=value.listener;store.setItem(PASS,listener);await loadReceipts();
 }catch(e){alert(e.message)}
});
loadMissions();loadReceipts();
