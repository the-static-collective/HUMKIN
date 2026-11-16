import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

/** HUMKIN TOP 42 — public, account-free, provisional play ledger.
 * All database tables are private behind RLS. No raw IPs, personal names,
 * emails or device identifiers are stored. Audio remains on HUMKIN's CDN.
 */
const PROJECT_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SECRET = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const db = createClient(PROJECT_URL, SECRET, {auth:{persistSession:false,autoRefreshToken:false}});
const STATION = "https://humkin.abundent.org";
const STATIC_IDS = new Set([
  ...Array.from({length:12},(_,i)=>"mutant-pop-"+String(i+1).padStart(2,"0")),
  ...Array.from({length:7},(_,i)=>"everywhere-near-you-"+String(i+1).padStart(2,"0")),
  "haileylu-bloom","leave-the-kettle-on"
]);
const WORDS = ["Almost","Blue","Bloom","Broken","Distant","First","Golden","Home","Kettle","Little","Long","Midnight","Morning","Noontime","Radio","Road","Rose","Second","Signal","Somewhere","Static","Strange","Sunday","Sun","Warm","Window","Yesterday"];
const MAX_BODY = 6500;
function dayAt(ms:number) {
  const parts = new Intl.DateTimeFormat("en-US",{
    timeZone:"America/Chicago",year:"numeric",month:"2-digit",day:"2-digit"
  }).formatToParts(new Date(ms));
  const value=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  return value.year+"-"+value.month+"-"+value.day;
}
function addDays(day:string,delta:number) {
  const d=new Date(day+"T12:00:00Z");
  d.setUTCDate(d.getUTCDate()+delta);
  return d.toISOString().slice(0,10);
}
function weekAt(day:string) {
  const dow=new Date(day+"T12:00:00Z").getUTCDay();
  return addDays(day,-((dow+6)%7));
}
function issueKeys(now=Date.now()) { const day=dayAt(now);return {day,week:weekAt(day),yesterday:addDays(day,-1)}; }
function fail(message:string,status=400,origin="") {return respond({error:message},status,origin);}
function respond(payload:unknown,status=200,origin="") {
  const allowed=origin===STATION||origin==="https://www.humkin.abundent.org"?origin:STATION;
  return new Response(JSON.stringify(payload),{status,headers:{
    "Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",
    "Access-Control-Allow-Origin":allowed,
    "Access-Control-Allow-Headers":"content-type,apikey,authorization",
    "Access-Control-Allow-Methods":"GET, POST, OPTIONS","Vary":"Origin"
  }});
}
async function digest(value:string) {
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(SECRET),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const bytes=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,"0")).join("");
}
async function quota(table:string,col:string,value:string,day:string) {
  const {count,error}=await db.from(table).select("id",{head:true,count:"exact"})
    .eq(col,value).eq("station_day",day);
  if(error)throw error;
  return count??0;
}
async function getCatalog() {
  let originals:any[] = [];
  let releaseAlbums:string[] = [];
  let releaseSingles:string[] = [];
  try {
    const response=await fetch(STATION+"/fm/rotation.json",{headers:{Accept:"application/json"},signal:AbortSignal.timeout(3500)});
    if(response.ok){
      const config=await response.json();
      const {data:overrides,error}=await db.from("humkin_radio_static_overrides")
        .select("track_id,title,artist,album,enabled,kind");
      if(error)throw error;
      const byId=new Map((overrides??[]).map((r:any)=>[r.track_id,r]));
      releaseAlbums=config.featured_rotation?.albums??[];
      releaseSingles=config.featured_rotation?.singles??[];
      originals=(config.tracks??[]).filter((t:any)=>STATIC_IDS.has(t.id)).map((t:any)=>{
        const o:any=byId.get(t.id)||{};
        if(o.enabled===false||o.kind==="bumper")return null;
        return {id:t.id,title:String(o.title||t.title),artist:String(o.artist||t.artist||"HUMKIN"),
          album:String(o.album||t.album||"HUMKIN RADIO"),
          duration:Number(t.duration),
          src:new URL(t.src,STATION+"/fm/").href,
          artwork:new URL(t.artwork||"../cover.jpg",STATION+"/fm/").href,
          featured:releaseSingles.includes(t.id)||releaseAlbums.includes(o.album||t.album)};
      }).filter(Boolean);
    }
  }catch(e){console.warn("Static catalog was unavailable",String(e));}
  const {data:rows,error}=await db.from("humkin_radio_tracks")
    .select("id,title,artist,album,kind,is_single,enabled,published_at,duration_seconds,storage_path")
    .not("published_at","is",null).eq("enabled",true).order("published_at",{ascending:true}).limit(1000);
  if(error)throw error;
  const cloud=(rows??[]).filter((r:any)=>r.kind!=="bumper"&&
    /^[0-9a-f-]{36}\/[0-9a-f]{64}\.mp3$/.test(r.storage_path||"") &&
    Number(r.duration_seconds)>0).map((r:any)=>({
      id:"crate-"+r.id,title:r.title,artist:r.artist||"HUMKIN",
      album:r.album||"HUMKIN RADIO",duration:Number(r.duration_seconds),
      src:PROJECT_URL+"/storage/v1/object/public/humkin-radio-live/"+r.storage_path,
      artwork:STATION+"/cover.jpg",featured:r.is_single===true
    }));
  return [...originals,...cloud];
}
async function checkId(id:string) {
  if(STATIC_IDS.has(id)) {
    const {data,error}=await db.from("humkin_radio_static_overrides")
      .select("enabled,kind").eq("track_id",id).maybeSingle();
    if(error)return false;
    return data?.enabled!==false && data?.kind!=="bumper";
  }
  if(!/^crate-[0-9a-fA-F-]{36}$/.test(id))return false;
  const {data,error}=await db.from("humkin_radio_tracks")
    .select("id").eq("id",id.slice(6)).eq("enabled",true)
    .eq("kind","song").not("published_at","is",null).maybeSingle();
  return !error&&Boolean(data);
}
async function scores(start:string,end:string) {
  const {data,error}=await db.rpc("humkin_league_scores",{from_day:start,to_day:end});
  if(error)throw error;
  return (data??[]).map((x:any)=>({
    id:x.track_id,radio:Number(x.radio_plays)||0,
    playlist:Number(x.playlist_plays)||0,plays:Number(x.total_plays)||0
  }));
}
function rank(catalog:any[],played:any[]) {
  const hits=new Map(played.map(p=>[p.id,p]));
  return catalog.map(t=>{
    const p:any=hits.get(t.id)||{radio:0,playlist:0,plays:0};
    return {id:t.id,title:t.title,artist:t.artist,featured:t.featured,
      radio:p.radio,playlist:p.playlist,plays:p.plays};
  }).sort((a,b)=>b.plays-a.plays||b.playlist-a.playlist||a.title.localeCompare(b.title)||a.id.localeCompare(b.id))
  .slice(0,42);
}
function applyScores(records:any[],played:any[]) {
  const score=new Map(played.map(p=>[p.id,p]));
  return records.map(r=>{
    const points=(r.track_ids||[]).reduce((total:number,id:string)=>total+(score.get(id)?.plays||0),0);
    const radio=(r.track_ids||[]).reduce((total:number,id:string)=>total+(score.get(id)?.radio||0),0);
    return {id:r.id,kind:r.kind,issue:r.issue_key,title:r.title,
      curator:r.curator,tracks:r.track_ids,created_at:r.created_at,plays:points,
      radio,playlist:points-radio};
  }).sort((a,b)=>b.plays-a.plays||a.created_at.localeCompare(b.created_at)).slice(0,60);
}
async function state(u:URL) {
  const {day,week,yesterday}=issueKeys();
  const [catalog,todayPlay,yesterdayPlay,weekPlay,daily,weekly]=await Promise.all([
    getCatalog(),scores(day,day),scores(yesterday,yesterday),scores(week,day),
    db.from("humkin_league_records").select("id,kind,issue_key,title,curator,track_ids,created_at")
      .eq("kind","ep").eq("issue_key",day).order("created_at",{ascending:false}).limit(100),
    db.from("humkin_league_records").select("id,kind,issue_key,title,curator,track_ids,created_at")
      .eq("kind","album").eq("issue_key",week).order("created_at",{ascending:false}).limit(100)
  ]);
  if(daily.error)throw daily.error;
  if(weekly.error)throw weekly.error;
  let selected=null;
  const selectedId=u.searchParams.get("record");
  if(selectedId&&/^[0-9a-f-]{36}$/i.test(selectedId)){
    const {data,error}=await db.from("humkin_league_records")
      .select("id,kind,issue_key,title,curator,track_ids,created_at")
      .eq("id",selectedId).maybeSingle();
    if(error)throw error;
    if(data)selected=applyScores([data],data.kind==="album"?weekPlay:todayPlay)[0];
  }
  return {schema:"humkin.top42/v1",station_day:day,week_start:week,previous_day:yesterday,
    definition:"One client-reported qualified listen after at least 30 seconds of playback; provisional, capped and deduplicated.",
    chart:rank(catalog,todayPlay),airchart:rank(catalog,yesterdayPlay).filter(x=>x.plays>0),
    catalog,eps:applyScores(daily.data??[],todayPlay),
    albums:applyScores(weekly.data??[],weekPlay),selected};
}
async function postPlay(data:any,req:Request) {
  const {day}=issueKeys();
  const actor=String(data?.listener||"");
  const id=String(data?.track_id||"");
  const source=data?.source;
  if(!/^[0-9a-f-]{36}$/i.test(actor)||!/^[-a-z0-9]{3,90}$/i.test(id)||
    !["radio","playlist"].includes(source))
    return {error:"Invalid play report",status:400};
  const played=Number(data?.seconds);
  if(!Number.isFinite(played)||played<30||played>14400)
    return {error:"Listening threshold not reached",status:400};
  if(!await checkId(id))return {error:"Track not on the public dial",status:400};
  let recordId=null;
  if(source==="playlist" && data?.record_id) {
    recordId=String(data.record_id);
    if(!/^[0-9a-f-]{36}$/i.test(recordId))return {error:"Invalid record ID",status:400};
    const {data:record,error}=await db.from("humkin_league_records").select("track_ids").eq("id",recordId).maybeSingle();
    if(error||!record?.track_ids?.includes(id))return {error:"Track not on that record",status:400};
  }
  const actorHash=await digest("actor:v1:"+actor);
  const rawNetwork=req.headers.get("cf-connecting-ip")||
    req.headers.get("x-real-ip")||"unreported:"+actor;
  const networkHash=await digest("net:v1:"+rawNetwork.slice(0,128));
  const [actorCount,netCount]=await Promise.all([
    quota("humkin_league_plays","actor_hash",actorHash,day),
    quota("humkin_league_plays","network_hash",networkHash,day)
  ]);
  if(actorCount>=450||netCount>=3000)return {error:"Daily listener limit reached",status:429};
  const now=Date.now();
  const {error}=await db.from("humkin_league_plays").insert({
    track_id:id,source,record_id:recordId,actor_hash:actorHash,
    network_hash:networkHash,station_day:day,slot_bucket:Math.floor(now/1200000)
  });
  if(error){
    if(error.code==="23505")return {accepted:false,reason:"Already counted within 20 minutes"};
    throw error;
  }
  return {accepted:true,day};
}
async function postRecord(data:any) {
  const {day,week}=issueKeys();
  const actor=String(data?.listener||"");
  const kind=data?.kind,tracks=data?.tracks;
  const first=String(data?.word_one||""),last=String(data?.word_two||"");
  if(!/^[0-9a-f-]{36}$/i.test(actor)||!["ep","album"].includes(kind)||
    !Array.isArray(tracks)||tracks.length!==(kind==="ep"?6:12)||
    new Set(tracks).size!==tracks.length||!WORDS.includes(first)||!WORDS.includes(last))
    return {error:"Invalid record draft",status:400};
  const catalog=await getCatalog();
  const byId=new Map(catalog.map((c:any)=>[c.id,c]));
  let featured=0;
  for(const id of tracks){
    if(typeof id!=="string"||!byId.has(id))return {error:"The record contains a track not currently on the dial",status:400};
    if(byId.get(id).featured)featured++;
  }
  if(featured!==(kind==="ep"?2:4))
    return {error:"EPs require 4 radio-only + 2 released; albums require 8 + 4",status:400};
  const hash=await digest("actor:v1:"+actor);
  const issue=kind==="ep"?day:week;
  const {data:record,error}=await db.from("humkin_league_records").insert({
    kind,issue_key:issue,title:first+" "+last,curator:"DIAL "+hash.slice(0,5).toUpperCase(),
    creator_hash:hash,track_ids:tracks
  }).select("id,title,kind,issue_key,curator,track_ids").single();
  if(error) {
    if(error.code==="23505")return {error:"You've already released a "+kind+" for this round",status:409};
    throw error;
  }
  return {record:{id:record.id,title:record.title,kind:record.kind,
    issue:record.issue_key,curator:record.curator,tracks:record.track_ids}};
}
Deno.serve(async(req:Request)=>{
  const origin=req.headers.get("origin")||"";
  if(req.method==="OPTIONS")return respond({},200,origin);
  if(origin&&origin!==STATION&&origin!=="https://www.humkin.abundent.org")
    return fail("This dial is for HUMKIN Radio",403,origin);
  try {
    if(req.method==="GET")return respond(await state(new URL(req.url)),200,origin);
    if(req.method!=="POST")return fail("Method unavailable",405,origin);
    if(Number(req.headers.get("content-length")||0)>MAX_BODY)
      return fail("Request too large",413,origin);
    const raw=await req.text();
    if(raw.length>MAX_BODY)return fail("Request too large",413,origin);
    let body:any;
    try{body=JSON.parse(raw);}catch{return fail("Invalid JSON",400,origin);}
    const result=body?.action==="play"?await postPlay(body,req):
      body?.action==="release"?await postRecord(body):{error:"Unknown action",status:400};
    if(result?.error)return fail(result.error,result.status||400,origin);
    return respond(result,200,origin);
  }catch(error){
    console.error("HUMKIN League API",String(error));
    return fail("The scoreboard is temporarily offline",503,origin);
  }
});
