/* HUMKIN Top 42 — deterministic chart share of music airtime.
 * The same previous-day Top 42 is held for the full Central-time station day.
 * This deliberately does not change the other 93% of music scheduling.
 * No network, telemetry, mutations or timer side effects in this module.
 */
(function(root){"use strict";
function seedDay(day) {
 let h=2166136261;
 for(const ch of String(day||"")){h=Math.imul(h^ch.charCodeAt(0),16777619)>>>0}
 return h>>>0;
}
function random(seed) {
 let state=seed>>>0;
 return function(){state=(state+0x6d2b79f5)>>>0;let x=state;
  x=Math.imul(x^(x>>>15),x|1);x^=x+Math.imul(x^(x>>>7),x|61);
  return ((x^(x>>>14))>>>0)/4294967296;
 };
}
function shuffle(list,rand){
 const out=[...list];
 for(let i=out.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[out[i],out[j]]=[out[j],out[i]]}
 return out;
}
function bonusIds(baseIndices,tracks,rankedIds,day){
 if(!Array.isArray(rankedIds)||!rankedIds.length||!baseIndices.length)return [];
 const indices=new Map(tracks.map((t,i)=>[t.id,i]));
 const ranked=[...new Set(rankedIds)].map(id=>indices.get(id))
   .filter(i=>i!==undefined&&tracks[i]?.kind!=="bumper");
 if(!ranked.length)return [];
 const musicMs=baseIndices.reduce((sum,i)=>sum+Number(tracks[i]?.duration||0)*1000,0);
 const targetMs=musicMs*7/93; // Additional chart music = 7% of final music time.
 if(!(targetMs>0))return [];
 const rand=random(seedDay(day)^0x42a1e42);
 const tiers=[shuffle(ranked.slice(0,7),rand),shuffle(ranked.slice(7,21),rand),
    shuffle(ranked.slice(21,42),rand)];
 const picks=[],counts=new Map();
 let playedMs=0;
 const max=Math.ceil(baseIndices.length*.12);
 let attempts=0;
 while(playedMs<targetMs&&picks.length<max&&attempts++<max*14){
   const roll=rand(),want=roll<.35?0:roll<.7?1:2;
   let selected=-1;
   for(let offset=0;offset<3;offset++){
     const tier=tiers[(want+offset)%3];
     if(!tier.length)continue;
     const choice=tier.find(i=>(counts.get(i)||0)<2);
     if(choice!==undefined){selected=choice;break}
   }
   if(selected<0)break;
   picks.push(selected);counts.set(selected,(counts.get(selected)||0)+1);
   playedMs+=Number(tracks[selected]?.duration||0)*1000;
   const tier=tiers.find(t=>t.includes(selected));
   if(tier){const pos=tier.indexOf(selected);tier.push(tier.splice(pos,1)[0]);}
 }
 return picks;
}
function weave(base,bonus){
 const out=[...base];
 if(!bonus?.length)return out;
 const used=[];
 for(let j=0;j<bonus.length;j++){
   const track=bonus[j];
   const preferred=Math.round((j+1)*(base.length+bonus.length)/(bonus.length+1));
   let position=Math.max(0,Math.min(out.length,preferred));
   // Stay within a few slots of the reserved interval while avoiding repeats.
   for(let d=0;d<=Math.min(6,out.length);d++){
     const candidates=d===0?[position]:[position+d,position-d];
     const found=candidates.find(at=>at>=0&&at<=out.length&&
       !out.slice(Math.max(0,at-4),Math.min(out.length,at+4)).includes(track));
     if(found!==undefined){position=found;break;}
   }
   out.splice(position,0,track);used.push(position);
 }
 return out;
}
const api=Object.freeze({seedDay,bonusIds,weave});
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.HUMKIN_TOP42_ROTATION=api;
})(typeof window!=="undefined"?window:globalThis);