/* HUMKIN RADIO — one-hour track memory (per listening device).
 * Policy: Never repeat an eligible music recording within 60 minutes when
 * another eligible recording is available. Station IDs are exempt. If all
 * recordings have played within the hour, favor the least recently heard.
 */
(function(root){
"use strict";
const WINDOW_MS=60*60*1000,KEEP_MS=24*60*60*1000;
const KEY="humkin-radio-history-v1";
function lastTime(map,id){
  const n=Number(map?.get?.(id));
  return Number.isFinite(n)&&n>0?n:0;
}
function fresh(map,id,now,windowMs=WINDOW_MS){
 const t=lastTime(map,id);
 return !t || now-t>=windowMs || t>now+60*1000;
}
function freshFirst(indices,tracks,map,now){
 return [...indices].sort((a,b)=>{
  const af=fresh(map,tracks[a]?.id,now),bf=fresh(map,tracks[b]?.id,now);
  return (af===bf)?0:(af?-1:1);
 });
}
function chooseSlot(order,position,tracks,map,now){
 if(!order.length||position<0||position>=order.length)return -1;
 if(tracks[order[position]]?.kind==="bumper")return position;
 const positions=order.map((idx,i)=>i>=position&&tracks[idx]?.kind!=="bumper"?i:-1)
   .filter(i=>i>=0);
 if(!positions.length)return position;
 // Honor the already-shuffled pool among songs not heard in the last hour.
 const eligible=positions.find(p=>fresh(map,tracks[order[p]]?.id,now));
 if(eligible!==undefined)return eligible;
 // Short library / fast skipping: no way to satisfy the 60-minute exclusion.
 // Choose the least-recently played from remaining candidates instead.
 return positions.reduce((best,p)=>
   lastTime(map,tracks[order[p]]?.id)<lastTime(map,tracks[order[best]]?.id)?p:best
 ,positions[0]);
}
function anyFresh(indices,tracks,map,now){
 return indices.some(i=>fresh(map,tracks[i]?.id,now));
}
function load(storage,now){
 const result=new Map();
 try{
  const source=JSON.parse(storage?.getItem?.(KEY)||"[]");
  if(!Array.isArray(source))return result;
  for(const [id,ts] of source.slice(-3000)){
    const n=Number(ts);
    if(typeof id==="string"&&id.length<200&&n>now-KEEP_MS&&n<=now+60*1000)
      result.set(id,n);
  }
 }catch{}
 return result;
}
function save(storage,map,now){
 try{
  const records=[...map].filter(([id,t])=>typeof id==="string"&&t>now-KEEP_MS);
  storage?.setItem?.(KEY,JSON.stringify(records.slice(-2000)));
 }catch{}
}
const api=Object.freeze({WINDOW_MS,KEY,fresh,freshFirst,chooseSlot,anyFresh,load,save});
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.HUMKIN_ROTATION_MEMORY=api;
})(typeof window!=="undefined"?window:globalThis);
