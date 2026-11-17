/* Optional HUMKIN Orchard listener bridge for the existing FM player.
 * No extra audio, no autoplay and no synthetic Top 42 "plays".
 * Rewards are exclusively local: no network wallet or wallet API.
 */
(function(){
"use strict";
const M=window.HumkinOrchard,N=window.HumkinNightWatch;
const audio=document.getElementById("air");
if(!M||!audio)return;
let last=null,frames=0,lastRecording="";
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
 const info=window.HUMKIN_RADIO&&window.HUMKIN_RADIO.state.currentTrack;
 const recording=info&&info.id||"";
 if(lastRecording!==recording){last=null;lastRecording=recording}
 if(last===null){last=now;return}
 const delta=now-last;last=now;
 if(delta<=0||delta>5)return;
 const state=M.read(store);
 const oldLevel=M.level(state.xp);
 const at=Date.now();
 const result=M.listen(state,delta,at);
 if(N)N.note(store,{at,seconds:delta,trackId:recording,title:info&&info.title||"",kind:info&&info.kind||"song",
   previousLevel:oldLevel,level:M.level(state.xp),find:result.discover?M.item(result.discover.type)?.name||"":""});
 state.lastSeen=at;
 M.save(store,state);
 if(result.discover||oldLevel!==M.level(state.xp)||++frames%10===0)paint();
});
window.addEventListener("storage",paint);
paint();
})();
