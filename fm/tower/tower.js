import {STATIONS} from "../../tools/radio-broadcast/cloudflare/stations.mjs";
import {CONTRACT_SCHEMA,validateContractGraph,fingerprint} from "../../tools/radio-broadcast/cloudflare/contracts.mjs";

const BASE="https://humkin-long-wave.joyvolcanomusic.workers.dev";
const STORAGE="humkin-tower-network-draft-v1";
const JOURNAL="humkin-tower-contract-events-v1";
const $=id=>document.getElementById(id);
const clone=x=>JSON.parse(JSON.stringify(x));
const baseline=clone(STATIONS);
let drafts=clone(baseline),current=drafts[0]?.id||null;
function message(text){$("draft-status").textContent=text}
function csv(value){return String(value||"").split(",").map(x=>x.trim()).filter(Boolean)}
function csvText(value){return Array.isArray(value)?value.join(", "):""}
function currentStation(){return drafts.find(s=>s.id===current)||null}
function events(){
 try{
   const data=JSON.parse(localStorage.getItem(JOURNAL)||"[]");
   return Array.isArray(data)?data:[];
 }catch{return []}
}
function renderEvents(){
 const node=$("contract-events"),items=events().slice(-8).reverse();
 node.replaceChildren();
 if(!items.length){node.textContent="No local changes recorded.";return}
 for(const e of items){
   const p=document.createElement("p");
   p.textContent=e.at+" · "+e.type+" · "+e.station_id+
     " · revision "+e.revision+" · "+e.fingerprint;
   node.append(p);
 }
}
function appendEvent(type,station){
 const list=events();
 if(list.length>=1000){
   message("Local journal is full. Export your draft before making further changes.");
   return false;
 }
 const entry={schema:"humkin.radio.station-draft-event/v1",
  type,at:new Date().toISOString(),station_id:station?.id||"network",
  revision:station?.revision||null,contract_schema:CONTRACT_SCHEMA,
  fingerprint:fingerprint(station||drafts)};
 try{
   localStorage.setItem(JOURNAL,JSON.stringify([...list,entry]));
   renderEvents();return true;
 }catch{
   message("Local event storage unavailable. Export your draft to preserve changes.");
   return false;
 }
}
function bump(station,action){
 station.contract_version=1;
 station.revision=(Number.isSafeInteger(station.revision)?station.revision:0)+1;
 persist();appendEvent(action,station);renderContract();
}
function renderContract(){
 const s=currentStation();
 if(!s)return;
 let lineage=[];
 try{
   validateContractGraph(drafts);
   const lookup=new Map(drafts.map(x=>[x.id,x]));
   const visited=new Set();let cursor=s.id;
   while(cursor!=="mainline"){
     if(visited.has(cursor))throw Error("circular contract");
     visited.add(cursor);lineage.unshift(cursor);
     cursor=lookup.get(cursor)?.parent_id||"mainline";
   }
   lineage.unshift("MAINLINE");
   $("contract-lineage").textContent=lineage.join(" → ")+" · revision "+(s.revision||1)+
     " · "+(s.relationship?.kind||"independent")+" ("+(s.relationship?.influence||0)+"% influence)"+
     " · draft only";
 }catch(error){
   $("contract-lineage").textContent="INVALID DEPENDENCY: "+error.message;
 }
}
function renderParentOptions(){
 const s=currentStation(),select=$("parent-station");
 select.replaceChildren();
 for(const candidate of [{id:"mainline",name:"MAINLINE"},...drafts.filter(x=>x.id!==s.id)]){
   const option=document.createElement("option");
   option.value=candidate.id;option.textContent=candidate.name+" ("+candidate.id+")";
   select.append(option);
 }
 select.value=s.parent_id||"mainline";
}
function loadDraft(){
 try{
  const data=JSON.parse(localStorage.getItem(STORAGE)||"null");
  if(Array.isArray(data)&&data.length&&data.length<=100&&
    data.every(s=>/^[a-z0-9][a-z0-9-]{1,39}$/.test(s.id||"")&&
      ["personal","virtual","live"].includes(s.mode))){
      const migrated=data.map(s=>({
        ...s,contract_version:s.contract_version||1,revision:s.revision||1,
        parent_id:s.parent_id||"mainline",
        relationship:s.relationship||{kind:"independent",influence:0}
      }));
      validateContractGraph(migrated);
      drafts=migrated;
    }
 }catch{/* Storage may be disabled; no public settings are modified. */}
}
function persist(){
 try{localStorage.setItem(STORAGE,JSON.stringify(drafts));return true}
 catch{return false}
}
function setText(id,v){$(id).value=v||""}
function setChecked(id,v){$(id).checked=v===true}
function updateSelect(){
 const pick=$("edit-station");
 pick.replaceChildren();
 for(const s of drafts){
  const option=document.createElement("option");
  option.value=s.id;option.textContent=s.name+" ("+s.id+")";
  pick.append(option);
 }
 if(!drafts.some(s=>s.id===current))current=drafts[0]?.id||null;
 pick.value=current||"";
}
function renderForm(){
 const s=currentStation();
 if(!s)return;
 updateSelect();
 setText("name",s.name);
 renderParentOptions();
 $("relationship").value=s.relationship?.kind||"independent";
 $("influence").value=String(s.relationship?.influence||0);
 $("influence-label").textContent=$("influence").value+"%";
 $("mode").value=s.mode;
 $("kinds").value=Array.isArray(s.filter?.kinds)&&s.filter.kinds.length===1?
    s.filter.kinds[0]:"all";
 setChecked("enabled",s.enabled);
 setChecked("bumpers",s.include_bumpers);
 setText("artists",csvText(s.filter?.artists));
 setText("albums",csvText(s.filter?.albums));
 setText("tags",csvText(s.filter?.tags));
 setText("track-ids",csvText(s.filter?.track_ids));
 setChecked("featured",s.filter?.featured);
 setChecked("seasonal",s.filter?.seasonal);
 renderPrograms();renderContract();
}
function saveForm(){
 const s=currentStation();
 if(!s)return false;
 const before=clone(s),beforeFingerprint=fingerprint(s);
 const name=$("name").value.trim();
 if(!name){message("A station needs a name.");return false}
 s.name=name.slice(0,100);
 s.mode=$("mode").value;
 s.enabled=$("enabled").checked;
 s.parent_id=$("parent-station").value;
 s.relationship={kind:$("relationship").value,
   influence:Number($("influence").value)};
 s.include_bumpers=$("bumpers").checked;
 const f={};
 const lane=$("kinds").value;
 if(lane!=="all")f.kinds=[lane];
 for(const [input,key] of [["artists","artists"],["albums","albums"],["tags","tags"],["track-ids","track_ids"]]){
  const values=csv($(input).value);
  if(values.length)f[key]=values.slice(0,500);
 }
 if($("featured").checked)f.featured=true;
 if($("seasonal").checked)f.seasonal=true;
 // A newly created station without a filter never broadcasts everything by
 // accident. Source presets are not subject to this special safety default.
 if(!Object.keys(f).length&&(s._new===true||s.id==="top-40"))f.track_ids=[];
 s.filter=f;
 try{validateContractGraph(drafts)}catch(error){
   Object.assign(s,before);
   renderForm();
   message("Contract rejected: "+error.message);
   return false;
 }
 const changed=beforeFingerprint!==fingerprint(s);
 if(changed)bump(s,"DRAFT_CONTRACT_UPDATED");
 const stored=persist();
 updateSelect();renderContract();
 message(stored?"LOCAL DRAFT SAVED"+(changed?" · revision "+s.revision:" · unchanged")+
   ". Nothing changed on the public Worker.":
    "Browser storage unavailable. Export the network draft to retain these changes.");
 return true;
}
function renderPrograms(){
 const root=$("schedule-list");root.replaceChildren();
 const s=currentStation();
 const programs=s?.programs||[];
 if(!programs.length){
  const p=document.createElement("p");p.className="note";
  p.textContent="No timed overrides. This station uses its regular rotation.";root.append(p);return;
 }
 for(const p of programs){
  const block=document.createElement("div");block.className="schedule";
  const heading=document.createElement("strong");heading.textContent=p.name||"Untitled";
  const meta=document.createElement("small");
  const hhmm=n=>String(Math.floor(n/60)).padStart(2,"0")+":"+
     String(n%60).padStart(2,"0");
  meta.textContent="Central "+hhmm(p.start_minute)+"–"+hhmm(p.end_minute)+
    " · days "+(p.days||[]).join(",")+" · priority "+(p.priority||0);
  const details=document.createElement("p");details.className="note";
  details.textContent="Selection: "+JSON.stringify(p.filter||{});
  const remove=document.createElement("button");remove.type="button";
  remove.className="ghost";remove.textContent="REMOVE SLOT";
  remove.addEventListener("click",()=>{
    s.programs=s.programs.filter(x=>x.id!==p.id);
    bump(s,"DRAFT_PROGRAM_REMOVED");renderPrograms();
    message("Program removed from local draft. Public programming unchanged.");
  });
  block.append(heading,meta,details,remove);root.append(block);
 }
}
function addProgram(){
 if(!saveForm())return;
 const s=currentStation();
 const name=$("show-name").value.trim();
 const start=$("show-start").value,end=$("show-end").value;
 const days=[...$("show-days").querySelectorAll("input:checked")].map(x=>Number(x.value));
 const ids=csv($("show-ids").value);
 if(!name||!days.length||!/^\d\d:\d\d$/.test(start)||!/^\d\d:\d\d$/.test(end)){
  message("Supply a name, start/end times and at least one weekday.");return;
 }
 const toMinutes=value=>{const [h,m]=value.split(":").map(Number);return h*60+m};
 const from=toMinutes(start),to=toMinutes(end);
 if(!(from>=0&&from<to&&to<=1440)){
  message("Program end must be after its start. Split overnight shows at midnight.");return;
 }
 if(!ids.length&&!$("show-singles").checked){
  message("Choose exact approved track IDs or enable Featured singles; empty programming does not air.");return;
 }
 const priority=Number($("show-priority").value);
 if(!Number.isInteger(priority)||priority<-100||priority>100){
  message("Priority must be a whole number between -100 and 100.");return;
 }
 const filter={};
 if(ids.length)filter.track_ids=ids;
 if($("show-singles").checked){filter.kinds=["song"];filter.featured=true}
 const token="slot-"+Math.random().toString(36).slice(2,10);
 s.programs=Array.isArray(s.programs)?s.programs:[];
 s.programs.push({id:token,name:name.slice(0,100),days,
  start_minute:from,end_minute:to,priority,filter});
 s.mode="virtual";$("mode").value="virtual";
 bump(s,"DRAFT_PROGRAM_ADDED");renderPrograms();
 message("Scheduled program added locally. Export for review before production.");
}
function addStation(){
 const id=$("new-station-id").value.trim().toLowerCase();
 if(!/^[a-z0-9][a-z0-9-]{1,39}$/.test(id)){
  message("Station ID must be 2–40 lowercase letters, numbers or hyphens.");return;
 }
 if(drafts.some(s=>s.id===id)){
  message("That station ID already exists.");return;
 }
 if(drafts.length>=100){message("Maximum of 100 locally designed stations.");return}
 drafts.push({id,name:id.replace(/-/g," ").toUpperCase(),enabled:false,
  mode:"personal",description:"Local draft — not published",filter:{track_ids:[]},
  contract_version:1,revision:1,parent_id:"mainline",
  relationship:{kind:"independent",influence:0},
  include_bumpers:false,programs:[],_new:true});
 current=id;$("new-station-id").value="";
 persist();renderForm();appendEvent("DRAFT_STATION_CREATED",currentStation());
 message("New station prepared OFF AIR. Select approved content before enabling.");
}
function exportDraft(){
 if(!saveForm())return;
 const payload={schema:"humkin.radio.virtual-network/v1",
  contract_schema:CONTRACT_SCHEMA,
  note:"TOWER local draft only. Local journal is not an authoritative or immutable ledger.",
  exported_at:new Date().toISOString(),events:events(),
  stations:drafts.map(s=>{
   const copy=clone(s);delete copy._new;return copy;
  })};
 const blob=new Blob([JSON.stringify(payload,null,2)+"\n"],
  {type:"application/json;charset=utf-8"});
 const url=URL.createObjectURL(blob);
 const a=document.createElement("a");a.href=url;a.download="humkin-network-draft.json";
 document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
 message("Network draft exported. Public station configuration is unchanged.");
}
function stationCard(item){
 const div=document.createElement("article");div.className="station";
 const title=document.createElement("strong");title.textContent=item.name;
 const mode=document.createElement("span");mode.className="pill"+(!item.ready||!item.enabled?" off":"");
 mode.textContent=item.mode.toUpperCase()+(item.ready?" · READY":" · NOT PROGRAMMED");
 const note=document.createElement("small");
 note.textContent=item.program||"No program";
 const description=document.createElement("p");description.className="sub";
 description.textContent=item.description||"";
 const play=document.createElement("button");play.type="button";
 play.textContent="TUNE IN";
 play.disabled=!item.ready||!item.enabled||!item.stream||item.mode==="live";
 play.addEventListener("click",()=>{
  // Only trust station paths returned from our Worker; never accept an
  // arbitrary audio URL or a credential-bearing address from metadata.
  if(!/^\/stations\/[a-z0-9-]+\/live\.mp3$/.test(item.stream))return;
  const audio=$("radio");audio.pause();audio.src=BASE+item.stream;audio.load();
  $("listen-status").textContent="TUNED: "+item.name+". Press Play to listen.";
 });
 div.append(title,mode,note,description,play);return div;
}
async function loadNetwork(){
 const root=$("stations");root.replaceChildren();
 $("network-status").textContent="Contacting the public Worker…";
 try{
  const response=await fetch(BASE+"/stations",{cache:"no-store"});
  if(!response.ok)throw Error("Virtual station routes have not been deployed (HTTP "+response.status+").");
  const data=await response.json();
  if(!Array.isArray(data.stations))throw Error("Worker does not support station listings yet.");
  for(const station of data.stations)root.append(stationCard(station));
  $("network-status").textContent="Worker reachable · "+data.stations.filter(s=>s.ready&&s.enabled).length+
    " available frequencies · unsynchronized per-listener MP3.";
 }catch(err){
  $("network-status").textContent=String(err.message||err);
  const p=document.createElement("p");p.className="note";
  p.textContent="The local design board below still works. No existing Station One broadcast was changed.";
  root.append(p);
 }
}
loadDraft();renderForm();
$("edit-station").addEventListener("change",()=>{
  const next=$("edit-station").value;
  saveForm();current=next;renderForm();
});
$("new-station").addEventListener("click",addStation);
$("save-station").addEventListener("click",saveForm);
$("add-program").addEventListener("click",addProgram);
$("export").addEventListener("click",exportDraft);
$("reset-draft").addEventListener("click",()=>{
 if(!confirm("Discard all local station designs and restore source presets?"))return;
 drafts=clone(baseline);current=drafts[0]?.id||null;persist();renderForm();
 appendEvent("DRAFT_NETWORK_RESET");
 message("Source presets restored in this browser only. Local journal retained.");
});
$("refresh-network").addEventListener("click",loadNetwork);
 $("influence").addEventListener("input",()=>{
   $("influence-label").textContent=$("influence").value+"%";
 });
 renderEvents();
$("radio").addEventListener("playing",()=>{
 $("listen-status").textContent="NOW PLAYING · "+$("radio").src.split("/stations/")[1]?.split("/")[0];
});
$("radio").addEventListener("error",()=>{
 $("listen-status").textContent="Signal unavailable. Verify the Worker and selected station are deployed.";
});
loadNetwork();
