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
 // Identity is unique unless two files are proven different-length edits
 // of the SAME master. Voice, series, bells and topic are not an edit group.
 const family=id; // User-editable ATTRACT/REPEL groups are applied after shuffled bags.
 // A program opening is a scheduled item, not an incidental station ID.
 let role=raw.role||(
   /\b(opener|opening|intro for)\b/.test(title)?"show_opener":
   seconds>50?"feature":
   /\b(hard dark train|taken minute)\b/.test(title)?"musical":
   seconds<=19?"station_id":
   /\b(farm|news|manager|art is|schfwifty)\b/.test(title)?"character":
   seconds<=28?"station_id":"comedy"
 );
 const hardMax=Number(policy.maximum_break_seconds)||180;
 const shortMax=Number(policy.short_max_seconds)||19;
 const mediumMax=Number(policy.medium_max_seconds)||60;
 const lane=seconds<=shortMax?"short":seconds<mediumMax?"medium":"long";
 // Enabled/published is the eligibility decision. Only an actual owner
 // hold or a technical duration error can exclude an otherwise aired cart.
 const hold=raw.hold===true||policy.excluded_ids?.includes(id)||seconds>hardMax||seconds<=0;
 return {id,title:track?.title||id,seconds,role,family,lane,hold,
  reason:raw.hold===true?"EXPLICIT PROFILE HOLD":
   seconds>hardMax?"OVERSIZE — requires a show slot":
   seconds<=0?"INVALID DURATION":""};
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
// length, fictional voice, or editorial role. Only an explicitly configured
// owner hold or invalid technical duration affects eligibility.
// The plan remains deterministic across receivers.
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
// Every length group has its own equally weighted shuffled bag. Short
// IDs have more *opportunities*, not higher priority within any one slot.
// The golden-ratio phase adds an irregular 1–4-song pulse. Medium and long
// features follow approximate airtime targets; everything waits for the
// end of a whole song. Never stack multiple carts at the same boundary.
const PHI=(1+Math.sqrt(5))/2;
function phiGap(pulse,scale){
 const phase=((pulse+1)*PHI)%1;
 return Math.max(1,Math.round((1+Math.floor(phase*4))*scale));
}
function plan(songs,bumpers,every,tracks,policy={}){
 const base=Array.isArray(songs)?songs.slice():[];
 const frequency=Number(every);
 if(!Array.isArray(bumpers)||!Array.isArray(tracks)||!Number.isInteger(frequency))
  return {sequence:base,breaks:[],held:[],eligible:0};
 const inventory=bumpers.filter(i=>Number.isInteger(i)&&tracks[i])
   .map(i=>({...classify(tracks[i],policy),index:i}));
 const held=inventory.filter(x=>x.hold);
 const eligible=inventory.filter(x=>!x.hold);
 if(frequency<1||frequency>20||!base.length||!eligible.length)
  return {sequence:base,breaks:[],held,eligible:eligible.length};
 const groups={
   short:eligible.filter(x=>x.lane==="short"),
   medium:eligible.filter(x=>x.lane==="medium"),
   long:eligible.filter(x=>x.lane==="long")
 };
 const bags={short:[],medium:[],long:[]};
 const rounds={short:0,medium:0,long:0};
 const last={short:null,medium:null,long:null};
 const pick=lane=>{
   if(!groups[lane].length)return null;
   if(!bags[lane].length)
     bags[lane]=bagOf(groups[lane],rounds[lane]++,last[lane]);
   const chosen=bags[lane].shift();
   last[lane]=chosen.id;
   return chosen;
 };
 // The mean song duration is invariant under the era/featured shuffle.
 // Therefore our slot locations and the exact bumper inventory are identical
 // for every Same-Time cycle, even though the songs themselves move around.
 const average=base.reduce((sum,i)=>sum+Math.max(0,Number(tracks[i]?.duration||0)),0)/base.length;
 if(!(average>0))return {sequence:base,breaks:[],held,eligible:eligible.length};
 // The existing manager dial remains a density control. Its current "4"
 // gives the intended ~11/22-minute pattern; other settings scale all
 // three lanes together without changing any released audio or DB flags.
 const scale=frequency/4;
 const midEvery=(Number(policy.medium_target_seconds)||690)*scale;
 const longEvery=(Number(policy.long_target_seconds)||1350)*scale;
 // If long features exist, anchor mediums between long features instead
 // of independently scheduling a second feature 30 seconds after one.
 const midPeriod=groups.long.length?longEvery:midEvery;
 let nextMid=midEvery,nextLong=longEvery,shortPulse=0;
 let nextShort=phiGap(shortPulse++,scale),nominalSeconds=0;
 let lastAnchorAt=-Infinity;
 let lastShortAfterSong=-Infinity;
 const breaks=[],sequence=[];
 for(let i=0;i<base.length;i++){
   sequence.push(base[i]);
   nominalSeconds+=average;
   const shortDue=i+1>=nextShort;
   if(shortDue)nextShort+=phiGap(shortPulse++,scale);
   let chosen=null;
   if(groups.long.length&&nominalSeconds>=nextLong){
     chosen=pick("long");
     // When the long-form feature occupies a ~22-minute anchor,
     // consume the overlapping ~11-minute medium opportunity.
     while(nextLong<=nominalSeconds)nextLong+=longEvery;
     while(nextMid<=nominalSeconds)nextMid+=midPeriod;
   }else if(groups.medium.length&&nominalSeconds>=nextMid){
     // Do not cram a medium feature immediately after a long one merely
     // because two independent 11/22-minute targets nearly coincided.
     const longSoon=groups.long.length&&nextLong-nominalSeconds<=midEvery*0.55;
     if(!longSoon&&nominalSeconds-lastAnchorAt>=midEvery*0.55)
       chosen=pick("medium");
     while(nextMid<=nominalSeconds)nextMid+=midPeriod;
   }else if(shortDue&&i>0&&i+1-lastShortAfterSong>=2){
     // At least one song boundary without a shortie; guard the cycle seam.
     chosen=pick("short");
   }
   if(!chosen)continue;
   if(chosen.lane==="short")lastShortAfterSong=i+1;
   else lastAnchorAt=nominalSeconds;
   sequence.push(chosen.index);
   nominalSeconds+=chosen.seconds;
   breaks.push({number:breaks.length+1,afterSong:i+1,index:chosen.index,
     id:chosen.id,title:chosen.title,role:chosen.role,family:chosen.family,
     lane:chosen.lane,seconds:chosen.seconds,rare:chosen.lane==="long",
     estimatedMinute:Math.round(nominalSeconds/60*10)/10});
 }
 return {sequence,breaks,held,eligible:eligible.length};
}

// Bumper Bag v2: permute the *same chosen recordings* for each shared-clock
// rotation. Re-selecting arbitrary cart durations would make cycles longer or
// shorter, breaking the station-wide epoch calculation. Instead each length
// lane keeps its exact cart multiset and its short/medium/long break slots,
// while the order changes as the numbered rotation advances.
//
// Permuting one complete shuffled-bag at a time preserves the guarantee that
// no eligible cart repeats before its peers have had a turn within that bag.
// The seed is a deterministic shared-clock cycle number; Road Shuffle uses
// its own random rotation seed. A preview with seed=0 stays canonical.
function remix(planResult,bumperIndices,tracks,policy={},seed=0){
 if(!planResult||!Array.isArray(planResult.breaks)||
    !Array.isArray(planResult.sequence)||!Array.isArray(bumperIndices)||
    !Array.isArray(tracks)||!Number.isSafeInteger(seed)||seed===0||
    planResult.breaks.length<2)return planResult;
 const breaks=planResult.breaks.map(entry=>({...entry}));
 const fields=["index","id","title","seconds","role","family","rare"];
 for(const lane of ["short","medium","long"]){
  const bagSize=bumperIndices.filter(i=>Number.isInteger(i)&&tracks[i]&&
    tracks[i].kind==="bumper").filter(i=>{
      const c=classify(tracks[i],policy);
      return !c.hold&&c.lane===lane;
    }).length;
  if(bagSize<2)continue;
  const positions=breaks.map((b,i)=>b.lane===lane?i:-1).filter(i=>i>=0);
  for(let start=0;start<positions.length;start+=bagSize){
   const slots=positions.slice(start,start+bagSize);
   if(slots.length<2)continue;
   const before=slots.map(i=>planResult.breaks[i]);
   const shuffled=before.slice();
   let state=hash("HUMKIN-BUMPER-CYCLE:"+seed+":"+lane+":"+start)||1;
   const random=()=>{
    state=(state+0x6d2b79f5)>>>0;
    let x=state;x=Math.imul(x^(x>>>15),x|1);
    x^=x+Math.imul(x^(x>>>7),x|61);
    return ((x^(x>>>14))>>>0)/4294967296;
   };
   for(let i=shuffled.length-1;i>0;i--){
    const j=Math.floor(random()*(i+1));
    [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];
   }
   if(shuffled.every((entry,i)=>entry.id===before[i].id))
    shuffled.push(shuffled.shift()); // Nontrivial rearrangement for every full bag.
   if(start>0&&shuffled[0].id===breaks[positions[start-1]].id){
    const alternative=shuffled.findIndex(x=>x.id!==shuffled[0].id);
    if(alternative>0)[shuffled[0],shuffled[alternative]]=
      [shuffled[alternative],shuffled[0]];
   }
   for(let j=0;j<slots.length;j++)
    for(const field of fields)breaks[slots[j]][field]=shuffled[j][field];
  }
 }
 // Explicit ATTRACT and REPEL relationships are programmed by the owner.
 // Neither title, voice nor subject automatically adds a grouping rule.
 const familyBagSizes={};
 for(const lane of ["short","medium","long"]){
  familyBagSizes[lane]=bumperIndices.filter(i=>Number.isInteger(i)&&tracks[i]&&
    tracks[i].kind==="bumper").filter(i=>{
      const c=classify(tracks[i],policy);
      return !c.hold&&c.lane===lane;
    }).length;
 }
 root.HUMKIN_BUMPER_RELATIONS?.arrange(breaks,policy.groups,familyBagSizes);
 // Recalculate displayed estimates after the variable-length carts trade
 // places. Total cycle duration remains EXACTLY the same, in milliseconds.
 const songCount=planResult.sequence.length-planResult.breaks.length;
 const totalSongs=planResult.sequence.reduce((sum,i)=>
   sum+(tracks[i]?.kind==="bumper"?0:Math.max(0,Number(tracks[i]?.duration||0))),0);
 const mean=songCount>0?totalSongs/songCount:0;
 let bumperSeconds=0;
 for(const b of breaks){
  bumperSeconds+=b.seconds;
  b.estimatedMinute=Math.round((b.afterSong*mean+bumperSeconds)/60*10)/10;
 }
 const sequence=planResult.sequence.slice();
 let offset=0;
 for(let i=0;i<sequence.length&&offset<breaks.length;i++){
  if(sequence[i]===planResult.breaks[offset].index){
   sequence[i]=breaks[offset].index;
   offset++;
  }
 }
 if(offset!==breaks.length)return planResult; // Fail safe, never break an on-air cycle.
 return {...planResult,sequence,breaks};
}
const api=Object.freeze({normalize,classify,cadenceBreaks,plan,remix});
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.HUMKIN_BUMPER_BRAIN=api;
})(typeof window!=="undefined"?window:globalThis);
