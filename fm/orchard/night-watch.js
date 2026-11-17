/* NIGHT WATCH 001 — observed local playback history, never estimated airtime.
 * A session ends after 30 minutes without confirmed audio progress.
 * This records local device events only, not a server-side listening certificate.
 */
(function(root,factory){
 const api=factory();
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 root.HumkinNightWatch=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
const KEY="humkin-night-watch-v1",VERSION=1,GAP=30*60*1000,QUALIFIED=20;
const MAX_WATCHES=14,MAX_TRACKS=250,MAX_KNOWN=1500;
const saneString=(value,limit)=>typeof value==="string"?value.slice(0,limit):"";
const safeTime=n=>Number.isFinite(n)&&n>=0?Math.floor(n):0;
function fresh(){return {version:VERSION,known:[],watches:[],readReportId:""}}
function normalize(raw){
 const state=fresh();
 if(!raw||raw.version!==VERSION)return state;
 state.known=Array.isArray(raw.known)?[...new Set(raw.known.filter(x=>typeof x==="string").map(x=>x.slice(0,180)))].slice(-MAX_KNOWN):[];
 state.readReportId=saneString(raw.readReportId,40);
 if(!Array.isArray(raw.watches))return state;
 state.watches=raw.watches.slice(-MAX_WATCHES).filter(w=>w&&typeof w.id==="string").map(function(w){
  return {
   id:saneString(w.id,40),
   startedAt:safeTime(w.startedAt),
   lastAt:safeTime(w.lastAt),
   seconds:Number.isFinite(w.seconds)?Math.max(0,Math.min(w.seconds,10000000)):0,
   tracks:Array.isArray(w.tracks)?w.tracks.slice(0,MAX_TRACKS).filter(t=>t&&typeof t.id==="string").map(t=>({
    id:saneString(t.id,180),title:saneString(t.title,100),
    kind:t.kind==="bumper"?"bumper":"song",
    seconds:Number.isFinite(t.seconds)?Math.max(0,Math.min(t.seconds,1000000)):0,
    firstHeard:!!t.firstHeard
   })):[],
   finds:Array.isArray(w.finds)?w.finds.slice(0,32).map(x=>saneString(x,80)).filter(Boolean):[],
   levels:Array.isArray(w.levels)?w.levels.filter(x=>Number.isInteger(x)&&x>=1&&x<=1000).slice(0,32):[]
  };
 });
 return state;
}
function read(store){
 try{return normalize(JSON.parse(store.getItem(KEY)))}catch{return fresh()}
}
function save(store,state){
 try{store.setItem(KEY,JSON.stringify(state));return true}catch{return false}
}
function note(store,event){
 const at=safeTime(event&&event.at)||Date.now();
 const seconds=Number(event&&event.seconds);
 if(!Number.isFinite(seconds)||seconds<=0||seconds>5)return {ok:false};
 const state=read(store);
 let watch=state.watches[state.watches.length-1];
 if(!watch||at<watch.lastAt||at-watch.lastAt>GAP){
  watch={id:String(at),startedAt:at,lastAt:at,seconds:0,tracks:[],finds:[],levels:[]};
  state.watches.push(watch);
  state.watches=state.watches.slice(-MAX_WATCHES);
 }
 watch.lastAt=at;watch.seconds+=seconds;
 const id=saneString(event.trackId,180),title=saneString(event.title,100);
 if(id){
  let track=watch.tracks.find(x=>x.id===id);
  if(!track&&watch.tracks.length<MAX_TRACKS){
   track={id,title:title||"UNLABELED RECORDING",kind:event.kind==="bumper"?"bumper":"song",seconds:0,firstHeard:false};
   watch.tracks.push(track);
  }
  if(track){
   track.seconds+=seconds;
   if(track.seconds>=QUALIFIED&&!state.known.includes(id)){
    track.firstHeard=true;
    state.known.push(id);
    state.known=state.known.slice(-MAX_KNOWN);
   }
  }
 }
 const find=saneString(event.find,80);
 if(find&&!watch.finds.includes(find)&&watch.finds.length<32)watch.finds.push(find);
 const before=Number(event.previousLevel),after=Number(event.level);
 if(Number.isInteger(before)&&Number.isInteger(after)&&after>before&&after<=1000){
  for(let lvl=before+1;lvl<=after&&watch.levels.length<32;lvl++)
   if(!watch.levels.includes(lvl))watch.levels.push(lvl);
 }
 return {ok:save(store,state),state,watch};
}
function latestCompleted(state,now){
 const at=safeTime(now)||Date.now();
 return state.watches.slice().reverse().find(w=>w.seconds>0&&at-w.lastAt>=GAP)||null;
}
function stats(watch){
 const heard=watch.tracks.filter(t=>t.seconds>=QUALIFIED);
 return {
  minutes:Math.floor(watch.seconds/60),
  songCount:heard.filter(t=>t.kind==="song").length,
  bumperCount:heard.filter(t=>t.kind==="bumper").length,
  firstCount:heard.filter(t=>t.firstHeard&&t.kind==="song").length,
  finds:watch.finds.slice(),
  levels:watch.levels.slice()
 };
}
function acknowledge(store,id){
 const state=read(store);
 if(!state.watches.some(w=>w.id===id))return false;
 state.readReportId=id;return save(store,state);
}
return {KEY,VERSION,GAP,QUALIFIED,fresh,normalize,read,save,note,latestCompleted,stats,acknowledge};
});
