// Pure, runtime-independent contracts for the HUMKIN Tower 012 conversation bridge.
export const STATION = "station-one";
export const ACTIONS = Object.freeze([
  "queue_next","queue_end","hold","release","more","less"
]);
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const validString=(value,max)=>typeof value==="string"&&value.length>0&&value.length<=max;
export function parseControl(body){
  if(!body||typeof body!=="object"||Array.isArray(body))throw Error("INVALID_COMMAND");
  if(body.station_id!==STATION)throw Error("UNSUPPORTED_STATION");
  const command=body.command,track_id=body.track_id,request_id=body.request_id;
  if(!ACTIONS.includes(command)||!UUID.test(String(track_id||""))||
     !UUID.test(String(request_id||"")))throw Error("INVALID_COMMAND");
  return {command,track_id,request_id};
}
export function isEligible(row,command){
  return !!row&&row.enabled===true&&!!row.published_at&&
    row.storage_provider==="r2"&&
    (row.kind==="song"||row.kind==="bumper")&&
    (!(command==="more"||command==="less")||row.kind==="song")&&
    (row.kind!=="bumper"||Number(row.duration_seconds)<=180);
}
export function parseCatalogQuery(body){
  const q=body?.query??"";
  if(typeof q!=="string"||q.length>120)throw Error("INVALID_QUERY");
  return q.trim().toLocaleLowerCase();
}
export function projectCatalog(rows,query,limit=30){
  if(!Array.isArray(rows))throw Error("CATALOG_UNAVAILABLE");
  const filtered=rows.filter(row=>isEligible(row,"queue_next"))
    .filter(row=>!query||[row.title,row.artist,row.album].some(
      item=>String(item||"").toLocaleLowerCase().includes(query)));
  return {records:filtered.slice(0,limit).map(row=>({
    id:row.id,title:String(row.title||"").slice(0,160),
    artist:String(row.artist||"").slice(0,160),
    album:String(row.album||"").slice(0,160),
    kind:row.kind,duration_seconds:Number(row.duration_seconds)||null
  })),matches:filtered.length,source_truncated:rows.length>=500};
}
export function safeSchedule(raw){
  if(!raw||raw.schema!=="humkin.autopilot.public-schedule/v1"||
     raw.station_id!==STATION||!Array.isArray(raw.upcoming))
    throw Error("SCHEDULE_NOT_VERIFIED");
  const current=raw.upcoming.find(c=>c?.is_current)??null;
  const project=c=>!c?null:{
    revision:String(c.revision||"").slice(0,100),
    start_at_utc:String(c.start_at_utc||"").slice(0,32),
    end_at_utc:String(c.end_at_utc||"").slice(0,32),
    track:{
      id:String(c.track?.id||"").slice(0,100),
      title:String(c.track?.title||"").slice(0,160),
      artist:String(c.track?.artist||"").slice(0,160),
      album:String(c.track?.album||"").slice(0,160)
    }
  };
  const effective=raw.control?.effective_cursor;
  const pending=raw.control?.pending_cursor;
  return {schema:raw.schema,station_id:STATION,
    revision:String(raw.revision||"").slice(0,100),
    as_of_utc:String(raw.as_of_utc||"").slice(0,32),
    on_air:raw.on_air===true,
    reason:typeof raw.reason==="string"?raw.reason.slice(0,100):null,
    rotation_track_count:Number(raw.rotation_track_count)||0,
    current:project(current),
    upcoming:raw.upcoming.slice(0,20).map(project),
    control:{
      effective_cursor:Number.isSafeInteger(effective)&&effective>=0?effective:null,
      pending_cursor:Number.isSafeInteger(pending)&&pending>=0?pending:null
    }
  };
}
export function classifyIntent(id,schedule){
  if(!Number.isSafeInteger(id)||id<1)return "UNVERIFIED";
  if(!schedule)return "REQUESTED_UNVERIFIED_CLOUD";
  const effective=schedule.control?.effective_cursor;
  const pending=schedule.control?.pending_cursor;
  if(Number.isSafeInteger(effective)&&effective>=id&&schedule.on_air===true)
    return "EFFECTIVE_SCHEDULE_NOT_HEARD";
  if((Number.isSafeInteger(effective)&&effective>=id)||
     (Number.isSafeInteger(pending)&&pending>=id))
    return "ACCEPTED_NOT_EFFECTIVE";
  return "REQUESTED";
}
