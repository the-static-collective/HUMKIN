import {projectTimeline,readTimeline} from "./rolling-timeline-core.mjs";
const $=id=>document.getElementById(id);
const el=(tag,value)=>{const node=document.createElement(tag);if(value!==undefined)node.textContent=value;return node;};
const central=new Intl.DateTimeFormat("en-US",{timeZone:"America/Chicago",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",second:"2-digit",timeZoneName:"short"});
export function mountRollingTimeline(){
 const root=$("rolling-timeline");if(!root)return;
 const select=$("feature-station"),horizon=$("rolling-horizon"),refresh=$("rolling-refresh"),auto=$("rolling-auto"),list=$("rolling-committed");
 let activeStation=select.value,snapshot=null,received=0,controller=null,serial=0,timer=null,state="idle";
 const visible=()=>!document.hidden&&!root.closest("[hidden]");
 function render(){
  list.replaceChildren();const title=$("rolling-now"),meta=$("rolling-receipt"),pending=$("rolling-pending");
  title.textContent="No verified current cue";pending.textContent="";
  if(!snapshot){meta.textContent=state==="unpublished"?"No published Cloud HOUSE for this frequency. Build an independent draft below.":state==="loading"?"Reading published schedule…":state==="error"?"Schedule unavailable. No live state inferred.":"Select Refresh to read this frequency.";return;}
  let view;try{view=projectTimeline(snapshot.raw,snapshot.nowPlaying,activeStation,Number(horizon.value));}catch(e){meta.textContent=e.message;return;}
  const stale=state==="error"||Date.now()-received>90000||Math.abs(received-view.asOf)>120000;
  const currentStillInWindow=view.current&&view.clock+Math.max(0,Date.now()-received)<view.current.end;
  if(view.current)title.textContent=view.current.title+" — "+(view.confirmed&&!stale&&currentStillInWindow?"Worker-confirmed at sample":"Schedule cue only");
  else title.textContent="No current cue reported";
  meta.textContent=(stale?"STALE / LAST KNOWN · ":state==="loading"?"REFRESHING · ":"")+central.format(view.asOf)+" · "+view.revision+" · "+(view.onAir?"media window reported available at sample":"media not reported on air")+" · not listener playback proof.";
  for(const cue of view.rows){
   const row=el("li");row.className="rolling-cue"+(cue.current?" rolling-current":"");
   const time=el("span",central.format(cue.start)+" → "+central.format(cue.end));time.className="rolling-time";
   const body=el("div");body.append(el("strong",cue.title),el("small",cue.artist+" · "+cue.revision));
   const label=el("span",cue.current?"Sampled cue":"Committed");label.className="rolling-lock";row.append(time,body,label);list.append(row);
  }
  if(!view.rows.length)list.append(el("li","No published cues in the chosen horizon."));
  if(view.limited||view.coveredUntil===null||view.coveredUntil<view.deadline)list.append(el("li","Published response does not cover the entire requested window. No extra cues inferred."));
  if(view.pending.length)pending.textContent="Published revision boundaries: "+view.pending.map(p=>central.format(p.at)+" · "+p.revision).join(" | ");
 }
 function cancel(){serial++;controller?.abort();controller=null;refresh.disabled=false;clearTimeout(timer);}
 function arm(){clearTimeout(timer);if(auto.checked&&visible())timer=setTimeout(load,60000);}
 async function load(){
  if(controller||!visible())return;
  const id=++serial,station=activeStation,c=new AbortController();controller=c;refresh.disabled=true;state="loading";render();
  const timeout=setTimeout(()=>c.abort(),15000);
  try{const data=await readTimeline(station,c.signal);if(id!==serial||station!==activeStation)return;
   if(data.unpublished){snapshot=null;state="unpublished";}else{projectTimeline(data.raw,data.nowPlaying,station,Number(horizon.value));snapshot=data;received=Date.now();state="ready";}
  }catch{if(id===serial)state="error";}
  finally{clearTimeout(timeout);if(id===serial){controller=null;refresh.disabled=false;render();arm();}}
 }
 function sync(){if(activeStation!==select.value){cancel();activeStation=select.value;snapshot=null;state="idle";render();if(visible())load();return;}
  if(!visible()){cancel();if(state==="loading")state=snapshot?"ready":"idle";return;}
  render();if(!snapshot||Date.now()-received>60000)load();else arm();
 }
 select.addEventListener("change",sync);horizon.addEventListener("change",render);refresh.addEventListener("click",load);
 auto.addEventListener("change",()=>{if(auto.checked)sync();else clearTimeout(timer);});
 window.addEventListener("hashchange",()=>requestAnimationFrame(sync));document.addEventListener("visibilitychange",sync);
 render();requestAnimationFrame(sync);
 // Staleness and sampled-cue expiration do not trigger new network requests.
 setInterval(()=>{if(visible()&&snapshot)render();},15000);
}
