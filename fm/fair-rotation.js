/* HUMKIN RADIO — fair, era-mixed deterministic rotation.
 * Catalog order is the chronology proxy: website records first, then cloud
 * crate in published_at ascending order. This is NOT the composition date.
 * Each song still appears exactly once per cycle. Interleave the oldest,
 * middle, and newest thirds like a classic-hits-and-today station, without
 * a rigid old/new alternation or extra plays for newly uploaded material.
 */
(function(root){"use strict";
function mix(n,number,shuffle){
 if(!Number.isInteger(n)||n<0||!Number.isInteger(number)||typeof shuffle!=="function")
   throw Error("Invalid era rotation");
 const shuffled=shuffle(n,number);
 if(n<9)return shuffled; // Small crates should stay truly random.
 const first=Math.floor(n/3),second=Math.floor(2*n/3);
 const lanes=[[],[],[]];
 for(const i of shuffled)lanes[i<first?0:i<second?1:2].push(i);
 const totals=lanes.map(a=>a.length),played=[0,0,0],out=[];
 let state=(number^0xb7e15162)>>>0;
 const random=()=>{state=(state+0x6d2b79f5)>>>0;let x=state;
   x=Math.imul(x^(x>>>15),x|1);x^=x+Math.imul(x^(x>>>7),x|61);
   return ((x^(x>>>14))>>>0)/4294967296;};
 let last=-1,run=0;
 for(let slot=0;slot<n;slot++){
   let chosen=-1,best=-Infinity;
   for(let lane=0;lane<3;lane++){
     if(!lanes[lane].length)continue;
     // A lane falls behind when it has received fewer plays than its
     // proportional share. Small seeded jitter prevents a clockwork pattern.
     const due=(slot+1)*totals[lane]/n-played[lane];
     const repeat=lane===last?(run>=2?5:0.15):0;
     const score=due+random()*0.9-repeat;
     if(score>best){best=score;chosen=lane;}
   }
   out.push(lanes[chosen].shift());
   played[chosen]++;
   if(chosen===last)run++;else{last=chosen;run=1;}
 }
 return out;
}
function cycle(n,number,shuffle){
 if(!Number.isInteger(n)||n<0||!Number.isInteger(number)||typeof shuffle!=="function")
   throw Error("Invalid fair rotation");
 if(n===0)return [];
 // A fixed order for tiny catalogs naturally keeps distinct cycle edges.
 if(n<8)return shuffle(n,0);
 const current=mix(n,number,shuffle);
 const previous=mix(n,number-1,shuffle);
 const guard=Math.min(4,Math.floor(n/4));
 const recent=new Set(previous.slice(-guard));
 // The tail remains unchanged, so the next cycle can reconstruct this seam.
 for(let i=0;i<guard;i++){
   if(!recent.has(current[i]))continue;
   const replacement=current.findIndex((id,j)=>
     j>=guard&&j<n-guard&&!recent.has(id));
   if(replacement>=guard)[current[i],current[replacement]]=
     [current[replacement],current[i]];
 }
 return current;
}
const api=Object.freeze({mix,cycle});
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.HUMKIN_FAIR_ROTATION=api;
})(typeof window!=="undefined"?window:globalThis);
