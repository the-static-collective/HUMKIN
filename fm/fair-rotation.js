/* HUMKIN RADIO — deterministic fair rotation.
 * Every song appears exactly once per shared-clock cycle.
 * Guard the cycle seam so a new rotation doesn't immediately replay
 * records near the end of the previous one. Shared-clock order stays
 * identical across listeners and needs no persistent tracking.
 */
(function(root){"use strict";
function cycle(n,number,shuffle){
 if(!Number.isInteger(n)||n<0||!Number.isInteger(number)||typeof shuffle!=="function")
   throw Error("Invalid fair rotation");
 if(n===0)return [];
 // Very short libraries: a stable permutation has a naturally non-repeating seam.
 // Larger libraries get a fresh seeded permutation every round.
 if(n<8)return shuffle(n,0);
 const current=shuffle(n,number);
 const previous=shuffle(n,number-1);
 const guard=Math.min(4,Math.floor(n/4));
 const recent=new Set(previous.slice(-guard));
 // Only change the start of this cycle. Its last 'guard' songs remain
 // untouched, so the following cycle can reconstruct this seam from the
 // original seeded order without recursive history.
 for(let i=0;i<guard;i++){
   if(!recent.has(current[i]))continue;
   const replacement=current.findIndex((id,j)=>
     j>=guard&&j<n-guard&&!recent.has(id));
   if(replacement>=guard)[current[i],current[replacement]]=
     [current[replacement],current[i]];
 }
 return current;
}
const api=Object.freeze({cycle});
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.HUMKIN_FAIR_ROTATION=api;
})(typeof window!=="undefined"?window:globalThis);
