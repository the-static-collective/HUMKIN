/* HUMKIN RADIO — Chicago station clock / recurring daypart evaluator.
 * Pure, synchronous selection; no timers, server privileges, or user location.
 * The station always uses America/Chicago, regardless of listener location.
 */
(function(root){
"use strict";
const ZONE="America/Chicago";
const DAY={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
const format=new Intl.DateTimeFormat("en-US",{
  timeZone:ZONE,weekday:"short",year:"numeric",month:"2-digit",day:"2-digit",
  hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"
});
function localParts(ms){
  const o=Object.fromEntries(format.formatToParts(new Date(ms)).map(p=>[p.type,p.value]));
  const hour=Number(o.hour)%24,minute=Number(o.minute),second=Number(o.second);
  return {day:DAY[o.weekday],hour,minute,second,
    minuteOfDay:hour*60+minute,date:[o.year,o.month,o.day].join("-"),
    timezone:ZONE};
}
function eligibleProgram(program,parts){
  if(!program?.is_active||!Array.isArray(program.days)||!Array.isArray(program.track_ids))return false;
  if(!program.days.includes(parts.day))return false;
  return Number(program.start_minute)<=parts.minuteOfDay &&
    parts.minuteOfDay<Number(program.end_minute) &&
    Number(program.end_minute)>Number(program.start_minute);
}
function currentProgram(programs,ms){
  const parts=localParts(ms);
  const eligible=(Array.isArray(programs)?programs:[]).filter(p=>eligibleProgram(p,parts));
  // Higher priority wins. Ties prefer the latest start and stable UUID.
  eligible.sort((a,b)=>(Number(b.priority)||0)-(Number(a.priority)||0) ||
    Number(b.start_minute)-Number(a.start_minute) ||
    String(a.id||"").localeCompare(String(b.id||"")));
  return eligible[0]||null;
}
function scheduledAt(program,ms,tracks){
  if(!program)return null;
  const parts=localParts(ms);
  if(!eligibleProgram(program,parts))return null;
  const byId=new Map(tracks.map((track,i)=>[track.id,i]));
  const indices=program.track_ids.map(id=>byId.get(id)).filter(i=>i!==undefined);
  if(!indices.length)return null;
  const durations=indices.map(i=>Math.round(tracks[i].duration*1000));
  const period=durations.reduce((a,b)=>a+b,0);
  if(period<=0)return null;
  const elapsed=(parts.minuteOfDay-Number(program.start_minute))*60000+
     parts.second*1000+((ms%1000+1000)%1000);
  const localOffset=elapsed%period;
  let offset=0;
  for(let i=0;i<indices.length;i++){
    if(localOffset<offset+durations[i]){
      return {index:indices[i],position:(localOffset-offset)/1000,
        cycle:Math.floor(elapsed/period),slot:i,program:program.name};
    }
    offset+=durations[i];
  }
  return {index:indices[0],position:0,cycle:0,slot:0,program:program.name};
}
const api=Object.freeze({ZONE,localParts,currentProgram,scheduledAt});
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.HUMKIN_SCHEDULE=api;
})(typeof window!=="undefined"?window:globalThis);
