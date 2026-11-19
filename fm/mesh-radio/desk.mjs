import {SCHEMA,blank,validate,portable,merge,ingestInventory,ingestPublishedCrate,
  addBrowserFile,addHosted,sources,nextCompost} from "./links.mjs";

const API="https://kbhqacsdvjsstzyplqij.supabase.co";
const KEY="sb_publishable_Bv9JuOctSQTmnE3O1dP8RA_MKRNSD-o"; // Public key, RLS-restricted.
const STORE="humkin.mesh-radio.linkblocks.001",PLAYS="humkin.mesh-radio.local-plays.001";
const $=id=>document.getElementById(id),audio=$("audio");
const localFiles=new Map(),failed=new Set();
let graph=blank(),history={},current=null,activeRoute=null,working=false,visibleFilter="";
function log(message){$("messages").textContent=new Date().toLocaleTimeString()+" · "+message+"\n"+
  $("messages").textContent.slice(0,7000);}
try{
  const saved=localStorage.getItem(STORE);
  if(saved){const parsed=JSON.parse(saved);validate(parsed);graph=parsed;}
  const last=localStorage.getItem(PLAYS);if(last)history=JSON.parse(last);
}catch(error){log("Saved index couldn't be opened: "+error.message+". Load a prior export or reimport.");}
function save(){
  try{localStorage.setItem(STORE,JSON.stringify(portable(graph)));}
  catch(error){log("Browser storage full or disabled. Use EXPORT PORTABLE GRAPH to save this index.");}
}
function saveHistory(){
  try{localStorage.setItem(PLAYS,JSON.stringify(history));}catch{/* optional per-browser tally */}
}
const label=row=>[row.artist,row.title].filter(Boolean).join(" — ");
const matches=row=>!visibleFilter||
  [row.title,row.artist,row.album,row.sha256].some(s=>String(s||"").toLowerCase().includes(visibleFilter));
function playable(row){return sources(graph,row.sha256,localFiles,failed).length>0;}
function show(){
  $("rec-count").textContent=graph.recordings.length.toLocaleString();
  $("node-count").textContent=graph.nodes.length.toLocaleString();
  $("route-count").textContent=graph.routes.length.toLocaleString();
  $("ready-count").textContent=graph.recordings.filter(playable).length.toLocaleString();
  const items=graph.recordings.filter(matches).sort((a,b)=>label(a).localeCompare(label(b)));
  $("list-note").textContent="Showing "+Math.min(125,items.length)+" of "+items.length+
    " matching recordings · "+graph.recordings.length+" indexed. Playable here means a local file is selected or a public HTTPS location is known; not a verified online host.";
  $("songs").replaceChildren();
  for(const row of items.slice(0,125)){
    const li=document.createElement("li"),description=document.createElement("div");
    const strong=document.createElement("strong");strong.textContent=label(row);
    const meta=document.createElement("small");
    const count=graph.routes.filter(r=>r.recording===row.id).length;
    meta.textContent=(row.album||"No album")+" · "+count+" location link"+(count===1?"":"s")+
      (localFiles.has(row.sha256)?" · LOCAL AUDIO READY":
       playable(row)?" · HOSTED ROUTE":" · INDEXED ONLY")+
      " · "+(Number(history[row.sha256]?.count)||0)+" completed plays";
    const controls=document.createElement("div");controls.className="actions";
    const play=document.createElement("button");play.textContent="HEAR";play.type="button";
    play.disabled=!playable(row);play.addEventListener("click",()=>tune(row));
    const link=document.createElement("button");link.textContent="LINK";link.type="button";
    link.className="ghost";link.title="Use this exact recording hash in Add another free host";
    link.addEventListener("click",()=>{
      $("hash").value=row.sha256;$("hash").focus();$("hash").scrollIntoView({behavior:"smooth",block:"center"});
    });
    controls.append(play,link);description.append(strong,meta);li.append(description,controls);$("songs").append(li);
  }
}
function busy(value){working=value;
  for(const id of ["cloud","export","local","folder","inventory"])$(id).disabled=value;
}
function broadcastError(error){log(error?.message||String(error));}
function next(exclude=""){
  const record=nextCompost(graph,history,localFiles,failed,exclude);
  if(!record){audio.pause();audio.removeAttribute("src");audio.load();current=null;activeRoute=null;
    $("now").textContent="No playable recording is currently available.";
    $("source").textContent="Choose local files or add a public audio source.";
    return;}
  tune(record);
}
function useRoute(){
  if(!current)return;
  const routes=sources(graph,current.sha256,localFiles,failed);
  if(!routes.length){
    log("No remaining playable source for "+label(current)+". Skipping.");
    next(current.sha256);return;
  }
  activeRoute=routes[0];
  $("now").textContent=label(current);
  $("source").textContent="Source: "+activeRoute.provider;
  audio.src=activeRoute.url;
  audio.load();
  // Playback follows a real click or a prior user-started audio session.
  audio.play().catch(error=>{$("source").textContent="Click Play on the audio control if your browser blocked continuing playback.";log(error.message);});
}
function tune(row){current=row;useRoute();}
audio.addEventListener("error",()=>{
  if(!current||!activeRoute)return;
  log("Source didn't play ("+activeRoute.provider+"). Trying another route.");
  failed.add(activeRoute.key);activeRoute=null;useRoute();show();
});
audio.addEventListener("ended",()=>{
  if(!current)return;
  const entry=history[current.sha256]||{count:0,last:0};
  entry.count=Number(entry.count||0)+1;entry.last=Date.now();
  history[current.sha256]=entry;saveHistory();
  next(current.sha256);show();
});
$("play-compost").addEventListener("click",()=>next(current?.sha256||""));
$("skip").addEventListener("click",()=>next(current?.sha256||""));
$("stop").addEventListener("click",()=>{
  audio.pause();audio.removeAttribute("src");audio.load();current=null;activeRoute=null;
  $("now").textContent="Stopped. The catalog is unchanged.";$("source").textContent="";
});
$("search").addEventListener("input",()=>{visibleFilter=$("search").value.toLowerCase().trim();show();});
$("inventory").addEventListener("change",async(event)=>{
  const files=[...event.target.files];if(!files.length)return;busy(true);
  try{
    for(const file of files){
      try{
        if(file.size>32*1024*1024)throw Error("Manifest is too large.");
        const obj=JSON.parse(await file.text());
        if(obj.schema==="humkin.mesh/inventory/v1"){
          const receipt=ingestInventory(graph,obj);
          log(file.name+": "+receipt.copies+" device/recording links indexed.");
        }else if(obj.schema===SCHEMA){
          merge(graph,obj);log(file.name+": portable link graph merged.");
        }else throw Error("Unknown inventory or Linkblocks format.");
      }catch(error){log(file.name+": "+error.message);}
    }
    save();show();
  }finally{event.target.value="";busy(false);}
});
async function localBatch(files){
  const audioFiles=[...files].filter(f=>/\.(mp3|wav|m4a|ogg|flac|opus|aac)$/i.test(f.name));
  if(!audioFiles.length)return;busy(true);
  let added=0,errors=0;
  try{
    for(let i=0;i<audioFiles.length;i++){
      const file=audioFiles[i];
      try{
        // One file at a time: no parallel RAM spike for a 2,000-song crate.
        if(file.size>256*1024*1024)throw Error("Over 256 MiB; use the MESH scanner for inventory.");
        const bytes=await file.arrayBuffer();
        const sha=[...new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))]
          .map(v=>v.toString(16).padStart(2,"0")).join("");
        const record=addBrowserFile(graph,{sha256:sha,title:file.name.replace(/\.[^.]+$/,"")});
        const former=localFiles.get(sha);
        if(former)URL.revokeObjectURL(former.url);
        localFiles.set(sha,{url:URL.createObjectURL(file),file});
        added++;
        if(i%8===0){log("Local audio attached: "+added+"/"+audioFiles.length+" · "+record.title);show();}
      }catch(error){errors++;log(file.name+": "+error.message);}
    }
    save();show();log("Selected "+added+" local recordings, "+errors+" unreadable. Nothing uploaded.");
  }finally{busy(false);}
}
for(const id of ["local","folder"])$(id).addEventListener("change",async event=>{
  const files=event.target.files;
  try{await localBatch(files);}finally{event.target.value="";}
});
$("cloud").addEventListener("click",async()=>{
  busy(true);try{
    // Same public catalog and same public key already used by HUMKIN RADIO.
    const fields="sha256,title,artist,album,kind,enabled,published_at,duration_seconds,storage_provider,r2_object_key";
    const response=await fetch(API+"/rest/v1/humkin_radio_tracks?select="+fields+
      "&published_at=not.is.null&enabled=eq.true&storage_provider=eq.r2&limit=2000",
      {headers:{apikey:KEY},cache:"no-store"});
    if(!response.ok)throw Error("Published catalog HTTP "+response.status);
    const count=ingestPublishedCrate(graph,await response.json());
    save();show();log("Linked "+count+" publicly approved R2 recordings into this workbench.");
  }catch(error){broadcastError(error);}finally{busy(false);}
});
$("host-form").addEventListener("submit",event=>{
  event.preventDefault();
  try{
    addHosted(graph,{sha256:$("hash").value.toLowerCase().trim(),provider:$("provider").value,
      url:$("url").value.trim()});
    save();show();log("Another host route linked. Audio availability is checked when played.");
    $("url").value="";
  }catch(error){broadcastError(error);}
});
$("export").addEventListener("click",()=>{
  try{
    const data=portable(graph);
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)+"\n"],{type:"application/json"}));
    const a=document.createElement("a");a.href=url;a.download="humkin-radio-linkblocks.json";
    a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
    log("Portable graph exported. No private paths or audio files are included.");
  }catch(error){broadcastError(error);}
});
$("clear").addEventListener("click",()=>{
  if(!confirm("Clear only this browser's Linkblocks index? It will NOT delete audio, R2 data, or Supabase entries."))return;
  audio.pause();audio.removeAttribute("src");audio.load();
  for(const item of localFiles.values())URL.revokeObjectURL(item.url);
  localFiles.clear();graph=blank();current=null;activeRoute=null;failed.clear();
  try{localStorage.removeItem(STORE);}catch{/* optional */}
  $("now").textContent="No recording selected.";$("source").textContent="";
  log("Browser index cleared. Original files and published catalogs were not touched.");show();
});
show();
