/* Living Crate → existing Tower cloud-handoff/v1, never direct publication.
 * Only source-owned, enabled, published R2 identities are exportable.
 */
const SHA=/^[a-f0-9]{64}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const PROG=/^[a-f0-9]{24}$/;
const DAY=/^\d{4}-\d{2}-\d{2}$/;
const TIME=/^(?:[01]\d|2[0-3]):(?:00|15|30|45)$/;

function orderedJson(value){
 if(Array.isArray(value))return value.map(orderedJson);
 if(value && typeof value==="object")
  return Object.fromEntries(Object.keys(value).sort().map(key=>[key,orderedJson(value[key])]));
 return value;
}
export function canonical(value){return JSON.stringify(orderedJson(value))}

export function eligibleHandoffRow(row){
 if(!row||!UUID.test(String(row.id||""))||!SHA.test(String(row.sha256||""))||
    row.enabled!==true||!row.published_at||row.storage_provider!=="r2")
   return null;
 const key="tracks/"+row.id+"/"+row.sha256+".mp3";
 if(row.r2_object_key!==key||!["song","bumper"].includes(row.kind))return null;
 if(!Number.isFinite(row.duration_seconds)||row.duration_seconds<=0)return null;
 const title=String(row.title||"").trim(),artist=String(row.artist||"HUMKIN").trim();
 if(!title||title.length>160||!artist||artist.length>160)return null;
 return {
  id:"r2-"+row.id,title,artist,album:String(row.album||"").slice(0,160),
  artwork:"",source_kind:"r2",expected_sha:row.sha256,
  url:"https://media.abundent.org/"+key,source_seconds:row.duration_seconds
 };
}

export const CLOUD_STATIONS=Object.freeze(["station-one","lo-fi","mutant"]);
export function checkedStation(station){if(!CLOUD_STATIONS.includes(station))throw Error("Unknown cloud frequency.");return station;}
export async function buildCloudHandoff({name,day,time,ids,rows,programId,stationId="station-one"},digest){
 if(typeof name!=="string"||!name.trim()||name.length>120)throw Error("Name this one-time cloud feature.");
 if(typeof day!=="string"||!DAY.test(day)||
    Number.isNaN(Date.parse(day+"T12:00:00Z"))||
    new Date(day+"T12:00:00Z").toISOString().slice(0,10)!==day)
   throw Error("Choose a real YYYY-MM-DD date.");
 if(!TIME.test(String(time||"")))throw Error("Choose a Central time on a 15-minute boundary.");
 if(!PROG.test(String(programId||"")))throw Error("Invalid new feature identity.");
 if(!Array.isArray(ids)||ids.length<1||ids.length>250)
  throw Error("Choose 1–250 ordered recordings.");
 const available=new Map((Array.isArray(rows)?rows:[])
   .map(eligibleHandoffRow).filter(Boolean).map(r=>[r.id.slice(3),r]));
 const crate=[];
 let seconds=0;
 for(const id of ids){
  const match=available.get(id);
  if(!match)throw Error("An ordered item is hidden, private, missing or not on approved R2.");
  seconds+=match.source_seconds;
  const {source_seconds, ...record}=match;
  crate.push(record);
 }
 if(seconds>8*3600)throw Error("A one-time cloud feature cannot exceed eight hours.");
 const station_id=checkedStation(stationId);
 const packet={
  schema:"humkin.tower.cloud-handoff/v1",
  state:"draft_for_owner_review",
  station_id,
  program:{
   id:programId,revision:1,name:name.trim(),
   notes:"Created in HUMKIN Living Crate. Explicit owner review and private R2 publication required.",
   track_ids:crate.map(record=>record.id)
  },
  slot:{day,time,timezone:"America/Chicago"},
  crate:{schema:"humkin.autopilot.crate/v1",station_id,tracks:crate}
 };
 const protectedFields={station_id:packet.station_id,program:packet.program,slot:packet.slot,crate:packet.crate};
 const actual=await digest(new TextEncoder().encode(canonical(protectedFields)));
 if(!SHA.test(actual))throw Error("Cloud handoff signature digest failed.");
 packet.fingerprint=actual;
 return packet;
}

export async function browserSha256(bytes){
 const hash=await crypto.subtle.digest("SHA-256",bytes);
 return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,"0")).join("");
}

/* Initial HOUSE draft, not a publication receipt. Uses the same approved source filter. */
export async function buildHouseCrate({stationId,ids,rows},digest=browserSha256){
 const station_id=checkedStation(stationId);
 if(station_id==="station-one")throw Error("Use the existing Night Shift HOUSE workflow.");
 if(!Array.isArray(ids)||!ids.length||ids.length>200)throw Error("Select 1–200 ordered recordings.");
 const available=new Map((Array.isArray(rows)?rows:[]).map(eligibleHandoffRow).filter(Boolean).map(r=>[r.id.slice(3),r]));
 const tracks=ids.map(id=>{const record=available.get(id);if(!record)throw Error("Recording is no longer eligible for cloud.");const {source_seconds,...track}=record;return track;});
 const packet={schema:"humkin.network-house-draft/v1",station_id,crate:{schema:"humkin.autopilot.crate/v1",station_id,tracks}};
 packet.fingerprint=await digest(new TextEncoder().encode(canonical(packet)));
 if(!SHA.test(packet.fingerprint))throw Error("House draft digest failed.");
 return packet;
}
