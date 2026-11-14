/* HUMKIN RADIO — deterministic bumper insertion.
 * A genuine on-air station ID is a recording marked BUMPER, never synthesized
 * or invented from text. Default cadence 0 preserves the original rotation.
 *
 * The same ordered bumpers appear each round so every rotation has an identical
 * total duration; Same-Time listeners can calculate the same track and offset.
 */
(function(root){
"use strict";
function cadenceValue(value){
 const v=Number(value);
 return Number.isInteger(v)&&v>=1&&v<=20?v:0;
}
function insertBumpers(songs,bumpers,every){
 const result=[],frequency=cadenceValue(every);
 if(!Array.isArray(songs)||!Array.isArray(bumpers))return result;
 const validBumpers=bumpers.filter(x=>Number.isInteger(x)&&x>=0);
 for(let i=0;i<songs.length;i++){
   result.push(songs[i]);
   if(frequency&&validBumpers.length&&(i+1)%frequency===0){
     const index=Math.floor((i+1)/frequency)-1;
     result.push(validBumpers[index%validBumpers.length]);
   }
 }
 return result;
}
function lengthMs(order,tracks){
 return order.reduce((ms,i)=>ms+Math.max(0,Math.round(Number(tracks[i]?.duration||0)*1000)),0);
}
const api=Object.freeze({cadenceValue,insertBumpers,lengthMs});
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.HUMKIN_AUTODJ=api;
})(typeof window!=="undefined"?window:globalThis);
