/* TOWER LIVING CRATE — ordered feature drafts, from the existing Crate Loader.
 * Saves an owner-only PAUSED recurring program through the established RLS table.
 * A draft is not a Cloud HOUSE program or an on-air receipt.
 */
import {availableRecordings,buildPausedFeature,move} from "./feature-core.mjs";
import {buildCloudHandoff,browserSha256,buildHouseCrate,checkedStation} from "./cloud-feature-handoff.mjs";

const OWNER="us@abundent.org";
const byId=id=>document.getElementById(id);
const weekdays=["SUN","MON","TUE","WED","THU","FRI","SAT"];
const el=(tag,label)=>{const item=document.createElement(tag);if(label)item.textContent=label;return item;};

export function mountFeatureDesk({db,rows,onStatus}){
 const root=byId("feature-desk");
 if(!root)return;
 const state={ids:[],busy:false,station:"station-one"};
 const stationSelect=byId("feature-station");
 const draftFields=["feature-name","feature-start","feature-end","feature-cloud-date","feature-cloud-time"];
 const drafts=new Map();
 const snapshot=()=>({ids:[...state.ids],fields:Object.fromEntries(draftFields.map(id=>[id,byId(id).value])),days:[...document.querySelectorAll('input[name="feature-day"]:checked')].map(n=>n.value)});
 const initialFields=Object.fromEntries(draftFields.map(id=>[id,byId(id).value]));
 function restore(draft){
   state.ids=[...draft.ids];
   for(const id of draftFields)byId(id).value=draft.fields[id]??initialFields[id];
   for(const day of document.querySelectorAll('input[name="feature-day"]'))day.checked=draft.days.includes(day.value);
 }
 function showScope(){
   byId("feature-scope").textContent=state.station==="station-one"?"Night Shift cloud drafts; legacy paused Same-Time saves remain separate.":"Cloud-only draft for "+state.station+". Legacy Same-Time save disabled.";
   byId("feature-draft-count").textContent=[...drafts.entries()].filter(([id,d])=>id!==state.station&&d.ids.length).map(([id,d])=>id+": "+d.ids.length+" positions").join(" · ")||"No other nonempty drafts in this tab.";
 }
 function switchStation(){
   if(state.busy){stationSelect.value=state.station;return;}
   const next=checkedStation(stationSelect.value);
   if(next===state.station)return;
   drafts.set(state.station,snapshot());state.station=next;
   restore(drafts.get(next)||{ids:[],fields:{...initialFields,name:"","feature-name":""},days:["5"]});
   renderChoices();renderLineup();status("Editing "+next+" only. Previous station draft retained in this tab.");
 }
 function copyToStation(){
   if(state.busy||!state.ids.length)return;
   const target=checkedStation(byId("feature-copy-target").value);
   if(target===state.station)return status("Choose a different destination.");
   if(drafts.get(target)?.ids.length&&!confirm("Replace the unsaved "+target+" draft?"))return;
   drafts.set(target,snapshot());showScope();status("Copied ordered draft to "+target+". No shared queue or live schedule changed.");
 }
 const status=message=>{byId("feature-status").textContent=message;onStatus?.(message)};
 const approved=()=>availableRecordings(rows());
 const matched=()=>{const query=String(byId("feature-search").value||"").toLocaleLowerCase().trim();
  return approved().filter(r=>!query||
    [r.title,r.artist,r.album,r.kind].some(s=>String(s||"").toLocaleLowerCase().includes(query)))
    .slice(0,150);};
 function renderChoices(){
   const select=byId("feature-track");
   const previous=select.value;
   select.replaceChildren(new Option("Choose an approved recording…",""));
   for(const r of matched()){
     const tag=r.kind==="bumper"?"CART":r.is_single?"SINGLE":"SONG";
     const option=new Option("["+tag+"] "+r.title+" — "+r.artist,r.id);
     select.add(option);
   }
   if([...select.options].some(option=>option.value===previous))select.value=previous;
   byId("feature-match-count").textContent=matched().length+
    " matching approved recordings (showing up to 150); search to narrow";
 }
 function renderLineup(){
   const list=byId("feature-order");
   list.replaceChildren();
   const lookup=new Map(approved().map(r=>[r.id,r]));
   if(!state.ids.length)list.append(el("li","Nothing added yet. Choose a track above."));
   state.ids.forEach((id,index)=>{
     const record=lookup.get(id);
     const item=el("li");
     const label=el("span",record?(record.kind==="bumper"?"CART · ":"SONG · ")+
       record.title+" · "+Math.round(Number(record.duration_seconds))+" sec":
       "UNAVAILABLE · This draft needs review");
     item.append(label);
     const tools=el("span");tools.className="feature-actions";
     for(const [text,dir] of [["↑",-1],["↓",1]]){
       const b=el("button",text);b.type="button";
       b.disabled=state.busy||(dir===-1&&index===0)||(dir===1&&index===state.ids.length-1);
       b.setAttribute("aria-label",(dir===-1?"Move up: ":"Move down: ")+(record?.title||id));
       b.addEventListener("click",()=>{state.ids=move(state.ids,index,dir);renderLineup()});
       tools.append(b);
     }
     const remove=el("button","Remove");remove.type="button";remove.disabled=state.busy;
     remove.addEventListener("click",()=>{state.ids.splice(index,1);renderLineup()});
     tools.append(remove);item.append(tools);list.append(item);
   });
   const sec=state.ids.reduce((sum,id)=>sum+Number(lookup.get(id)?.duration_seconds||0),0);
   byId("feature-duration").textContent=state.ids.length+" ordered positions · "+
     Math.round(sec/60)+" min of approved audio before repeats";
   const from=byId("feature-start").value,to=byId("feature-end").value;
   if(from&&to){
     const start=Number(from.slice(0,2))*60+Number(from.slice(3,5));
     const end=Number(to.slice(0,2))*60+Number(to.slice(3,5));
     if(end>start&&sec/60>end-start)
       byId("feature-duration").textContent+=" · Longer than selected window: the show may not complete before the end";
   }
   byId("feature-save").disabled=state.busy||!state.ids.length||state.station!=="station-one";
   byId("feature-export-house").disabled=state.busy||!state.ids.length||state.station==="station-one";
   byId("feature-copy").disabled=state.busy||!state.ids.length;
   stationSelect.disabled=state.busy;
   showScope();
   byId("feature-export-cloud").disabled=state.busy||!state.ids.length;
 }
 async function save(){
   if(state.busy||state.station!=="station-one")return;
   state.busy=true;renderLineup();byId("feature-save").disabled=true;
   try{
     const result=await db.auth.getUser();
     const user=result.data?.user;
     if(result.error||!user||user.email?.toLowerCase()!==OWNER)
       throw Error("Unlock your verified owner session first.");
     const days=[...document.querySelectorAll('input[name="feature-day"]:checked')]
        .map(node=>Number(node.value));
     // Re-check eligibility against the current owner-readable catalog, not
     // only the list that was on screen before the program was assembled.
     const ids=[...new Set(state.ids)];
     const check=await db.from("humkin_radio_tracks")
       .select("id,kind,enabled,published_at,duration_seconds").in("id",ids);
     if(check.error)throw Error("Current source eligibility unavailable: "+check.error.message);
     const packet=buildPausedFeature({
       name:byId("feature-name").value,days,start:byId("feature-start").value,
       end:byId("feature-end").value,trackIds:state.ids
     },check.data||[],user.id);
     const {data,error}=await db.from("humkin_radio_programs")
       .insert(packet).select("id,name,is_active").single();
     if(error)throw Error(error.message);
     if(data?.is_active!==false)throw Error("Saved state was not verified paused; inspect in Station Manager.");
     status("SAVED PAUSED: "+data.name+" · "+state.ids.length+
       " ordered positions. Open Station Manager to review before enabling. Cloud HOUSE is unchanged.");
     state.ids=[];renderLineup();
   }catch(err){status("FEATURE NOT SAVED: "+err.message)}
   finally{state.busy=false;renderLineup()}
 }
 async function exportOneTimeCloud(){
   if(state.busy)return;
   state.busy=true;renderLineup();
   try{
     const {data,error}=await db.auth.getUser();
     if(error||data?.user?.email?.toLowerCase()!==OWNER)
       throw Error("Only the verified HUMKIN owner can export a Cloud HOUSE feature.");
     const ids=[...new Set(state.ids)];
     const check=await db.from("humkin_radio_tracks")
       .select("id,title,artist,album,kind,enabled,published_at,storage_provider,sha256,r2_object_key,duration_seconds")
       .in("id",ids);
     if(check.error)throw Error("Cannot recheck public audio: "+check.error.message);
     const nonce=crypto.getRandomValues(new Uint8Array(12));
     const programId=[...nonce].map(b=>b.toString(16).padStart(2,"0")).join("");
     const packet=await buildCloudHandoff({
       name:byId("feature-name").value,
       day:byId("feature-cloud-date").value,
       time:byId("feature-cloud-time").value,
       ids:[...state.ids],rows:check.data||[],programId,stationId:state.station
     },browserSha256);
     const file=new Blob([JSON.stringify(packet,null,2),String.fromCharCode(10)],{type:"application/json"});
     const url=URL.createObjectURL(file);
     const link=document.createElement("a");
     link.href=url;
     link.download="HUMKIN-"+packet.station_id+"-cloud-feature-"+packet.slot.day+"-"+programId+".json";
     document.body.append(link);link.click();link.remove();
     setTimeout(()=>URL.revokeObjectURL(url),30000);
     status("ONE-TIME CLOUD HANDOFF PREPARED FOR "+packet.station_id+": "+state.ids.length+
       " ordered positions · "+packet.slot.day+" "+packet.slot.time+
       " Central. The downloaded packet is NOT an aired or scheduled show. "+
       "The owner must review and publish using Cloud Autopilot.");
   }catch(error){status("CLOUD FEATURE NOT EXPORTED: "+error.message)}
   finally{state.busy=false;renderLineup()}
 }
 async function exportHouse(){
   if(state.busy||state.station==="station-one")return;
   state.busy=true;renderLineup();
   try{
     const {data,error}=await db.auth.getUser();
     if(error||data?.user?.email?.toLowerCase()!==OWNER)throw Error("Unlock your verified owner session first.");
     const check=await db.from("humkin_radio_tracks").select("id,title,artist,album,kind,enabled,published_at,storage_provider,sha256,r2_object_key,duration_seconds").in("id",[...new Set(state.ids)]);
     if(check.error)throw Error("Cannot recheck source eligibility: "+check.error.message);
     const packet=await buildHouseCrate({stationId:state.station,ids:[...state.ids],rows:check.data||[]});
     const url=URL.createObjectURL(new Blob([JSON.stringify(packet,null,2)],{type:"application/json"}));
     const a=document.createElement("a");a.href=url;a.download="HUMKIN-"+state.station+"-house-crate.json";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
     status("HOUSE DRAFT FOR "+state.station+": "+packet.crate.tracks.length+" positions. Preview and review with Autopilot publisher; not published.");
   }catch(error){status("HOUSE NOT EXPORTED: "+error.message);}
   finally{state.busy=false;renderLineup();}
 }
 stationSelect.addEventListener("change",switchStation);
 byId("feature-copy").addEventListener("click",copyToStation);
 byId("feature-export-house").addEventListener("click",exportHouse);
 byId("feature-export-cloud").addEventListener("click",exportOneTimeCloud);
 byId("feature-add").addEventListener("click",()=>{
   if(state.busy)return;
   const id=byId("feature-track").value;
   if(!approved().some(r=>r.id===id))return status("Choose a currently approved recording.");
   if(state.ids.length>=200)return status("Maximum 200 positions per program.");
   state.ids.push(id);renderLineup();
 });
 byId("feature-search").addEventListener("input",renderChoices);
 for(const id of ["feature-start","feature-end"])byId(id).addEventListener("change",renderLineup);
 byId("feature-save").addEventListener("click",save);
 byId("feature-clear").addEventListener("click",()=>{
   if(state.busy)return;
   if(state.ids.length&& !confirm("Clear this unsaved feature running order?"))return;
   state.ids=[];renderLineup();status("Draft cleared. No show was created.");
 });
 byId("feature-days").replaceChildren();
 weekdays.forEach((name,i)=>{
   const span=el("label");
   const checkbox=document.createElement("input");checkbox.type="checkbox";checkbox.name="feature-day";checkbox.value=String(i);
   if(i===5)checkbox.checked=true;
   span.append(checkbox,document.createTextNode(" "+name));
   byId("feature-days").append(span);
 });
 renderChoices();renderLineup();
 status("Private editor. Only approved tracks are selectable. Save is PAUSED, never on air.");
 const requested=new URLSearchParams(location.search).get("station");
 if(requested&&[...stationSelect.options].some(option=>option.value===requested)){
   stationSelect.value=requested;switchStation();
 }
 return {refresh(){renderChoices();renderLineup()},hasDrafts(){return state.busy||state.ids.length>0||[...drafts.values()].some(d=>d.ids.length>0)}};
}
