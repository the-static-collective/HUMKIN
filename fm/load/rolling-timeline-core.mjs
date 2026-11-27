import {stationURL} from "../network/dial-core.mjs";
const SCHEMA="humkin.autopilot.public-schedule/v1";
const stamp=value=>typeof value==="string"?Date.parse(value):NaN;
const short=(v,n=160)=>typeof v==="string"?v.slice(0,n):"";
export function projectTimeline(raw,nowPlaying,station,minutes=60){
 stationURL(station,"schedule");
 if(![30,60,120].includes(minutes))throw Error("Invalid horizon");
 const asOf=stamp(raw?.as_of_utc),clock=stamp(raw?.clock_at_utc);
 if(raw?.schema!==SCHEMA||raw.station_id!==station||!Number.isFinite(asOf)||!Number.isFinite(clock)||clock>asOf||asOf-clock>60000||!Array.isArray(raw.upcoming)||raw.upcoming.length>1000||typeof raw.on_air!=="boolean")throw Error("Unverified station schedule");
 const rows=[];let previousEnd=null,currentSeen=false;
 for(const cue of raw.upcoming){
  const start=stamp(cue?.start_at_utc),end=stamp(cue?.end_at_utc);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||previousEnd!==null&&start!==previousEnd||!short(cue.revision)||!short(cue.track?.id)||!short(cue.track?.title))throw Error("Invalid published cue");
  if(cue.is_current===true){if(currentSeen||rows.length||start>clock||end<=clock)throw Error("Invalid current cue");currentSeen=true;}
  previousEnd=end;
  rows.push({start,end,revision:short(cue.revision),id:short(cue.track.id),title:short(cue.track.title),artist:short(cue.track.artist),current:cue.is_current===true});
 }
 const head=rows.find(r=>r.current),mediaAt=stamp(nowPlaying?.media_at);
 const confirmed=!!(raw.on_air&&head&&nowPlaying?.on_air===true&&nowPlaying.mode==="cloud_autopilot_hls"&&nowPlaying.frequency===station&&nowPlaying.revision===head.revision&&nowPlaying.track?.id===head.id&&Number.isFinite(mediaAt)&&mediaAt>=head.start&&mediaAt<head.end&&Math.abs(mediaAt-clock)<=20000);
 const deadline=clock+minutes*60000;
 const selected=rows.filter(r=>r.end>clock&&r.start<deadline);
 return {station,asOf,clock,revision:short(raw.revision),onAir:raw.on_air,confirmed,current:head||null,rows:selected.slice(0,80),limited:selected.length>80||raw.truncated===true,coveredUntil:rows.at(-1)?.end??null,deadline,pending:(Array.isArray(raw.pending_revisions)?raw.pending_revisions:[]).slice(0,32).map(p=>({revision:short(p?.revision),at:stamp(p?.effective_at_utc)})).filter(p=>p.revision&&Number.isFinite(p.at))};
}
export async function readTimeline(station,signal,fetcher=fetch){
 const get=async route=>{const res=await fetcher(stationURL(station,route),{cache:"no-store",signal});return {status:res.status,body:await res.json()};};
 const schedule=await get("schedule");
 if(schedule.status===503&&schedule.body?.mode==="cloud_autopilot_unpublished")return {unpublished:true};
 if(schedule.status!==200)throw Error("Schedule unavailable ("+schedule.status+")");
 let nowPlaying=null;
 if(schedule.body.on_air===true){try{const p=await get("now-playing");if(p.status===200)nowPlaying=p.body;}catch(e){if(signal.aborted)throw e;}}
 return {raw:schedule.body,nowPlaying};
}
