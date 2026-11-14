(()=>{"use strict";
const $=id=>document.getElementById(id);
async function openHouse(){
 try{
  const [registryRes,stationRes]=await Promise.all([
   fetch("./sources.json",{cache:"no-cache"}),
   fetch("../rotation.json",{cache:"no-cache"})
  ]);
  if(!registryRes.ok||!stationRes.ok)throw Error("Station registry unavailable");
  const worlds=window.HUMKIN_RADIO_HOUSE.validate(await registryRes.json());
  window.HUMKIN_RADIO_HOUSE.render($("worlds"),worlds);
  const station=await stationRes.json();
  const status=$("transmitter");
  if(typeof station.live_stream_url==="string"&&
     window.HUMKIN_RADIO_HOUSE.https(station.live_stream_url)){
   status.textContent="PUBLIC STREAM CONFIGURED · verify real playback at the main receiver";
  }else{
   status.textContent="BROWSER RADIO ON · DEDICATED TRANSMITTER NOT YET CONNECTED";
  }
 }catch(err){
  $("worlds").textContent="Source registry unavailable. Use each organization's official website directly.";
  $("transmitter").textContent="Signal configuration unavailable · check network and refresh.";
 }
}
openHouse();
})();