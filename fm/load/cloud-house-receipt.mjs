/* Read-only Cloud HOUSE receipt: no listener stats, R2 writes or secrets. */
const URL="https://humkin-long-wave.joyvolcanomusic.workers.dev/autopilot/station-one/schedule";
export function formatCloudReceipt(payload){
 if(!payload||payload.schema!=="humkin.autopilot.public-schedule/v1"||
    payload.station_id!=="station-one")
   return "Cloud program is not verifiable. Existing local and web radio are unaffected.";
 const count=payload.rotation_track_count,ms=payload.cycle_duration_ms;
 if(!Number.isInteger(count)||count<1||!Number.isFinite(ms)||ms<=0)
   return "Cloud schedule response is incomplete; no on-air claim.";
 const hours=(ms/3600000).toFixed(1),revision=String(payload.revision||"unknown").slice(0,90);
 return (payload.on_air===true?"CLOUD HLS WINDOW VERIFIED":"CLOUD HLS NOT YET VERIFIED")+
   " · "+count+" scheduled entries · "+hours+"h per cycle"+
   " · revision "+revision+
   (Array.isArray(payload.pending_revisions)&&payload.pending_revisions.length?
    " · "+payload.pending_revisions.length+" upcoming revision(s)":"")+
   ". This does not prove any particular device played a recording.";
}
export function mountCloudReceipt(){
 const root=document.getElementById("cloud-house-receipt");
 const button=document.getElementById("cloud-receipt-refresh");
 if(!root||!button)return;
 async function refresh(){
  button.disabled=true;
  root.textContent="Checking the current public Cloud HOUSE schedule…";
  try{
   const response=await fetch(URL,{cache:"no-store"});
   if(!response.ok)throw Error("HTTP "+response.status);
   root.textContent=formatCloudReceipt(await response.json());
  }catch(error){root.textContent="Cloud schedule unavailable ("+String(error?.message||"network")+
   "). No changes were sent; other radio modes remain available."}
  finally{button.disabled=false}
 }
 button.addEventListener("click",refresh);
 refresh();
 return {refresh};
}
