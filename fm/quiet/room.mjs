import {createReceiver} from "../../fmstudio/receiver/engine.mjs";
import {streamForStation} from "../../fmstudio/receiver/core.mjs";
import {mountAtmosphere} from "./atmosphere.mjs";
const id="quiet-frequency", el=id=>document.getElementById(id);
const play=el("play"), signal=el("signal"), track=el("track"), art=el("art");
const motion=mountAtmosphere(el("weather"));const preference=matchMedia("(prefers-reduced-motion: reduce)");
el("motion").checked=!preference.matches;el("motion").addEventListener("change",e=>motion.setEnabled(e.target.checked));
let ready=false,checking=false,localArt=null;
const receiver=createReceiver(el("audio"),state=>{
  play.textContent=state.playing?"Pause":"Listen live";
  signal.textContent=state.status;
  track.textContent=state.track?[state.track.title,state.track.artist].filter(Boolean).join(" · "):"";
  if("mediaSession" in navigator&&typeof MediaMetadata!=="undefined"){try{navigator.mediaSession.metadata=state.mode==="idle"?null:new MediaMetadata({title:state.track?.title||"The Quiet Frequency",artist:state.track?.artist||"HUMKIN",album:"The Quiet Frequency"});}catch{}}
});
async function check(){
  if(checking)return;checking=true;el("check").disabled=true;const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),8000);
  try{const response=await fetch(streamForStation(id).status,{cache:"no-store",signal:ctrl.signal});const data=await response.json();
    ready=response.ok&&data.on_air===true&&data.frequency===id&&data.mode==="cloud_autopilot_hls";
    if(!receiver.state.playing)signal.textContent=ready?"Cloud signal available · press Listen live":data.mode==="cloud_autopilot_unpublished"?"Off air · awaiting approved cloud program":"Cloud signal unavailable · retry later";
  }catch{ready=false;if(!receiver.state.playing)signal.textContent="Unable to verify cloud signal · retry later";}
  finally{clearTimeout(timer);checking=false;play.disabled=!ready&&!receiver.state.playing;el("check").disabled=false;}
}
play.addEventListener("click",()=>{if(receiver.state.playing){receiver.pause();return;}if(!ready)return;receiver.tune(id);});
el("check").addEventListener("click",check);void check();setInterval(check,30000);
if("mediaSession" in navigator){try{navigator.mediaSession.setActionHandler("play",()=>{if(ready)receiver.tune(id);});navigator.mediaSession.setActionHandler("pause",()=>receiver.pause());navigator.mediaSession.setActionHandler("stop",()=>receiver.stop());}catch{}}
function missingArt(){art.hidden=true;el("weather").hidden=true;motion.setEnabled(false);el("art-note").hidden=false;}
art.addEventListener("error",missingArt);if(art.complete&&!art.naturalWidth)missingArt();
el("art-file").addEventListener("change",e=>{const file=e.target.files[0];if(!file||!file.type.startsWith("image/"))return;if(localArt)URL.revokeObjectURL(localArt);localArt=URL.createObjectURL(file);art.src=localArt;art.hidden=false;el("weather").hidden=false;el("art-note").hidden=true;motion.setEnabled(el("motion").checked);});
el("fullscreen").addEventListener("click",async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector("main").requestFullscreen();}catch{}});
