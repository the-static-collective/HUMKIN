import {STATIONS,stationURL,stationHealth,ledgerView,inventory,draftCrate} from "./dial-core.mjs";
const $=id=>document.getElementById(id);
const make=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;return el;};
const cards=new Map(),audio=$("audio");let hls=null,receiverToken=0,rawLedger=null,busy=false;
const say=t=>$("receiver-state").textContent=t;
function disconnect(){receiverToken++;if(hls){hls.destroy();hls=null;}audio.pause();audio.removeAttribute("src");audio.load();}
function tune(id){
  disconnect();const token=receiverToken,url=stationURL(id,"live.m3u8");
  say("Connecting to "+id+"…");
  const play=()=>{if(token===receiverToken)audio.play().catch(()=>say("Press play on the audio control."));};
  if(audio.canPlayType("application/vnd.apple.mpegurl")){audio.src=url;play();}
  else if(globalThis.Hls?.isSupported?.()){
    const Hls=globalThis.Hls;hls=new Hls({liveSyncDurationCount:3});
    hls.on(Hls.Events.MEDIA_ATTACHED,()=>{if(token===receiverToken){hls.loadSource(url);play();}});
    hls.on(Hls.Events.ERROR,(_e,event)=>{if(token===receiverToken&&event.fatal){disconnect();say("Receiver failed. Recheck station and tune again.");}});
    hls.attachMedia(audio);
  }else say("HLS unsupported. Use the direct playlist link in VLC.");
}
for(const s of STATIONS){
  const card=make("article",""),title=make("h3",s.name),status=make("p","Signal not checked"),meta=make("p",""),history=make("p","No robot history"),button=make("button","Tune in");
  status.className="signal";history.className="metrics";button.disabled=true;button.addEventListener("click",()=>tune(s.id));
  const link=make("a","HLS playlist");link.href=stationURL(s.id,"live.m3u8");
  card.append(title,make("small",s.id),status,meta,history,button,make("p",""),link);$("stations").append(card);
  cards.set(s.id,{status,meta,history,button});
}
const span=ms=>{const sec=Math.floor(ms/1000);return [Math.floor(sec/3600),Math.floor(sec/60)%60,sec%60].map(n=>String(n).padStart(2,"0")).join(":");};
function renderLedger(){
  if(!rawLedger)return;const values=ledgerView(rawLedger);
  for(const [id,c] of cards){
    const r=values.get(id);
    c.history.textContent=r?"Robot observation: "+r.latest_state+"\nLatest: "+r.last_observation+
      "\nCurrent sampled span: "+span(r.current_sampled_span_ms)+"\nLongest sampled span: "+span(r.longest_sampled_span_ms):"No robot history";
  }
}
async function refresh(){
  if(busy)return;busy=true;$("refresh").disabled=true;
  try{
    const reports=await Promise.all(STATIONS.map(s=>stationHealth(s.id)));
    for(const r of reports){const c=cards.get(r.id);c.status.dataset.state=r.state;
      c.status.textContent=r.state==="worker-reports-on-air"?"Worker reports on air":r.state==="unpublished"?"Not published":"Signal unconfirmed";
      c.meta.textContent=[r.title,r.revision,r.age_seconds==null?"":"Playlist age: "+r.age_seconds+"s"].filter(Boolean).join(" · ");
      c.button.disabled=r.state!=="worker-reports-on-air";}
    $("checked").textContent="Checked "+new Date().toLocaleTimeString();renderLedger();
  }finally{busy=false;$("refresh").disabled=false;}
}
async function jsonFile(file){
  if(!file||file.size>12*1024*1024)throw Error("Select a JSON file under 12 MB");
  return JSON.parse(await file.text());
}
$("refresh").addEventListener("click",refresh);
$("stop").addEventListener("click",()=>{disconnect();say("Receiver disconnected.");});
audio.addEventListener("playing",()=>say("Receiver playing. This is a local listening session."));
$("ledger").addEventListener("change",async e=>{
  try{const raw=await jsonFile(e.target.files[0]);ledgerView(raw);rawLedger=raw;renderLedger();$("ledger-state").textContent="Local summary loaded. Sampled spans are not continuous uptime.";}
  catch(e){rawLedger=null;for(const c of cards.values())c.history.textContent="No valid robot history";$("ledger-state").textContent=e.message;}
});
$("programs").addEventListener("change",async e=>{
  try{const files=[...e.target.files];if(files.length<1||files.length>3)throw Error("Select one to three station exports");
    const result=inventory(await Promise.all(files.map(jsonFile)));
    $("inventory").textContent="Selected stations: "+result.stations+"\nTrack appearances across revisions: "+result.appearances+"\nUnique encoded assets: "+result.unique_assets+"\nShared across stations: "+result.shared_assets+"\nUnique segment objects: "+result.unique_segments;}
  catch(e){$("inventory").textContent=e.message;}
});
$("draft").addEventListener("click",async()=>{
  $("commands").textContent="";
  try{const id=$("target").value,draft=draftCrate(await jsonFile($("crate").files[0]),id),filename=id+"-review-crate.json";
    const url=URL.createObjectURL(new Blob([JSON.stringify(draft,null,2)],{type:"application/json"}));
    const a=document.createElement("a");a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    $("draft-state").textContent="Draft exported: "+draft.tracks.length+" entries. Not published. Review eligibility and exact running order.";
    $("commands").textContent="Preview only (from repository root):\npython tools/radio-broadcast/autopilot_publisher.py --input "+filename;
  }catch(e){$("draft-state").textContent=e.message;}
});
setInterval(()=>{if(!document.hidden)renderLedger();},15000);
void refresh();
