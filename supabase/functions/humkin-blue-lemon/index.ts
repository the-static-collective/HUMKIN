// HUMKIN BLUE LEMON 001. Isolated from Orchard, Top42, guild credits and rotation config.
// Production starts with ZERO issued card credentials. Worker keys are separately provisioned.
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
const db = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "", {
  auth: { persistSession: false, autoRefreshToken: false }
});
const ORIGIN = "https://humkin.abundent.org";
const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Vary": "Origin" };
function response(req: Request, data: unknown, status = 200) {
  const origin = req.headers.get("origin");
  const headers: Record<string,string> = { ...JSON_HEADERS };
  if (origin === ORIGIN) headers["Access-Control-Allow-Origin"] = ORIGIN;
  return new Response(JSON.stringify(data), { status, headers });
}
function failure(req: Request, status: number, code: string) { return response(req, {ok:false,error:code}, status); }
const today = (now: Date) => new Intl.DateTimeFormat("en-CA", {
  timeZone:"America/Chicago",year:"numeric",month:"2-digit",day:"2-digit"
}).format(now);
async function hash(secret: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return [...new Uint8Array(bytes)].map(n => n.toString(16).padStart(2, "0")).join("");
}
function tokenOK(value: unknown) {return typeof value === "string" && value.length >= 32 && value.length <= 160 && /^[A-Za-z0-9_-]+$/.test(value);}
async function workerAuth(req: Request) {
  const secret = req.headers.get("x-humkin-worker-key");
  if (!tokenOK(secret)) return null;
  const digest = await hash(secret!);
  const {data,error} = await db.from("humkin_lemon_workers").select("worker_id").eq("secret_sha256", digest).eq("enabled",true).maybeSingle();
  return error ? null : data?.worker_id || null;
}
async function activeWorker() {
  const cutoff = new Date(Date.now() - 150000).toISOString();
  const {data,error}=await db.from("humkin_lemon_workers").select("worker_id").eq("enabled",true).gte("last_seen_at",cutoff).limit(1);
  return !error && !!data?.length;
}
async function publicCatalog(req: Request) {
  const {data,error}=await db.from("humkin_lemon_catalog").select("track_id,title,artist").eq("enabled",true).order("title").limit(1000);
  return error ? failure(req,503,"CATALOG_UNAVAILABLE") : response(req,{ok:true,tracks:data});
}
async function publicHealth(req: Request) {
  const ready=await activeWorker();
  const {count}=await db.from("humkin_lemon_catalog").select("track_id",{head:true,count:"exact"}).eq("enabled",true);
  return response(req,{ok:true,schema:"humkin.blue-lemon/v1",connected:ready,catalog_count:count||0,issued_cards_disclosed:false});
}
async function workerAction(req:Request, action:string, body:Record<string,unknown>, workerId:string) {
  if (action==="worker_heartbeat" || action==="worker_offline") {
    const {error}=await db.from("humkin_lemon_workers")
      .update({last_seen_at:action==="worker_offline"?null:new Date().toISOString()})
      .eq("worker_id",workerId);
    return error?failure(req,503,"WORKER_STATE_UNAVAILABLE"):response(req,{ok:true,connected:action!=="worker_offline"});
  }
  if (action==="worker_catalog") {
    const tracks=body.tracks;
    if (!Array.isArray(tracks) || !tracks.length || tracks.length>1000) return failure(req,400,"CATALOG_INVALID");
    const ids=new Set<string>(); const now=new Date().toISOString();
    const cleaned=[];
    for (const t of tracks) {
      if (!t || typeof t!=="object") return failure(req,400,"CATALOG_INVALID");
      const item=t as Record<string,unknown>;
      const id=item.id,title=item.title,artist=item.artist;
      if (typeof id!=="string" || id.length<2 || id.length>160 || !/^[A-Za-z0-9._:-]+$/.test(id) || ids.has(id)
        || typeof title!=="string" || title.length<1 || title.length>200
        || typeof artist!=="string" || artist.length<1 || artist.length>200) return failure(req,400,"CATALOG_INVALID");
      ids.add(id);cleaned.push({track_id:id,title,artist,enabled:true,updated_at:now});
    }
    const {error:offError}=await db.from("humkin_lemon_catalog").update({enabled:false,updated_at:now}).eq("enabled",true);
    if (offError) return failure(req,503,"CATALOG_SYNC_FAILED");
    const {error}=await db.from("humkin_lemon_catalog").upsert(cleaned,{onConflict:"track_id"});
    return error?failure(req,503,"CATALOG_SYNC_FAILED"):response(req,{ok:true,eligible:cleaned.length});
  }
  if (action==="worker_next") {
    // Only claim at a real music boundary. Caller is a registered playout worker.
    const expiry=new Date(Date.now()-1).toISOString();
    await db.from("humkin_lemon_queue").update({status:"queued",lease_worker:null,lease_until:null})
      .eq("status","leased").lt("lease_until",expiry);
    const cutoff=new Date(Date.now()-86400000).toISOString();
    for(let tries=0;tries<4;tries++) {
      const {data,error}=await db.from("humkin_lemon_queue").select("id,track_id")
        .eq("status","queued").gte("submitted_at",cutoff)
        .order("submitted_at",{ascending:true}).order("id",{ascending:true}).limit(1);
      if(error)return failure(req,503,"QUEUE_UNAVAILABLE");
      if(!data?.length)return response(req,{ok:true,request:null});
      const candidate=data[0];
      const leaseUntil=new Date(Date.now()+1800000).toISOString();
      const {data:claimed,error:claimError}=await db.from("humkin_lemon_queue")
        .update({status:"leased",lease_worker:workerId,lease_until:leaseUntil})
        .eq("id",candidate.id).eq("status","queued").select("id,track_id").maybeSingle();
      if(claimError)return failure(req,503,"QUEUE_UNAVAILABLE");
      if(claimed)return response(req,{ok:true,request:claimed});
    }
    return failure(req,409,"QUEUE_CONTENTION");
  }
  if (action==="worker_finish") {
    const id=body.id,status=body.status;
    if(typeof id!=="string" || !/^[0-9a-f-]{36}$/i.test(id) || !["aired","failed"].includes(String(status)))
      return failure(req,400,"INVALID_FINISH");
    const {data,error}=await db.from("humkin_lemon_queue")
      .update({status,lease_until:null,aired_at:null})
      .eq("id",id).eq("status","leased").eq("lease_worker",workerId).select("id").maybeSingle();
    if(error)return failure(req,503,"QUEUE_UNAVAILABLE");
    if(!data)return failure(req,409,"NOT_LEASED_BY_WORKER");
    if(status==="aired"){
      await db.from("humkin_lemon_queue").update({aired_at:new Date().toISOString()}).eq("id",id).eq("status","aired");
    }
    return response(req,{ok:true,id,status});
  }
  return failure(req,400,"UNKNOWN_ACTION");
}
async function squeeze(req:Request, body:Record<string,unknown>) {
  const secret=body.claim_code,track=body.track_id;
  if(!tokenOK(secret)||typeof track!=="string"||track.length>160)return failure(req,400,"INVALID_REQUEST");
  if(!await activeWorker())return failure(req,503,"TRANSMITTER_NOT_CONNECTED");
  const digest=await hash(secret as string);
  const {data:card,error}=await db.from("humkin_lemon_cards").select("serial").eq("claim_sha256",digest).eq("enabled",true).maybeSingle();
  if(error)return failure(req,503,"CARD_CHECK_UNAVAILABLE");
  if(!card)return failure(req,403,"CARD_NOT_RECOGNIZED");
  const {data:song}=await db.from("humkin_lemon_catalog").select("track_id").eq("track_id",track).eq("enabled",true).maybeSingle();
  if(!song)return failure(req,422,"SONG_NOT_ELIGIBLE");
  const {data, error:insertError}=await db.from("humkin_lemon_queue")
    .insert({serial:card.serial,track_id:track,station_day:today(new Date())})
    .select("id,station_day,status").single();
  if(insertError){
    if(insertError.code==="23505")return failure(req,409,"ALREADY_SQUEEZED_TODAY");
    return failure(req,503,"QUEUE_UNAVAILABLE");
  }
  return response(req,{ok:true,...data});
}
Deno.serve(async (req:Request) => {
  if(req.method==="OPTIONS"){
    if(req.headers.get("origin")!==ORIGIN)return new Response(null,{status:403});
    return new Response(null,{status:204,headers:{
      "Access-Control-Allow-Origin":ORIGIN,
      "Access-Control-Allow-Methods":"GET, POST, OPTIONS",
      "Access-Control-Allow-Headers":"Content-Type, x-humkin-worker-key, apikey",
      "Access-Control-Max-Age":"600","Vary":"Origin"}});
  }
  try{
    if(req.method==="GET"){
      const action=new URL(req.url).searchParams.get("action")||"health";
      if(action==="health")return await publicHealth(req);
      if(action==="catalog")return await publicCatalog(req);
      return failure(req,404,"NOT_FOUND");
    }
    if(req.method!=="POST")return failure(req,405,"METHOD_NOT_ALLOWED");
    if(Number(req.headers.get("content-length")||0)>200000)return failure(req,413,"BODY_TOO_LARGE");
    const raw=await req.text();
    if(raw.length>200000)return failure(req,413,"BODY_TOO_LARGE");
    let body:Record<string,unknown>;
    try{body=JSON.parse(raw);}catch{return failure(req,400,"BAD_JSON");}
    if(!body||typeof body!=="object"||Array.isArray(body))return failure(req,400,"BAD_JSON");
    const action=body.action;
    if(typeof action!=="string")return failure(req,400,"UNKNOWN_ACTION");
    if(action.startsWith("worker_")){
      const workerId=await workerAuth(req);
      if(!workerId)return failure(req,401,"WORKER_UNAUTHORIZED");
      return await workerAction(req,action,body,workerId);
    }
    if(action==="squeeze")return await squeeze(req,body);
    return failure(req,400,"UNKNOWN_ACTION");
  }catch(err){
    console.error("HUMKIN Blue Lemon request failed",err instanceof Error?err.name:"unknown");
    return failure(req,503,"TEMPORARILY_UNAVAILABLE");
  }
});
