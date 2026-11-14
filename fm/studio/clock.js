/* HUMKIN RADIO — portable newsroom/pilot rundown tools (no credentials). */
(function(root){
"use strict";
const DEPARTMENTS=Object.freeze([
 ["station_id","STATION ID"],["news","NEWSROOM"],["comedy","COMEDY"],
 ["sponsor","SPONSOR / AD"],["community","COMMUNITY"],["promo","PROMO"],
 ["field_report","FIELD REPORT"],["weather","WEATHER"],["other","ODDS & ENDS"]
]);
const PILOT_BEATS=[
 ["station_id","THE FIRST DAY — signed on","The station has been purchased by an organization that does not yet exist. Keep it dramatic but affectionate.",40],
 ["news","Newsman investigates the buyer","The Newsman attempts to locate management, and discovers that management is attempting to locate itself.",75],
 ["sponsor","Advertisement department","The station has already sold advertising for businesses which nobody can find. Parody must be plainly fictional.",55],
 ["community","Genuine community bulletin","One verified, helpful, consented community announcement. Do not invent factual reports.",60],
 ["field_report","Farm report from elsewhere","The farm correspondent explains the organization's inexplicable relationship to turnips.",65],
 ["comedy","Manager's emergency transmission","The new Station Manager reveals a spectacular administrative misunderstanding.",55],
 ["station_id","Sign-off that is not a sign-off","They discover a station can be real before its owners have figured out what to call themselves.",45]
];
const MAX_SLOTS=200;
function validItem(x){
 return !!x && typeof x==="object"&&["track","script"].includes(x.type)&&
  typeof x.label==="string"&&x.label.length<=240&&
  (x.type==="script"||typeof x.trackId==="string") &&
  (x.type==="track"||typeof x.department==="string");
}
function sanitizeRundown(rundown){
 if(!Array.isArray(rundown))return [];
 return rundown.slice(0,MAX_SLOTS).filter(validItem).map(x=>({
  type:x.type,label:String(x.label).slice(0,240),
  ...(x.type==="track"?{trackId:String(x.trackId).slice(0,150)}:
   {department:String(x.department).slice(0,50),notes:String(x.notes||"").slice(0,1200),
    expectedSeconds:Math.max(5,Math.min(600,Number(x.expectedSeconds)||45))})
 }));
}
function timeOf(rundown,trackMap){
 return sanitizeRundown(rundown).reduce((sec,item)=>sec+
   (item.type==="track"?Math.max(0,Number(trackMap?.get(item.trackId)?.duration)||0):
    item.expectedSeconds),0);
}
function prettyTime(seconds){
 const n=Math.max(0,Math.round(Number(seconds)||0));
 return Math.floor(n/3600)+":"+String(Math.floor((n%3600)/60)).padStart(2,"0")+":"+
   String(n%60).padStart(2,"0");
}
function seededRandom(seed){
 let state=seed|0;
 return ()=>{state=(state+0x6d2b79f5)|0;let x=state;
   x=Math.imul(x^(x>>>15),x|1);
   x^=x+Math.imul(x^(x>>>7),x|61);
   return ((x^(x>>>14))>>>0)/4294967296};
}
function pilot(tracks,seed=14,beats=PILOT_BEATS){
 if(!Array.isArray(beats)||beats.length<2||beats.length>30||
    beats.some(s=>!Array.isArray(s)||s.length!==4||
      typeof s[1]!=="string"||typeof s[2]!=="string"||
      !Number.isInteger(s[3])||s[3]<5||s[3]>600))
   throw Error("Invalid scripted program beats.");
 const songs=(Array.isArray(tracks)?tracks:[])
  .filter(x=>x?.kind==="song"&&x?.enabled&&x?.published&&x?.duration>0)
  .sort((a,b)=>String(a.id).localeCompare(String(b.id)));
 const random=seededRandom(seed);
 for(let i=songs.length-1;i>0;i--){
  const j=Math.floor(random()*(i+1));[songs[i],songs[j]]=[songs[j],songs[i]];
 }
 let i=0,seconds=0;
 const result=[];
 const map=new Map(songs.map(t=>[t.id,t]));
 const addScript=(beat)=>{
  result.push({type:"script",label:beat[1],department:beat[0],
    notes:beat[2],expectedSeconds:beat[3]});seconds+=beat[3];
 };
 const addTrack=()=>{
  if(i>=songs.length)return false;
  const t=songs[i++];result.push({type:"track",trackId:t.id,label:t.title});
  seconds+=t.duration;return true;
 };
 addScript(beats[0]);
 for(let n=1;n<beats.length;n++){
  const futureBeats=beats.slice(n).reduce((a,b)=>a+b[3],0);
  // Aim for the full hour while distributing musical blocks across all beats.
  // A song that causes an overrun is deferred; all spoken slots remain placeholders.
  const room=3600-futureBeats-90;
  const target=(n/(beats.length-1))*room;
  while(i<songs.length&&seconds+songs[i].duration<target&&result.length<MAX_SLOTS-3)
   addTrack();
  addScript(beats[n]);
 }
 // Do not overrun the hour; a short reserved gap leaves space for live talk.
 while(i<songs.length&&seconds+songs[i].duration<=3600&&result.length<MAX_SLOTS)
  addTrack();
 return {rundown:result,totalSeconds:seconds,unrecorded:result.filter(s=>s.type==="script").length,
    songCount:result.filter(s=>s.type==="track").length,trackMap:map};
}
function eligibleBroadcast(rundown,tracks){
 const parts=sanitizeRundown(rundown);
 const known=new Map((Array.isArray(tracks)?tracks:[]).map(t=>[t.id,t]));
 const unresolved=parts.filter(x=>x.type==="script"||
   !known.get(x.trackId)?.published||!known.get(x.trackId)?.enabled);
 return {ok:parts.length>0&&unresolved.length===0&&parts.length<=MAX_SLOTS,
   unresolved:unresolved.length,
   trackIds:parts.filter(x=>x.type==="track").map(x=>x.trackId)};
}
const api=Object.freeze({DEPARTMENTS,PILOT_BEATS,MAX_SLOTS,
  sanitizeRundown,timeOf,prettyTime,pilot,eligibleBroadcast});
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.HUMKIN_STUDIO_CLOCK=api;
})(typeof window!=="undefined"?window:globalThis);
