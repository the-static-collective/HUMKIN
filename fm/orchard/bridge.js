/* Optional HUMKIN Orchard listener bridge for the existing FM player.
 * No extra audio, no autoplay and no synthetic Top 42 "plays".
 * Rewards are exclusively local: no network wallet or wallet API.
 */
(function(){
"use strict";
const M=window.HumkinOrchard;
const audio=document.getElementById("air");
if(!M||!audio)return;
let last=null,frames=0;
const store=(()=>{try{return localStorage}catch{return null}})();
if(!store)return;
function paint(){
 const state=M.read(store);
 const label=document.getElementById("orchard-radio-stats");
 if(label)label.textContent="LEVEL "+M.level(state.xp)+" · "+state.hum.toLocaleString()+" HUM · "+state.inventory.length+" THINGS COLLECTED";
}
audio.addEventListener("seeking",function(){last=null});
audio.addEventListener("loadedmetadata",function(){last=null});
audio.addEventListener("timeupdate",function(){
 if(audio.paused||audio.seeking||audio.readyState<2)return;
 const now=audio.currentTime;
 if(!Number.isFinite(now))return;
 if(last===null){last=now;return}
 const delta=now-last;last=now;
 if(delta<=0||delta>5)return;
 const state=M.read(store);
 const oldLevel=M.level(state.xp);
 const result=M.listen(state,delta,Date.now());
 state.lastSeen=Date.now();
 M.save(store,state);
 if(result.discover||oldLevel!==M.level(state.xp)||++frames%10===0)paint();
});
window.addEventListener("storage",paint);
paint();
})();
