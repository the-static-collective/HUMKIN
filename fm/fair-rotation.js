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
// An extra slot per curated release or single; optionally add explicit
// seasonal slots. Preserve base order and clock seam guards between cycles.
function weightedCycle(n,number,shuffle,featuredPositions,extraPositions=[]){
 const base=cycle(n,number,shuffle);
 const featured=[...new Set((Array.isArray(featuredPositions)?featuredPositions:[])
   .filter(i=>Number.isInteger(i)&&i>=0&&i<n))];
 // Supplemental seasonal slots deliberately allow duplicate positions.
 // The editor determines the total target count (usually 3 including base).
 const extra=(Array.isArray(extraPositions)?extraPositions:[])
   .filter(i=>Number.isInteger(i)&&i>=0&&i<n);
 const bonuses=[...featured,...extra];
 if(!bonuses.length)return base;
 const bonus=shuffle(bonuses.length,(number^0x548e4ad5)>>>0).map(i=>bonuses[i]);
 const guard=Math.min(4,Math.floor(n/4)),interior=n-2*guard;
 if(interior<1)return base.concat(bonus);
 const out=base.slice(0,guard),bonusLocations=[];
 let added=0;
 for(let i=guard;i<n-guard;i++){
   const due=Math.floor((i-guard+1)*bonuses.length/interior);
   while(added<due){
     let slot=bonus.findIndex(id=>!out.slice(-4).includes(id)&&
       !base.slice(i,Math.min(n,i+4)).includes(id));
     if(slot<0)slot=bonus.findIndex(id=>!out.slice(-4).includes(id));
     if(slot<0)slot=0;
     bonusLocations.push(out.length);
     out.push(bonus.splice(slot,1)[0]);added++;
   }
   out.push(base[i]);
 }
 out.push(...base.slice(n-guard));
 // Repair rare near-repeat collisions by exchanging *only* bonus slots.
 // The base order and protected beginning/end of every cycle never move.
 const penalty=()=>{
   let total=0;
   for(let i=1;i<out.length;i++)
     for(let d=1;d<=4&&d<=i;d++)
       if(out[i]===out[i-d])total+=5-d;
   return total;
 };
 let current=penalty();
 for(let attempts=0;attempts<8&&current>0;attempts++){
   let improved=false;
   for(const i of bonusLocations){
     if(!out.slice(Math.max(0,i-4),i).includes(out[i]) &&
        !out.slice(i+1,i+5).includes(out[i]))continue;
     for(const j of bonusLocations){
       if(i===j||out[i]===out[j])continue;
       [out[i],out[j]]=[out[j],out[i]];
       const candidate=penalty();
       if(candidate<current){current=candidate;improved=true;break;}
       [out[i],out[j]]=[out[j],out[i]];
     }
     if(improved)break;
   }
   if(!improved)break;
 }
 return out;
}
const api=Object.freeze({mix,cycle,weightedCycle});
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.HUMKIN_FAIR_ROTATION=api;
})(typeof window!=="undefined"?window:globalThis);
