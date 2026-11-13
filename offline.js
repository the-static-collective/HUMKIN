(()=>{"use strict";
const button=document.getElementById("save-offline"),status=document.getElementById("offline-status");
if(!button||!status||!("serviceWorker" in navigator)||!window.isSecureContext)return;
navigator.serviceWorker.register("./sw.js").then(()=>{
  button.hidden=false;
  button.addEventListener("click",async()=>{
    button.disabled=true;status.textContent="Getting the pocket record ready…";
    try{
      const reg=await navigator.serviceWorker.ready;
      if(!reg.active)throw Error("Offline worker unavailable");
      const channel=new MessageChannel();
      channel.port1.onmessage=event=>{
        const data=event.data||{};
        if(data.type==="progress")status.textContent="Saved "+data.success+" of "+data.total+" songs"+(data.failed?" ("+data.failed+" couldn't save)":"")+".";
        if(data.type==="done"){status.textContent=data.failed?"Saved "+data.success+" songs; "+data.failed+" need another try.":"All 12 songs saved to this browser for offline listening. ✳";button.disabled=false;channel.port1.close()}
        if(data.type==="error"){status.textContent=data.message||"Could not save right now.";button.disabled=false;channel.port1.close()}
      };
      reg.active.postMessage({type:"SAVE_HUMKIN_ALBUM"},[channel.port2]);
    }catch{status.textContent="Offline save isn't available on this device right now.";button.disabled=false}
  });
}).catch(()=>{});
})();