/* HUMKIN RADIO — Bumper Brain v1.
 * Deterministic, offline, reversible. No text generation and no new broadcast
 * material is manufactured in a listener's browser.
 * A break plan depends on the PUBLIC eligible cart catalog and owner's
 * versioned editorial policy, not on device RNG, clock or listener identity.
 * This keeps Same-Time RADIO's calculated rotation length consistent.
 */
(function(root){
"use strict";
const normalize=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
function classify(track,policy={}){
 const id=String(track?.id||"");
 const raw=policy.profiles?.[id]||{};
 const title=normalize(track?.title);
 const seconds=Number(track?.duration??track?.duration_seconds??0);
 let family=raw.family||title.replace(/\b(opener|trains|short|long|radio|edit|remastered)\b/g,"")
   .replace(/\s+/g," ").trim()||id;
 // A program opening is a scheduled item, not an incidental station ID.
 let role=raw.role||(
   /\b(opener|opening|intro for)\b/.test(title)?"show_opener":
   seconds>50?"feature":
   /\b(hard dark train|taken minute)\b/.test(title)?"musical":
   seconds<=19?"station_id":
   /\b(farm|news|manager|art is|schfwifty)\b/.test(title)?"character":
   seconds<=28?"station_id":"comedy"
 );
 const safetyHold=/\b(top of the hour|bottom of the hour|requests we re taking|we re taking requests)\b/.test(title);
 const hardMax=Number(policy.maximum_break_seconds)||49;
 const hold=raw.hold===true||role==="show_opener"||role==="feature"||
   seconds>hardMax||seconds<=0||safetyHold;
 return {id,title:track?.title||id,seconds,role,family,hold,
  reason:raw.hold?"OWNER PROFILE HOLD":role==="show_opener"?"SHOW OPENER — scheduled only":
   role==="feature"||seconds>hardMax?"FEATURE — requires a show slot":
   safetyHold?"TIME/REQUEST CLAIM — requires manual program slot":""};
}
function cadenceBreaks(songCount,every,policy={}){
 const frequency=Number(every);
 if(!Number.isInteger(frequency)||frequency<1||frequency>20||songCount<1)return [];
 const out=[];
 // Fixed *variation* across the whole shared rotation (never wall-clock
 // random): 4/5/3/4/6/3 etc. One deterministic plan for all receivers.
 const variation=policy.variable_cadence===true&&frequency>=4?
   [0,1,-1,0,2,-1,0]:[0];
 let next=0,n=0;
 while(next<songCount){
   next+=Math.max(2,frequency+variation[n%variation.length]);
   if(next<=songCount)out.push(next);
   n++;
 }
 return out;
}
function hash(text){
 let x=2166136261;
 for(let i=0;i<text.length;i++){x^=text.charCodeAt(i);x=Math.imul(x,16777619)}
 return x>>>0;
}
// Each distinct, published/enabled and routine-eligible bumper gets one
// turn per shuffled bag, regardless of FIELD / PREVIEW / INBOX filing label,
// length, fictional voice, or editorial role. Only explicit safety/program
// holds affect eligibility. The plan remains deterministic across receivers.
function bagOf(eligible,round,lastId){
 const bag=eligible.slice().sort((a,b)=>a.id.localeCompare(b.id));
 let state=hash("HUMKIN-BUMPER-BAG-"+round)||1;
 const random=()=>{state=(state+0x6d2b79f5)>>>0;let x=state;
   x=Math.imul(x^(x>>>15),x|1);x^=x+Math.imul(x^(x>>>7),x|61);
   return ((x^(x>>>14))>>>0)/4294967296};
 for(let i=bag.length-1;i>0;i--){
  const j=Math.floor(random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];
 }
 if(bag.length>1&&bag[0].id===lastId)[bag[0],bag[1]]=[bag[1],bag[0]];
 return bag;
}
function plan(songs,bumpers,every,tracks,policy={}){
 const base=Array.isArray(songs)?songs.slice():[];
 if(!Array.isArray(bumpers)||!Array.isArray(tracks)||!Number.isInteger(Number(every)))
  return {sequence:base,breaks:[],held:[],eligible:0};
 const inventory=bumpers.filter(i=>Number.isInteger(i)&&tracks[i])
   .map(i=>({...classify(tracks[i],policy),index:i}));
 const held=inventory.filter(x=>x.hold);
 const eligible=inventory.filter(x=>!x.hold);
 const breaks=[],sequence=[];
 const positions=cadenceBreaks(base.length,every,policy);
 let breakIndex=0,next=positions[0]||Infinity,round=0,bag=[],lastId=null;
 for(let i=0;i<base.length;i++){
   sequence.push(base[i]);
   if(i+1!==next||!eligible.length)continue;
   if(!bag.length)bag=bagOf(eligible,round++,lastId);
   const chosen=bag.shift();
   sequence.push(chosen.index);
   lastId=chosen.id;
   breaks.push({number:breakIndex+1,afterSong:i+1,index:chosen.index,
     id:chosen.id,title:chosen.title,role:chosen.role,family:chosen.family,
     seconds:chosen.seconds,rare:chosen.seconds>28});
   breakIndex++;
   next=positions[breakIndex]||Infinity;
 }
 return {sequence,breaks,held,eligible:eligible.length};
}
const api=Object.freeze({normalize,classify,cadenceBreaks,plan});
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.HUMKIN_BUMPER_BRAIN=api;
})(typeof window!=="undefined"?window:globalThis);
