/* HUMKIN RADIO — Robot Seed Garden. RLS owner writes, public reviewed text only.
 * No audio, cloud publish, or broadcast action is possible from this editor.
 */
import {createClient} from "https://esm.sh/@supabase/supabase-js@2.57.0";
const API="https://kbhqacsdvjsstzyplqij.supabase.co";
const KEY="sb_publishable_Bv9JuOctSQTmnE3O1dP8RA_MKRNSD-o";
const OWNER="us@abundent.org",TABLE="humkin_radio_script_seeds";
const db=createClient(API,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=id=>document.getElementById(id),LEVELS=["plain","wry","strange","cosmic"];
let builtins=[],remote=[],owner=null,editing=null,busy=false;
function el(tag,value,cls){
 const node=document.createElement(tag);
 if(value!==undefined&&value!==null)node.textContent=String(value);
 if(cls)node.className=cls;
 return node;
}
const say=s=>{$("editor-status").textContent=s};
const showStatus=s=>{$("status").textContent=s};
const clean=s=>String(s||"").replace(/\s+/g," ").trim();
function slugify(s){
 const v=String(s||"").normalize("NFKD").toLowerCase()
 .replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-")
 .replace(/^-+|-+$/g,"").slice(0,60).replace(/-+$/,"");
 return v.length>2?v:"new-thought";
}
function inventory(){
 const map=new Map(builtins.map(x=>[x.slug,{...x,origin:"builtin",status:"builtin"}]));
 for(const row of remote)map.set(row.slug,{...row,origin:map.has(row.slug)?"override":"cloud"});
 return [...map.values()];
}
function slugFor(text,used){
 const base=slugify(text.split(" ").slice(0,7).join(" "));
 let slug=base,n=2;
 while(used.has(slug))slug=base.slice(0,62)+"-"+n++;
 used.add(slug);return slug;
}
function busyState(value){
 busy=value;
 for(const id of ["save-draft","approve-seed","save-bulk","retire-seed"])
  $(id).disabled=busy||!owner||(id==="retire-seed"&&editing?.status!=="approved");
}
function formData(){
 const script=clean($("script").value),level=$("level").value,
  role=$("role").value,family=slugify($("family").value).slice(0,50);
 const slug=slugify($("slug").value||script.split(" ").slice(0,7).join(" "));
 if(script.length<8||script.length>195)throw Error("A spoken line must contain 8–195 characters.");
 if(!LEVELS.includes(level)||!["station_id","character"].includes(role))
  throw Error("Choose an available humor level and department.");
 if(!/^[a-z0-9][a-z0-9-]{0,48}$/.test(family))throw Error("Invalid joke family.");
 if(!/^[a-z0-9][a-z0-9-]{1,68}[a-z0-9]$/.test(slug))throw Error("Invalid filing slug.");
 if(editing&&editing.slug!==slug)throw Error("An existing filing slug cannot change. Choose REMIX.");
 if(!editing?.id&&remote.some(r=>r.slug===slug))
  throw Error("A cloud record already uses this slug. Click EDIT on that existing card.");
 return {slug,script,level,role,family};
}
function updateCount(){
 const count=clean($("script").value).length,tag=$("script-count");
 tag.textContent=count+" / 195";tag.classList.toggle("warn",count>180);
}
function openForm(seed=null,remix=false){
 editing=remix?null:seed;
 $("script").value=seed?.script||"";
 $("level").value=seed?.level||"strange";
 $("role").value=seed?.role||"character";
 $("family").value=seed?.family||"kitchen";
 $("slug").value=remix?"":seed?.slug||"";
 $("slug").readOnly=!!editing;
 $("editing-status").value=remix?"NEW REMIX — PRIVATE":
  seed?(seed.status==="builtin"?"BUILT-IN — OWNER OVERRIDE":seed.status.toUpperCase()):"NEW UNSAVED IDEA";
 $("editor-heading").textContent=seed&&!remix?"✳ Edit this little thought":"✳ Plant a new thought";
 busyState(busy);updateCount();
 if(seed)window.scrollTo({top:$("editor").offsetTop-8,behavior:"smooth"});
}
async function ownerSession(){
 const {data,error}=await db.auth.getUser();
 owner=!error&&data?.user?.email?.toLowerCase()===OWNER?data.user:null;
 $("auth-label").textContent=owner?"OWNER UNLOCKED · PRIVATE SEED GARDEN":
  "READ-ONLY NOTEBOOK · SIGN IN AT CRATE LOADER TO EDIT";
 busyState(false);
}
async function refresh(){
 showStatus("Opening the notebooks…");
 try{
  const [local]=await Promise.all([
   fetch("./robot-seeds.json",{cache:"no-store"}).then(async r=>{
    if(!r.ok)throw Error("The built-in seed file is unavailable.");
    const v=await r.json();
    if(v.schema!=="humkin.radio.robot-seeds/v1"||!Array.isArray(v.seeds))throw Error("Unknown seed file format");
    return v.seeds;
   }),ownerSession()
  ]);
  builtins=local;
  const fields=owner?"id,owner_id,slug,script,level,family,role,status,updated_at":
   "slug,script,level,family,role,status,updated_at";
  const {data,error}=await db.from(TABLE).select(fields).order("updated_at",{ascending:false}).limit(500);
  if(error)throw error;
  remote=data||[];
  const families=[...new Set(inventory().map(x=>x.family))].sort();
  $("families").replaceChildren(...families.map(f=>{
   const opt=el("option");opt.value=f;return opt;
  }));
  render();
  showStatus(owner?"Owner unlocked. Drafts stay private; approved words enter later audition batches.":
   "Read-only. Sign in through Crate Loader to add or edit scripts.");
 }catch(err){
  if(!builtins.length){
   try{const r=await fetch("./robot-seeds.json");builtins=(await r.json()).seeds||[]}catch{}
  }
  remote=[];render();
  showStatus("Online seed ledger unavailable: "+(err.message||err)+". No scripts were changed.");
 }
}
function render(){
 const rows=inventory(),query=$("search").value.trim().toLowerCase(),
  level=$("filter-level").value,filter=$("filter-status").value;
 const subset=rows.filter(r=>(level==="all"||r.level===level)&&
  (filter==="all"||r.status===filter||filter==="builtin"&&r.origin==="builtin")&&
  (!query||[r.script,r.slug,r.family,r.role].join(" ").toLowerCase().includes(query)));
 $("countline").textContent=rows.length+" visible seeds · "+builtins.length+" built-ins · "+
  rows.filter(x=>x.status==="approved").length+" owner-approved · "+
  rows.filter(x=>x.status==="draft").length+" private drafts · "+
  rows.filter(x=>x.status==="retired").length+" retired";
 const list=$("seed-list");list.replaceChildren();
 for(const r of subset){
  const card=el("article",null,"seed"),badges=el("div",null,"badges");
  for(const [label,cls] of [[r.level.toUpperCase(),r.level],
   [r.origin==="override"?"OWNER REVISION":r.origin==="cloud"?"OWNER SEED":"ORIGINAL",""],
   [r.status.toUpperCase(),""]])badges.append(el("span",label,"badge "+cls));
  const line=el("p",r.script),meta=el("small",r.family+" · "+r.role.replaceAll("_"," ")+" · "+r.slug,"muted");
  const actions=el("div",null,"row");
  const edit=el("button","EDIT","primary");edit.type="button";edit.disabled=!owner;
  edit.addEventListener("click",()=>openForm(r));
  const remix=el("button","REMIX","secondary");remix.type="button";remix.disabled=!owner;
  remix.addEventListener("click",()=>openForm(r,true));
  const play=el("button","▶ ROUGH VOICE","secondary");play.type="button";
  play.addEventListener("click",()=>playRough(r.script));
  actions.append(edit,remix,play);card.append(badges,line,meta,actions);list.append(card);
 }
 if(!subset.length)list.append(el("p","No matching seeds. Try another filter."));
}
function playRough(text){
 if(!("speechSynthesis" in window)){
  say("Browser speech preview is unavailable. Use the offline audition pack.");return;
 }
 const voice=new SpeechSynthesisUtterance(text);voice.lang="en-US";voice.rate=.92;voice.pitch=.8;
 window.speechSynthesis.cancel();window.speechSynthesis.speak(voice);
 say("This is your device voice, not the final eSpeak, Flite or Festival MP3.");
}
async function saveSeed(state){
 if(busy||!owner)return say("Sign in as the owner to make changes.");
 let fields;try{fields=formData()}catch(err){return say(err.message)}
 if(state==="draft"&&editing?.status==="approved"&&
  !confirm("This pauses an approved text seed in future generation until reapproved. Existing audio is unchanged. Save as private draft?"))return;
 if(state==="approved"&&!confirm(
  "Approve this exact text for FUTURE PRIVATE ROBOT AUDITIONS? It will not be broadcast or produce immediate audio.\n\n"+fields.script))return;
 busyState(true);say("Saving "+state+"…");
 try{
  const row={...fields,status:state,updated_at:new Date().toISOString()};
  const response=editing?.id?
   await db.from(TABLE).update(row).eq("id",editing.id).eq("owner_id",owner.id).select("id").single():
   await db.from(TABLE).insert({...row,owner_id:owner.id}).select("id").single();
  if(response.error)throw response.error;
  await refresh();
  const saved=remote.find(x=>x.id===response.data.id);
  if(saved)openForm(saved);
  say(state==="approved"?"SEED TEXT APPROVED. It may appear in the next private robot batch. Nothing went on air.":
   "PRIVATE DRAFT SAVED. It is not available to the robot yet.");
 }catch(err){say("Save failed: "+(err.message||err))}
 finally{busyState(false)}
}
async function retire(){
 if(!owner||busy||editing?.status!=="approved"||!editing.id)return;
 if(!confirm("Retire this approved script from FUTURE robot batches? Built-in lines with the same slug will also be suppressed; existing MP3s remain unchanged."))return;
 busyState(true);
 try{
  const {data,error}=await db.from(TABLE).update({
   status:"retired",updated_at:new Date().toISOString()
  }).eq("id",editing.id).eq("owner_id",owner.id).select("id").single();
  if(error)throw error;
  await refresh();openForm(remote.find(x=>x.id===data.id)||null);
  say("RETIRED. This script slug is excluded from future batches, but not deleted from existing recordings.");
 }catch(err){say("Retirement failed: "+err.message)}
 finally{busyState(false)}
}
async function bulk(){
 if(!owner||busy)return;
 const lines=$("bulk-script").value.split(/\r?\n/).map(clean).filter(Boolean);
 if(!lines.length)return say("Paste at least one line to plant.");
 if(lines.length>20)return say("Limit each batch to 20 lines.");
 if(lines.some(x=>x.length<8||x.length>195))return say("Each line must be 8–195 characters.");
 const level=$("level").value,role=$("role").value,family=slugify($("family").value).slice(0,50);
 if(!LEVELS.includes(level)||!["station_id","character"].includes(role))return say("Check level and department.");
 const used=new Set(inventory().map(x=>x.slug));
 const rows=lines.map(script=>({owner_id:owner.id,slug:slugFor(script,used),
  script,level,role,family,status:"draft"}));
 busyState(true);say("Planting "+rows.length+" drafts…");
 try{
  const {data,error}=await db.from(TABLE).insert(rows).select("id");
  if(error)throw error;
  $("bulk-script").value="";await refresh();
  say(data.length+" drafts saved privately. No seeds were approved or aired.");
 }catch(err){say("Batch failed: "+err.message)}
 finally{busyState(false)}
}
function backup(){
 const rows=inventory().map(({id,slug,script,level,family,role,status,origin,updated_at})=>
  ({id,slug,script,level,family,role,status,origin,updated_at}));
 const data={schema:"humkin.radio.seed-backup/v1",exported_at:new Date().toISOString(),seeds:rows};
 const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
 const a=document.createElement("a");a.href=url;a.download="humkin-robot-script-seeds.json";
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2500);
}
$("script").addEventListener("input",updateCount);
$("rough-play").addEventListener("click",()=>playRough(clean($("script").value)));
$("save-draft").addEventListener("click",()=>saveSeed("draft"));
$("approve-seed").addEventListener("click",()=>saveSeed("approved"));
$("retire-seed").addEventListener("click",retire);
$("fresh").addEventListener("click",()=>openForm());
$("save-bulk").addEventListener("click",bulk);
$("refresh").addEventListener("click",refresh);
$("auth-retry").addEventListener("click",refresh);
$("export").addEventListener("click",backup);
for(const id of ["search","filter-level","filter-status"])
 $(id).addEventListener(id==="search"?"input":"change",render);
openForm();
refresh();
