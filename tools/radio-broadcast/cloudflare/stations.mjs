import {qualifiesFeedback,stationWeek} from "../../../fm/top42/feedback-signals.mjs";
/**
 * HUMKIN LONG WAVE — virtual station programming.
 *
 * All stations share ONE approved R2 catalog. A station definition is public
 * programming metadata, never permission to publish an unapproved file.
 * Edit this module in source control; the Worker has no public write endpoint.
 *
 * Modes:
 *  personal: independent per-listener rotation
 *  virtual: recurring Central-time programs; each listener receives a
 *           continuous MP3 stream, but audio is NOT clock synchronized
 *  live:     reserved; requires separately deployed source and explicit wiring
 */
export const ZONE="America/Chicago";
export const STATIONS=Object.freeze([
  {
    id:"eclectic", name:"HUMKIN · Everything Station",
    description:"All approved music and the station's original short radio carts.",
    enabled:true, mode:"personal", filter:{kinds:["song"]},
    contract_version:1,revision:1,parent_id:"mainline",
    relationship:{kind:"echo",influence:15},
    include_bumpers:true, programs:[]
  },
  {
    id:"spotlight", name:"HUMKIN · Spotlight",
    description:"A virtual schedule; released singles take the evening shift.",
    enabled:true, mode:"virtual", filter:{kinds:["song"]},
    contract_version:1,revision:1,parent_id:"mainline",
    relationship:{kind:"echo",influence:80},
    include_bumpers:true, programs:[
      {id:"evening-singles",name:"Evening Singles",days:[0,1,2,3,4,5,6],
       start_minute:17*60,end_minute:22*60,priority:10,
       filter:{kinds:["song"],featured:true}}
    ]
  },
  {
    id:"seasonal", name:"HUMKIN · The Seasonals",
    description:"The approved seasonal record shelf.",
    enabled:true, mode:"personal",
    contract_version:1,revision:1,parent_id:"mainline",
    relationship:{kind:"counterpoint",influence:45},
    filter:{kinds:["song"],seasonal:true},include_bumpers:false,programs:[]
  },
  {
    id:"deep-wave", name:"HUMKIN · Deep Wave",
    description:"Counterprograms Spotlight and Mainline; favors tracks less emphasized by its parent.",
    enabled:true, mode:"personal",
    contract_version:1,revision:1,parent_id:"spotlight",
    relationship:{kind:"counterpoint",influence:90},
    filter:{kinds:["song"]},include_bumpers:true,programs:[]
  },
  {
    id:"dance-contenders", name:"HUMKIN · Dance New Contenders",
    description:"New candidates invited by Made Me Move responses; never an automatic Top 42 vote.",
    enabled:true,mode:"personal",
    contract_version:1,revision:1,parent_id:"mainline",
    relationship:{kind:"counterpoint",influence:35},
    filter:{kinds:["song"],feedback:{feeling:"move",min_count:3}},
    include_bumpers:false,programs:[]
  },
  {
    id:"talk", name:"HUMKIN · Talk",
    description:"Reserved for original, approved talk recordings and interviews.",
    enabled:false, mode:"virtual", filter:{tags:["talk"]},
    contract_version:1,revision:1,parent_id:"mainline",
    relationship:{kind:"independent",influence:0},
    include_bumpers:false,programs:[]
  },
  {
    id:"top-40", name:"HUMKIN · Top 40",
    description:"Reserved for a human-curated chart, not automatically inferred from likes.",
    enabled:false, mode:"virtual",filter:{track_ids:[]},
    contract_version:1,revision:1,parent_id:"mainline",
    relationship:{kind:"echo",influence:50},
    include_bumpers:true,programs:[]
  }
]);

const clock=new Intl.DateTimeFormat("en-US",{
  timeZone:ZONE,weekday:"short",year:"numeric",month:"2-digit",day:"2-digit",
  hour:"2-digit",minute:"2-digit",hourCycle:"h23"
});
const DAY={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
export function stationClock(at=new Date()){
  const p=Object.fromEntries(clock.formatToParts(at).map(x=>[x.type,x.value]));
  return {date:p.year+"-"+p.month+"-"+p.day,day:DAY[p.weekday],
    minute:Number(p.hour)*60+Number(p.minute),zone:ZONE};
}
export function eligibleSlot(slot,parts){
  return slot&&slot.enabled!==false&&Array.isArray(slot.days)&&
    slot.days.includes(parts.day)&&Number.isInteger(slot.start_minute)&&
    Number.isInteger(slot.end_minute)&&slot.start_minute>=0&&
    slot.end_minute<=1440&&slot.end_minute>slot.start_minute&&
    parts.minute>=slot.start_minute&&parts.minute<slot.end_minute;
}
export function activeSlot(station,at=new Date()){
  if(station.mode!=="virtual")return null;
  const parts=stationClock(at);
  const slots=(station.programs||[]).filter(p=>eligibleSlot(p,parts));
  slots.sort((a,b)=>(Number(b.priority)||0)-(Number(a.priority)||0)||
     b.start_minute-a.start_minute||String(a.id).localeCompare(String(b.id)));
  return slots[0]||null;
}
function normalized(value){return String(value||"").trim().toLowerCase()}
function contains(list,value){return list.some(x=>normalized(x)===normalized(value))}
export function matchFilter(track,filter={},at=new Date()){
  // Explicit empty ID/artist/tag allowlists NEVER turn into "all tracks".
  if(Array.isArray(filter.track_ids)&&!contains(filter.track_ids,track.id))return false;
  if(Array.isArray(filter.artists)&&!contains(filter.artists,track.artist))return false;
  if(Array.isArray(filter.albums)&&!contains(filter.albums,track.album))return false;
  if(Array.isArray(filter.tags)&&
     !filter.tags.some(t=>contains(track.tags||[],t)))return false;
  if(Array.isArray(filter.kinds)&&!contains(filter.kinds,track.kind))return false;
  if(filter.feedback&&!qualifiesFeedback(track,{
    ...filter.feedback,week_start:stationWeek(at)}))return false;
  if(filter.featured===true&&track.featured!==true)return false;
  if(filter.seasonal===true&&track.seasonal!==true)return false;
  return true;
}
function held(track,rules){
  return Array.isArray(rules)&&rules.some(r=>r?.enabled===true&&
    r.kind==="hold"&&Array.isArray(r.track_ids)&&r.track_ids.includes(track.id));
}
export function resolveStation(station,catalog,at=new Date()){
  if(!station||station.enabled!==true)return null;
  const slot=activeSlot(station,at);
  const filter=slot?.filter||station.filter||{kinds:["song"]};
  // Never silently widen an empty/invalid scheduled selection.
  const selected=catalog.filter(t=>matchFilter(t,filter,at)&&
    (t.kind!=="bumper"||!held(t,catalog.bumper_rules)));
  // If a program explicitly selects just voice carts, they are intentional
  // primary content, not shuffled in as routine interstitials.
  const primary=selected.map(t=>t.kind==="bumper"?
    {...t,kind:"song",featured:false,seasonal:false}:t);
  if(!primary.length)return {
    station,slot,tracks:[],key:station.id+":"+(slot?.id||"default"),
    program_name:slot?.name||"Regular rotation"
  };
  const tracks=primary.slice();
  if(station.include_bumpers===true){
    const primaryKeys=new Set(primary.map(t=>t.key));
    tracks.push(...catalog.filter(t=>t.kind==="bumper"&&!held(t,catalog.bumper_rules)&&
      !primaryKeys.has(t.key)));
  }
  tracks.bumper_groups=catalog.bumper_groups||[];
  tracks.bumper_rules=catalog.bumper_rules||[];
  return {station,slot,tracks,key:station.id+":"+(slot?.id||"default"),
    program_name:slot?.name||"Regular rotation"};
}
export function describeStations(catalog,at=new Date()){
  return STATIONS.map(station=>{
    const resolved=resolveStation(station,catalog,at);
    return {id:station.id,name:station.name,description:station.description,
      mode:station.mode,enabled:station.enabled,
      ready:Boolean(resolved?.tracks?.some(t=>t.kind==="song")),
      approved_tracks:resolved?resolved.tracks.filter(t=>t.kind==="song").length:0,
      program:resolved?.program_name||null,
      stream:station.enabled?"/stations/"+station.id+"/live.mp3":null};
  });
}
export function getStation(id,stations=STATIONS){
  return stations.find(s=>s.id===id)||null;
}
