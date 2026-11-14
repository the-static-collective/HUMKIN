/* HUMKIN RADIO — shared station reference clock and gentle drift control.
 *
 * The browser station is still client-side playout, not an Icecast source.
 * Compare a few low-latency timestamp responses from the same server so two
 * devices don't inherit different phone/computer wall-clock offsets.
 * Keep music in one piece: correct initial TUNE IN, then adjust playbackRate
 * gently only when the current song matches the shared program and drift is
 * small. Never jump forward mid-song as a background "sync" operation.
 */
(function(root){
"use strict";
const MAX_RTT_MS=2000,MAX_OFFSET_MS=10*60*1000;
const MAX_RATE_DELTA=.018;
function clamp(value,min,max){return Math.min(max,Math.max(min,value))}
function chooseSample(samples){
 const valid=(Array.isArray(samples)?samples:[]).filter(s=>
   Number.isFinite(s?.offsetMs)&&Number.isFinite(s?.rttMs)&&
   s.rttMs>=0&&s.rttMs<=MAX_RTT_MS&&
   Math.abs(s.offsetMs)<=MAX_OFFSET_MS);
 valid.sort((a,b)=>a.rttMs-b.rttMs);
 return valid[0]||null;
}
function rateForDrift(driftSeconds){
 const drift=Number(driftSeconds);
 // Even if the browser buffers for 18 seconds, never speed it into a skip.
 if(!Number.isFinite(drift)||Math.abs(drift)>2.4||Math.abs(drift)<.12)return 1;
 return clamp(1+drift*.015,1-MAX_RATE_DELTA,1+MAX_RATE_DELTA);
}
async function calibrate(fetcher,api,key,now=()=>Date.now()){
 if(typeof fetcher!=="function")return {offsetMs:0,rttMs:null,synced:false};
 const endpoint=api+"/rest/v1/rpc/humkin_radio_clock_ms";
 async function sample(){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),1750);
  try{
   const sent=now();
   const response=await fetcher(endpoint,{method:"GET",cache:"no-store",
     headers:{apikey:key},signal:controller.signal});
   if(!response.ok)return null;
   const raw=await response.json();
   const received=now();
   const remote=Number(raw);
   const rttMs=received-sent;
   if(!Number.isFinite(remote))return null;
   return {offsetMs:remote-(sent+received)/2,rttMs};
  }catch{return null}finally{clearTimeout(timeout)}
 }
 // Parallel requests limit startup delay while still obtaining a low-RTT
 // sample. The station plays normally even if its backend clock is offline.
 const best=chooseSample(await Promise.all([sample(),sample()]));
 return best?{...best,synced:true}:{offsetMs:0,rttMs:null,synced:false};
}
const api=Object.freeze({MAX_RATE_DELTA,chooseSample,rateForDrift,calibrate});
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.HUMKIN_CLOCK_SYNC=api;
})(typeof window!=="undefined"?window:globalThis);
