import {createClient} from "https://esm.sh/@supabase/supabase-js@2.57.0";
const API="https://kbhqacsdvjsstzyplqij.supabase.co";
const KEY="sb_publishable_Bv9JuOctSQTmnE3O1dP8RA_MKRNSD-o";
const ENDPOINT=API+"/functions/v1/humkin-mesh";
const OWNER="us@abundent.org";
const db=createClient(API,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=id=>document.getElementById(id);
let inventory=null,status=null,stopRequested=false,working=false,session=null;
const bytes=n=>{
 if(!Number.isFinite(Number(n)))return "unknown bytes";
 let number=Number(n);
 for(const unit of ["bytes","KiB","MiB","GiB","TiB"]){
  if(number<1024||unit==="TiB")return number.toFixed(unit==="bytes"?0:2)+" "+unit;
  number/=1024;
 }
};
function line(msg){
 $("log").textContent=new Date().toLocaleTimeString()+" · "+msg+"\n"+$("log").textContent.slice(0,8000);
}
function li(parent,label){
 const element=document.createElement("li");element.textContent=label;parent.append(element);
}
function setWork(value){
 working=value;
 $("ingest").disabled=value||!inventory||!session;
 $("sync-radio").disabled=value||!session;
 $("refresh").disabled=value;
 $("stop").disabled=!value;
 updateLinkButtons();
}
async function signedIn(){
 const {data,error}=await db.auth.getSession();
 if(error||!data.session||data.session.user?.email?.toLowerCase()!==OWNER){
  session=null;
  $("auth").textContent="LOCKED · Sign in using the Crate Loader, then return here.";
  if(!working)setWork(false);return null;
 }
 session=data.session;
 $("auth").textContent="UNLOCKED · "+session.user.email+" · metadata-only private registry";
 if(!working)setWork(false);return session;
}
async function call(action,data={},publicAccess=false){
 const current=publicAccess?null:await signedIn();
 if(!publicAccess&&!current)throw Error("Sign in through the Crate Loader first.");
 const headers={"Content-Type":"application/json",apikey:KEY};
 if(current)headers.authorization="Bearer "+current.access_token;
 const response=await fetch(ENDPOINT,{method:"POST",headers,body:JSON.stringify({action,...data}),cache:"no-store"});
 let result;try{result=await response.json()}catch{throw Error("MESH API returned an invalid response.")}
 if(!response.ok||result.ok!==true)throw Error(result.error||"MESH server error");
 return result;
}
function renderStatus(data){
 status=data;
 $("count-objects").textContent=Number(data.file_count||0).toLocaleString();
 $("count-copies").textContent=Number(data.copy_count||0).toLocaleString();
 $("count-nodes").textContent=Number(data.node_count||0).toLocaleString();
 $("bytes").textContent=bytes(data.unique_bytes)+" in indexed unique file hashes"+
   (data.byte_count_partial?" (partial sum; registry is larger than one report)":"")+
   " · physical copies are not all currently online.";
 $("nodes").replaceChildren();
 if(!data.nodes?.length)li($("nodes"),"No nodes yet. Index the approved R2 catalog or import a local manifest.");
 for(const node of data.nodes||[]){
  li($("nodes"),node.label+" · "+(node.kind==="cloud"?"cloud":"local")+
    " · last observed "+(node.last_seen?new Date(node.last_seen).toLocaleString():"never"));
 }
 $("links").replaceChildren();
 if(!data.links?.length)li($("links"),"No public references yet.");
 for(const link of data.links||[]){
  const el=document.createElement("li");
  const label=document.createElement("span");
  label.textContent=link.slug+" · "+link.title+" · "+link.state+" ";
  const anchor=document.createElement("a");
  anchor.href="../../m/?id="+encodeURIComponent(link.slug);
  anchor.textContent="OPEN STABLE ADDRESS";anchor.target="_blank";anchor.rel="noopener noreferrer";
  const choose=document.createElement("button");choose.type="button";choose.textContent="EDIT";
  choose.addEventListener("click",()=>{
   $("slug").value=link.slug;$("link-title").value=link.title;
   $("track").value=link.target_track_id;updateLinkButtons();
   $("link-result").textContent="Existing reference selected; reason is required to change it.";
  });
  el.append(label,anchor,choose);$("links").append(el);
 }
 $("track").replaceChildren();
 const option=document.createElement("option");option.value="";option.textContent="Select an approved radio recording";$("track").append(option);
 for(const track of data.radio_tracks||[]){
  if(!track.public_ready)continue;
  const el=document.createElement("option");el.value=track.id;
  el.textContent=(track.artist||"")+" — "+(track.title||"")+" ["+track.id.slice(0,8)+"]";
  $("track").append(el);
 }
 $("export-sia").disabled=working||!data.links?.length;
 updateLinkButtons();
}
async function refresh(){
 if(working)return;
 const current=await signedIn();
 if(!current)return;
 try{renderStatus(await call("status"));line("Catalog refreshed; private inventory not publicly exposed.")}
 catch(error){line("Registry unavailable: "+error.message);$("auth").textContent="MESH not reachable: "+error.message}
}
function validManifest(data){
 if(data?.schema!=="humkin.mesh/inventory/v1"||
 !/^[0-9a-f-]{36}$/i.test(data.node_id||"")||
 typeof data.label!=="string"||!data.label.trim()||
 typeof data.scanned_at!=="string"||!Array.isArray(data.files)||
 data.files.length>100000||!data.summary)throw Error("Not a supported MESH scanner manifest.");
 for(const row of data.files){
  if(!/^[0-9a-f]{64}$/.test(row.sha256||"")||
    !/^[0-9a-f]{64}$/.test(row.path_hash||"")||
    typeof row.relative_path!=="string"||typeof row.bytes!=="number")
    throw Error("Manifest has invalid file entries. Re-run the scanner.");
 }
 return data;
}
$("manifest").addEventListener("change",async event=>{
 inventory=null;$("preview").replaceChildren();$("ingest").disabled=true;
 const file=event.target.files?.[0];
 if(!file)return;
 if(file.size>30*1024*1024){$("manifest-info").textContent="Manifest exceeds 30 MiB; split the music folders into smaller scans.";return;}
 try{
  const payload=validManifest(JSON.parse(await file.text()));
  inventory=payload;
  const s=payload.summary;
  $("manifest-info").textContent=payload.label+" · "+s.files+" files · "+
    s.unique_hashes+" distinct hashes · "+bytes(s.logical_bytes)+" on disk · "+
    bytes(s.duplicate_bytes)+" duplicate bytes · "+(s.errors||0)+" scan warnings.";
  for(const item of payload.files.slice(0,12))
   li($("preview"),item.relative_path+" · "+bytes(item.bytes));
  if(payload.files.length>12)li($("preview"),"...and "+(payload.files.length-12)+" additional files.");
  $("ingest").disabled=!session||!payload.files.length;
  $("ingest-result").textContent="Preview only. Nothing has been uploaded yet.";
 }catch(error){$("manifest-info").textContent="Rejected manifest: "+error.message}
});
$("ingest").addEventListener("click",async()=>{
 if(working||!inventory?.files?.length)return;
 if(!confirm("Register "+inventory.files.length+" file locations for "+inventory.label+
   "? Only metadata and relative filenames go to the private registry; no audio is uploaded."))return;
 setWork(true);stopRequested=false;let processed=0;
 try{
  const chunks=Math.ceil(inventory.files.length/100);
  for(let i=0;i<chunks;i++){
   if(stopRequested)break;
   const batch=inventory.files.slice(i*100,(i+1)*100);
   const receipt=await call("ingest",{node_id:inventory.node_id,label:inventory.label,
      scanned_at:inventory.scanned_at,files:batch});
   processed+=receipt.registered_copies;
   $("progress").value=Math.round(100*Math.min(inventory.files.length,(i+1)*100)/inventory.files.length);
   $("ingest-result").textContent="Registered "+processed+" / "+inventory.files.length+" copies.";
  }
  $("ingest-result").textContent="Private MESH intake: "+processed+" entries registered."+
   (stopRequested?" Stopped between batches; reimport same JSON to resume.":" No audio transferred.");
  line($("ingest-result").textContent);
 }catch(error){
  $("ingest-result").textContent="Batch failed at "+processed+" copies: "+error.message+
   ". Reselect or retry the same manifest; previously registered copies are deduplicated.";
  line($("ingest-result").textContent);
 }finally{
  setWork(false);$("progress").value=0;await refresh();
 }
});
$("stop").addEventListener("click",()=>{stopRequested=true;$("ingest-result").textContent="Stopping after current batch."});
$("sync-radio").addEventListener("click",async()=>{
 setWork(true);
 try{const receipt=await call("sync_radio");
  line("Reindexed "+receipt.synced+" already-published R2 recordings. No file moved.");
 }catch(error){line("Radio index failed: "+error.message)}
 finally{setWork(false);await refresh();}
});
function updateLinkButtons(){
 const slug=$("slug").value.trim(),hasLink=!!status?.links?.some(x=>x.slug===slug);
 $("create-link").disabled=working||!session||!$("track").value||hasLink;
 $("repoint-link").disabled=working||!session||!$("track").value||!hasLink;
 $("hold-link").disabled=working||!session||!hasLink;
}
for(const id of ["slug","track","link-title","reason"])$(id).addEventListener("input",updateLinkButtons);
async function changeLink(action){
 const slug=$("slug").value.trim(),reason=$("reason").value.trim();
 if(!/^[a-z0-9](?:[a-z0-9-]{2,38}[a-z0-9])$/.test(slug))
  return $("link-result").textContent="Use 4–41 lowercase letters/digits/hyphens; start/end must be alphanumeric.";
 if(!reason)return $("link-result").textContent="State a reason to preserve link history.";
 if(!confirm(action==="link_hold"?"Hold this public link immediately?":
   "Confirm this operator-approved public reference change?"))return;
 setWork(true);
 try{
  const response=await call(action,{slug,reason,track_id:$("track").value,
    title:$("link-title").value.trim()});
  const url=response.url||"https://humkin.abundent.org/m/?id="+slug;
  $("link-result").textContent=response.held?"HELD · "+url:
    "ACTIVE · "+url+" · stable link registered.";
  line("SIA identity: "+slug+" · "+(response.held?"held":"active"));
 }catch(error){$("link-result").textContent="Link change refused: "+error.message}
 finally{setWork(false);await refresh();}
}
$("create-link").addEventListener("click",()=>changeLink("link_create"));
$("repoint-link").addEventListener("click",()=>changeLink("link_repoint"));
$("hold-link").addEventListener("click",()=>changeLink("link_hold"));
$("export-sia").addEventListener("click",()=>{
 if(!status?.links?.length)return;
 // No private paths, node identifiers or unpublished media ever enter this export.
 const exported={schema:"humkin.mesh/sia-export/v1",exported_at:new Date().toISOString(),
  source:"https://humkin.abundent.org/m/",
  links:status.links.map(x=>({id:x.slug,title:x.title,status:x.state,
    url:"https://humkin.abundent.org/m/?id="+encodeURIComponent(x.slug)}))};
 const blob=new Blob([JSON.stringify(exported,null,2)+"\n"],{type:"application/json"});
 const url=URL.createObjectURL(blob);
 const anchor=document.createElement("a");anchor.href=url;anchor.download="humkin-mesh-sia-bridge.json";
 document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
 line("Exported owner-reviewed public links for SIA. Import into SIA separately; no automatic publication.");
});
$("refresh").addEventListener("click",refresh);
db.auth.onAuthStateChange(()=>setTimeout(refresh,0));
refresh();
