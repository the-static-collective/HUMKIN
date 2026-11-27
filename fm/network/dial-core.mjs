export const ORIGIN="https://humkin-long-wave.joyvolcanomusic.workers.dev";
export const STATIONS=Object.freeze([{id:"station-one",name:"Night Shift"},{id:"lo-fi",name:"Lo-Fi Study"},{id:"mutant",name:"Mutant Radio"}]);
const known=id=>STATIONS.some(s=>s.id===id);
const short=(s,n=160)=>typeof s==="string"?s.slice(0,n):"";
export function stationURL(id,route){
  if(!known(id)||!["status","now-playing","schedule","live.m3u8"].includes(route))throw Error("Unknown station or route");
  return ORIGIN+"/autopilot/"+id+"/"+route;
}
export async function stationHealth(id,fetcher=fetch){
  const observed_at=new Date().toISOString();
  const get=async route=>{
    const res=await fetcher(stationURL(id,route),{cache:"no-store",signal:AbortSignal.timeout(8000)});
    return {status:res.status,data:await res.json()};
  };
  try{
    const r=await get("status"),s=r.data;
    if(r.status===503&&s.mode==="cloud_autopilot_unpublished")return {id,state:"unpublished",observed_at};
    if(r.status!==200||s.on_air!==true||s.frequency!==id||s.mode!=="cloud_autopilot_hls")return {id,state:"unconfirmed",observed_at};
    const out={id,state:"worker-reports-on-air",observed_at,revision:short(s.revision),age_seconds:Number.isFinite(s.age_seconds)?s.age_seconds:null};
    try{const p=await get("now-playing");if(p.status===200&&p.data.frequency===id&&p.data.on_air===true&&p.data.revision===s.revision)out.title=short(p.data.track?.title);}catch{}
    return out;
  }catch{return {id,state:"unconfirmed",observed_at};}
}
export function ledgerView(raw,now=Date.now()){
  if(raw?.schema!=="humkin.transmission-ledger-summary/v1"||!Array.isArray(raw.stations)||raw.stations.length>100||
     !Number.isFinite(raw.max_gap_ms)||raw.max_gap_ms<=0||raw.max_gap_ms>3600000)throw Error("Invalid ledger summary");
  const out=new Map();
  for(const row of raw.stations){
    if(!known(row.station))continue;
    if(out.has(row.station)||!Number.isFinite(Date.parse(row.last_observation))||
      !Number.isFinite(row.longest_sampled_span_ms)||row.longest_sampled_span_ms<0||
      !Number.isFinite(row.current_sampled_span_ms)||row.current_sampled_span_ms<0)throw Error("Invalid station receipt");
    const age=now-Date.parse(row.last_observation);
    out.set(row.station,{...row,latest_state:age<0||age>raw.max_gap_ms?"stale":row.latest_state,
      current_sampled_span_ms:age<0||age>raw.max_gap_ms?0:row.current_sampled_span_ms});
  }
  return out;
}
// Inventory is based only on operator-selected local program exports, not a live R2 census.
export function inventory(programs){
  const assets=new Map(),stations=new Set();
  let appearances=0;
  for(const p of programs){
    if(p?.schema!=="humkin.cloud-autopilot/v1"||!known(p.station_id)||!Array.isArray(p.revisions)||p.revisions.length<1||p.revisions.length>32||stations.has(p.station_id))throw Error("Invalid or duplicate program");
    stations.add(p.station_id);
    for(const r of p.revisions){
      if(!Array.isArray(r.tracks)||r.tracks.length<1||r.tracks.length>500)throw Error("Invalid tracks");
      let total=0;
      for(const t of r.tracks){
        if(!/^[a-f0-9]{64}$/.test(t.asset_sha)||!Array.isArray(t.durations_ms)||!t.durations_ms.length||t.durations_ms.some(n=>!Number.isInteger(n)||n<250||n>11000))throw Error("Invalid encoded media");
        total+=t.durations_ms.length;if(total>10000)throw Error("Too many segments");
        const a=assets.get(t.asset_sha)||{durations:t.durations_ms,stations:new Set()};
        if(a.durations.length!==t.durations_ms.length||a.durations.some((n,i)=>n!==t.durations_ms[i]))throw Error("Conflicting asset durations");
        a.stations.add(p.station_id);assets.set(t.asset_sha,a);appearances++;
      }
    }
  }
  return {stations:stations.size,unique_assets:assets.size,appearances,shared_assets:[...assets.values()].filter(a=>a.stations.size>1).length,
    unique_segments:[...assets.values()].reduce((n,a)=>n+a.durations.length,0)};
}
export function draftCrate(raw,id){
  if(!known(id)||id==="station-one")throw Error("Reference station protected");
  if(raw?.schema!=="humkin.autopilot.crate/v1"||!Array.isArray(raw.tracks)||!raw.tracks.length||raw.tracks.length>500)throw Error("Select an existing approved-source crate");
  if(raw.tracks.some(t=>!t||typeof t.id!=="string"||typeof t.title!=="string"||Boolean(t.path)===Boolean(t.url)))throw Error("Incomplete source records");
  return {schema:raw.schema,station_id:id,tracks:structuredClone(raw.tracks)};
}
