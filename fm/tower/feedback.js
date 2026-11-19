import {danceContenders,MIN_MOVE_CONTENDER} from "../top42/feedback-signals.mjs";
import {chicagoMonth,monthlyCouncil,vinylNominationPacket,
 SNAPSHOT_SCHEMA} from "../top42/vinyl-council.mjs";

const API="https://kbhqacsdvjsstzyplqij.supabase.co";
const PUBLIC_KEY="sb_publishable_Bv9JuOctSQTmnE3O1dP8RA_MKRNSD-o";
const $=id=>document.getElementById(id);
let council=null,snapshot=null;
$("month").value=chicagoMonth();
function status(id,text){$(id).textContent=text}
function p(parent,content,cls=""){
 const el=document.createElement("p");el.textContent=content;if(cls)el.className=cls;
 parent.append(el);return el;
}
function downloadable(filename,value){
 const blob=new Blob([JSON.stringify(value,null,2)+"\n"],{type:"application/json"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function publicJSON(url){
 const response=await fetch(url,{cache:"no-store"});
 if(!response.ok)throw Error("Public listening data unavailable ("+response.status+")");
 return response.json();
}
async function refreshDance(){
 status("weather-status","Checking self-reported signals…");
 const list=$("dance-list");list.replaceChildren();
 try{
  const [league,weather]=await Promise.all([
   publicJSON(API+"/functions/v1/humkin-league"),
   publicJSON(API+"/functions/v1/humkin-resonance")
  ]);
  if(league.schema!=="humkin.top42/v1"||!Array.isArray(league.catalog))
   throw Error("Top 42 catalog has an unknown format.");
  const threshold=Number($("threshold").value);
  const result=danceContenders(league.catalog,weather,new Date(),threshold);
  if(result.status!=="PROVISIONAL")
   throw Error("Incomplete or outdated Listener Weather — contenders held.");
  for(const item of result.contenders){
   const li=document.createElement("li");
   li.append(document.createTextNode(item.title+" · "+item.artist+" · "));
   const n=document.createElement("strong");n.className="metric";
   n.textContent=item.move_count+" MADE ME MOVE";
   li.append(n);list.append(li);
  }
  if(!result.contenders.length)
   p(list,"No recordings have crossed the "+threshold+"-response threshold yet.","minor");
  status("weather-status",result.week_start+" · "+result.contenders.length+
   " provisional contenders. This does not change Top 42 points.");
 }catch(e){status("weather-status",e.message||"Contender board unavailable.");}
}
function drawLane(kind){
 const list=$(kind+"-list");list.replaceChildren();
 const rows=council?.[kind]?.nominees||[];
 if(!rows.length){p(list,"No eligible listener-built records in this snapshot.","minor");return}
 for(const [index,item] of rows.slice(0,12).entries()){
  const li=document.createElement("li");
  const header=document.createElement("strong");
  header.textContent=(index+1)+". "+item.title+" · "+item.curator;
  li.append(header);
  p(li,"Score "+item.score.toFixed(2)+" / 100 · "+
    item.evidence.radio+" RADIO + "+item.evidence.playlist+
    " PLAYLIST listens · "+item.evidence.feeling+
    " capped emotion signals · "+item.evidence.verified_events+
    " reviewed event credits","metric");
  list.append(li);
 }
}
function render(){
 drawLane("lp");drawLane("ep");
 for(const kind of ["lp","ep"])
  $(kind+"-export").disabled=!council?.[kind]?.leader;
 if(!council)return;
 const state=council.state==="NOMINATION_SLATE_REVIEW_REQUIRED"?
   "Evidence-backed slate pending human admission":"Provisional incomplete monthly snapshot";
 status("monthly-status",council.month+" · "+state+
  " · physical manufacture HOLD · no automatic LP/EP winner announcement.");
}
function loadMonth(data){
 if(data?.schema==="humkin.monthly-council-owner/v1"&&data.snapshot){
  snapshot=data.snapshot;
 }else if(data?.schema===SNAPSHOT_SCHEMA){snapshot=data}
 else throw Error("Not a HUMKIN monthly evidence snapshot.");
 council=monthlyCouncil(snapshot);
 render();
}
$("refresh").addEventListener("click",refreshDance);
$("threshold").addEventListener("change",refreshDance);
$("month-file").addEventListener("change",async()=>{
 const file=$("month-file").files?.[0];if(!file)return;
 if(file.size>15*1024*1024)
  return status("monthly-status","File exceeds 15 MiB; use a bounded monthly snapshot.");
 try{loadMonth(JSON.parse(await file.text()))}
 catch(e){snapshot=null;council=null;render();status("monthly-status",e.message)}
});
$("owner-month").addEventListener("click",async()=>{
 status("monthly-status","Checking owner authorization and monthly source…");
 try{
  const {createClient}=await import("https://esm.sh/@supabase/supabase-js@2.57.0");
  const db=createClient(API,PUBLIC_KEY,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  const {data,error}=await db.auth.getSession();
  if(error||!data?.session?.access_token)
   throw Error("Owner session unavailable. Sign into the existing crate loader first.");
  const month=$("month").value||chicagoMonth();
  const response=await fetch(API+"/functions/v1/humkin-monthly-council?month="+
    encodeURIComponent(month),{cache:"no-store",
    headers:{Authorization:"Bearer "+data.session.access_token,apikey:PUBLIC_KEY}});
  if(!response.ok)throw Error("Monthly source not deployed or unauthorized (HTTP "+
    response.status+"). Open a local snapshot instead.");
  loadMonth(await response.json());
 }catch(e){status("monthly-status",e.message||"Monthly source unavailable.")}
});
for(const kind of ["lp","ep"])$(kind+"-export").addEventListener("click",()=>{
 if(!council||!snapshot)return;
 const packet=vinylNominationPacket(council,kind,snapshot.catalog);
 if(!packet)return;
 downloadable("humkin-"+council.month+"-"+kind+"-vinyl-HOLD.json",packet);
 status("monthly-status","Candidate HOLD packet exported. No media copied, money spent or records pressed.");
});
render();refreshDance();
