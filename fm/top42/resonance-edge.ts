import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.57.0";

/**
 * HUMKIN Listener Weather v1.
 * One anonymous, explicitly shared song-feeling per station week per local
 * random listener key; corrections replace rather than accumulate.
 * Self-reported responses are provisional. They do NOT count as chart plays.
 * Raw reaction rows, visitor network hashes and device hashes stay private.
 */
const URL_BASE=Deno.env.get("SUPABASE_URL")??"";
const SECRET=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
const db=createClient(URL_BASE,SECRET,{auth:{persistSession:false,autoRefreshToken:false}});
const STATION="https://humkin.abundent.org";
const ALLOWED=[STATION,"https://www.humkin.abundent.org"];
const LEAGUE=URL_BASE+"/functions/v1/humkin-league";
const CODES=new Set(["hope","tears","seen","laugh","move","stayed"]);
const MAX_BYTES=2000;

function weekAt(now=Date.now()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat("en-US",{
    timeZone:"America/Chicago",year:"numeric",month:"2-digit",day:"2-digit"
  }).formatToParts(new Date(now)).map(part=>[part.type,part.value]));
  const day=parts.year+"-"+parts.month+"-"+parts.day;
  const date=new Date(day+"T12:00:00Z");
  date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7);
  return date.toISOString().slice(0,10);
}
function respond(value:unknown,status=200,origin=""){
  return new Response(JSON.stringify(value),{status,headers:{
    "Content-Type":"application/json; charset=utf-8",
    "Cache-Control":"no-store",
    "Access-Control-Allow-Origin":ALLOWED.includes(origin)?origin:STATION,
    "Access-Control-Allow-Headers":"content-type,authorization,apikey",
    "Access-Control-Allow-Methods":"GET,POST,OPTIONS",
    "Vary":"Origin"
  }});
}
async function hash(value:string){
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(SECRET),
      {name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const bytes=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,"0")).join("");
}
async function catalogId(id:string){
  // The existing TOP 42 authority already reconciles owner-approved static
  // tracks and published cloud tracks. Never trust client-supplied titles.
  const res=await fetch(LEAGUE,{signal:AbortSignal.timeout(6000),headers:{Accept:"application/json"}});
  if(!res.ok)throw Error("Chart catalog unavailable");
  const data=await res.json();
  return data?.schema==="humkin.top42/v1" &&
    Array.isArray(data.catalog) && data.catalog.some((row:any)=>row?.id===id);
}
async function publicBoard(){
  const week=weekAt();
  const {data,error}=await db.from("humkin_listener_weather")
    .select("track_id,feeling").eq("station_week",week)
    .order("id",{ascending:false}).limit(5000);
  if(error)throw error;
  const tracks=new Map<string,Map<string,number>>();
  for(const row of data??[]){
    if(!CODES.has(row.feeling))continue;
    if(!tracks.has(row.track_id))tracks.set(row.track_id,new Map());
    const bucket=tracks.get(row.track_id)!;
    bucket.set(row.feeling,(bucket.get(row.feeling)||0)+1);
  }
  const ranked=[...tracks].map(([id,feels])=>({
    id,total:[...feels.values()].reduce((a,b)=>a+b,0),
    feelings:Object.fromEntries(feels)
  })).sort((a,b)=>b.total-a.total||a.id.localeCompare(b.id)).slice(0,42);
  return {schema:"humkin.listener-weather/v1",week_start:week,tracks:ranked,
    provisional:true,truncated:(data??[]).length===5000,
    definition:"Distinct app-submitted, anonymous self-reports this station week. One current feeling per song and random listener key. Not verified people, chart plays or votes."};
}
async function react(body:any,req:Request){
  const id=String(body?.track_id??"");
  const feel=String(body?.feeling??"");
  const token=String(body?.listener??"");
  if(!/^[-a-zA-Z0-9]{3,90}$/.test(id)||!CODES.has(feel)||
      !/^[0-9a-f-]{36}$/i.test(token))
    return {error:"Invalid song response",status:400};
  if(!await catalogId(id))
    return {error:"Song is not currently on the published chart catalog",status:400};
  const week=weekAt();
  const actor=await hash("resonance.actor.v1:"+token);
  const reportedNetwork=(req.headers.get("cf-connecting-ip")
    ||req.headers.get("x-real-ip")||"unreported:"+token).slice(0,128);
  const network=await hash("resonance.network.v1:"+reportedNetwork);
  const since=new Date(Date.now()-86400000).toISOString();
  const [perActor,perNetwork]=await Promise.all([
    db.from("humkin_listener_weather").select("id",{head:true,count:"exact"})
      .eq("actor_hash",actor).eq("station_week",week),
    db.from("humkin_listener_weather").select("id",{head:true,count:"exact"})
      .eq("network_hash",network).gte("updated_at",since)
  ]);
  if(perActor.error||perNetwork.error)throw perActor.error||perNetwork.error;
  if((perActor.count??0)>=60||(perNetwork.count??0)>=600)
    return {error:"The Listener Weather desk is at capacity for this connection",status:429};
  const {error}=await db.from("humkin_listener_weather").upsert({
    station_week:week,track_id:id,feeling:feel,actor_hash:actor,
    network_hash:network,updated_at:new Date().toISOString()
  },{onConflict:"station_week,track_id,actor_hash"});
  if(error)throw error;
  return {accepted:true,week_start:week,
    note:"Saved as one provisional Listener Weather response; no Top 42 play was created."};
}

Deno.serve(async(req:Request)=>{
  const origin=req.headers.get("origin")??"";
  if(req.method==="OPTIONS")return respond({},200,origin);
  // Native Android sends no Origin. Browsers must be station same-origin.
  if(origin&&!ALLOWED.includes(origin))return respond({error:"Station origin only"},403,origin);
  try{
    if(req.method==="GET")return respond(await publicBoard(),200,origin);
    if(req.method!=="POST")return respond({error:"Method not available"},405,origin);
    if(Number(req.headers.get("content-length")??"0")>MAX_BYTES)
      return respond({error:"Request too large"},413,origin);
    const raw=await req.text();
    if(raw.length>MAX_BYTES)return respond({error:"Request too large"},413,origin);
    let body:any;
    try{body=JSON.parse(raw)}catch{return respond({error:"Unreadable response"},400,origin)}
    if(body?.action!=="react")return respond({error:"Unknown action"},400,origin);
    const result=await react(body,req);
    return (result as any).error?respond({error:(result as any).error},(result as any).status||400,origin)
      :respond(result,200,origin);
  }catch(error){
    console.warn("HUMKIN Listener Weather unavailable",String(error));
    return respond({error:"The Listener Weather is temporarily offline"},503,origin);
  }
});
