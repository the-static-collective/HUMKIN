/* HUMKIN daily programming proposal v1. Declarative, untrusted, no publication.
 * Shared browser/Node validation. Every field remains subject to server review.
 */
(function(root,factory){const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  root.HumkinDailyPrograms=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
const SCHEMA="humkin.program.proposal/v1";
const REVIEW_SCHEMA="humkin.program.reviewed/v1";
const CONDITIONS=new Set(["unheard","new-album","night","short","always"]);
const ACTIONS=new Set(["least-played","different-album","shortest","longest","surprise"]);
const DURATIONS=new Set([30,60,90,120]);
function str(value,max){return typeof value==="string"?value.trim().slice(0,max):""}
function dayAsUTC(date){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return NaN;
 const time=Date.parse(date+"T00:00:00Z");
 return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===date?time:NaN;
}
function validate(raw,now=Date.now()){
 if(!raw||raw.schema!==SCHEMA)throw Error("Unsupported programming proposal");
 const station_id=str(raw.station_id,32);
 if(!/^[a-z0-9][a-z0-9-]{0,31}$/.test(station_id))throw Error("Invalid station");
 const title=str(raw.title,90);
 if(title.length<3||title.length>80)throw Error("Use a title between 3 and 80 characters");
 const day=str(raw.day,10);
 const time=str(raw.time,5);
 const dayMs=dayAsUTC(day);
 const pieces=Object.fromEntries(new Intl.DateTimeFormat("en-US",{
   timeZone:"America/Chicago",year:"numeric",month:"2-digit",day:"2-digit"
 }).formatToParts(new Date(now)).map(p=>[p.type,p.value]));
 const today=dayAsUTC(pieces.year+"-"+pieces.month+"-"+pieces.day);
 if(!Number.isFinite(dayMs)||dayMs<today||dayMs>today+31*86400000)
   throw Error("Choose a date within the coming month");
 if(!/^(?:[01]\d|2[0-3]):(?:00|15|30|45)$/.test(time))
   throw Error("Choose a start time on the quarter-hour");
 const minutes=Number(raw.minutes);
 if(!DURATIONS.has(minutes))throw Error("Choose a 30, 60, 90 or 120 minute program");
 if(!Array.isArray(raw.rules)||raw.rules.length<1||raw.rules.length>8)
   throw Error("A proposal needs 1–8 ordered Gambits");
 const rules=raw.rules.map(r=>{
   if(!r||!CONDITIONS.has(r.when)||!ACTIONS.has(r.action)||typeof r.enabled!=="boolean")
     throw Error("Unrecognized Gambit rule");
   return {when:r.when,action:r.action,enabled:r.enabled};
 });
 if(!rules.some(r=>r.enabled))throw Error("At least one rule must be enabled");
 const note=str(raw.note,500);
 if(raw.note&&String(raw.note).trim().length>500)throw Error("Programming note too long");
 return {schema:SCHEMA,title,station_id,day,time,minutes,rules,note};
}
function proposed(raw,now){return validate({...raw,schema:SCHEMA},now)}
return Object.freeze({SCHEMA,REVIEW_SCHEMA,validate,proposed});
});
