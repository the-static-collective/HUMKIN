// TOWER 012a-b. A bounded read-only radio desk plus an authenticated,
// idempotent owner request ingress. NOT an on-air publisher or MCP OAuth server.
// Only the caller's actual Supabase owner JWT can create an intent through RLS.
import {createClient} from "npm:@supabase/supabase-js@2.57.0";
import {
  STATION,parseControl,isEligible,parseCatalogQuery,projectCatalog,
  safeSchedule,classifyIntent
} from "./contracts.mjs";

const API=Deno.env.get("SUPABASE_URL")||"";
const ANON=Deno.env.get("SUPABASE_ANON_KEY")||"";
const SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const OWNER="us@abundent.org";
const WORKER="https://humkin-long-wave.joyvolcanomusic.workers.dev/autopilot/station-one/schedule";
const ORIGINS=new Set(["https://humkin.abundent.org","https://the-static-collective.github.io"]);
const ACTIONS=new Set(["status","catalog","intents","control_request"]);
const cors=(origin:string|null)=>({
  "Access-Control-Allow-Origin":origin&&ORIGINS.has(origin)?origin:"",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Access-Control-Allow-Headers":"authorization,apikey,content-type",
  "Access-Control-Max-Age":"300",
  "Vary":"Origin"
});
function reply(body:unknown,status=200,origin:string|null=null){
  return new Response(JSON.stringify(body),{
    status,headers:{...cors(origin),"Content-Type":"application/json; charset=utf-8",
      "Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}
  });
}
const err=(code:string,status:number,origin:string|null)=>reply({ok:false,error:code},status,origin);
const basic=()=>createClient(API,ANON,{auth:{persistSession:false,autoRefreshToken:false}});
const privileged=()=>createClient(API,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
async function loadSchedule(){
  try{
    const res=await fetch(WORKER,{headers:{Accept:"application/json"},cache:"no-store",
      signal:AbortSignal.timeout(7000)});
    if(!res.ok)return {ok:false,reason:"WORKER_HTTP_"+res.status};
    const length=Number(res.headers.get("content-length")||0);
    if(length>500000)return {ok:false,reason:"WORKER_RESPONSE_TOO_LARGE"};
    const data=await res.json();
    return {ok:true,schedule:safeSchedule(data)};
  }catch{return {ok:false,reason:"WORKER_UNVERIFIED"}}
}
async function ownerContext(request:Request){
  // Never use service-role writes or a caller-supplied owner_id.
  const jwt=/^Bearer\s+([^\s]+)$/i.exec(request.headers.get("authorization")||"")?.[1];
  if(!jwt)return null;
  const {data,error}=await basic().auth.getUser(jwt);
  const user=data?.user;
  if(error||!user||user.email?.toLowerCase()!==OWNER||!user.email_confirmed_at)
    return null;
  const scoped=createClient(API,ANON,{auth:{persistSession:false,autoRefreshToken:false},
    global:{headers:{Authorization:"Bearer "+jwt}}});
  return {user,scoped};
}
async function alreadyRecorded(ownerId:string,requestId:string){
  // Service key is read-only *within this function* and only after verified owner
  // authentication; never leaked or used for recording new commands.
  const {data,error}=await privileged().from("humkin_tower_control_intents")
    .select("id,track_id,action,requested_at")
    .eq("owner_id",ownerId).eq("client_request_id",requestId).maybeSingle();
  if(error)throw Error("IDEMPOTENCY_LOOKUP_UNAVAILABLE");
  return data;
}
async function requestControl(request:Request,body:Record<string,unknown>,origin:string|null){
  let command:{command:string;track_id:string;request_id:string};
  try{command=parseControl(body)}catch(error){
    return err(error instanceof Error?error.message:"INVALID_COMMAND",422,origin);
  }
  const principal=await ownerContext(request);
  if(!principal)return err("OWNER_SESSION_REQUIRED",401,origin);
  if(!SERVICE)return err("IDEMPOTENCY_SERVICE_UNAVAILABLE",503,origin);
  let existing;
  try{existing=await alreadyRecorded(principal.user.id,command.request_id)}
  catch{return err("IDEMPOTENCY_NOT_READY",503,origin)}
  if(existing){
    if(existing.track_id!==command.track_id||existing.action!==command.command)
      return err("IDEMPOTENCY_KEY_REUSED_FOR_ANOTHER_COMMAND",409,origin);
    return reply({ok:true,state:"REQUESTED",duplicate:true,
      request_id:command.request_id,command_id:existing.id,
      requested_at:existing.requested_at,
      message:"Previously recorded command; on-air change not established"},200,origin);
  }
  // A race or revoked publication after this read is still stopped by table RLS.
  const {data:track,error:trackError}=await principal.scoped
    .from("humkin_radio_tracks")
    .select("id,kind,enabled,published_at,storage_provider,duration_seconds")
    .eq("id",command.track_id).maybeSingle();
  if(trackError)return err("CATALOG_UNAVAILABLE",503,origin);
  if(!isEligible(track,command.command))return err("TRACK_NOT_ELIGIBLE",409,origin);
  // Bounded operator admission. Cloud runner independently enforces its own
  // max pending, revision and safe-boundary limits.
  const since=new Date(Date.now()-3600000).toISOString();
  const {count,error:rateError}=await privileged()
    .from("humkin_tower_control_intents")
    .select("id",{count:"exact",head:true})
    .eq("owner_id",principal.user.id).gte("requested_at",since);
  if(rateError)return err("COMMAND_RATE_UNAVAILABLE",503,origin);
  if((count||0)>=20)return err("HOURLY_OWNER_COMMAND_LIMIT",429,origin);

  const {data, error}=await principal.scoped.from("humkin_tower_control_intents")
    .insert({owner_id:principal.user.id,track_id:command.track_id,
      action:command.command,client_request_id:command.request_id})
    .select("id,track_id,action,requested_at").single();
  if(error||!data){
    // The unique index catches racing retries; report only the original receipt.
    if(error?.code==="23505"){
      try{
        const saved=await alreadyRecorded(principal.user.id,command.request_id);
        if(saved?.track_id===command.track_id&&saved?.action===command.command)
          return reply({ok:true,state:"REQUESTED",duplicate:true,
            request_id:command.request_id,command_id:saved.id,
            requested_at:saved.requested_at},200,origin);
      }catch{ /* remain a non-committal failure */ }
    }
    return err("COMMAND_NOT_RECORDED",503,origin);
  }
  return reply({ok:true,state:"REQUESTED",duplicate:false,
    request_id:command.request_id,command_id:data.id,requested_at:data.requested_at,
    message:"Recorded owner intent, not yet accepted by Cloud HOUSE"},201,origin);
}
Deno.serve(async(request:Request)=>{
  const origin=request.headers.get("origin");
  if(request.method==="OPTIONS")
    return new Response(null,{status:204,headers:cors(origin)});
  if(request.method!=="POST")return err("METHOD_NOT_ALLOWED",405,origin);
  if(origin&&!ORIGINS.has(origin))return err("ORIGIN_NOT_ALLOWED",403,origin);
  if(!API||!ANON)return err("SUPABASE_READ_UNAVAILABLE",503,origin);
  let body:Record<string,unknown>;
  try{
    const text=await request.text();
    if(text.length>4096)return err("REQUEST_TOO_LARGE",413,origin);
    body=JSON.parse(text);
    if(!body||Array.isArray(body)||typeof body!=="object")
      return err("INVALID_REQUEST",400,origin);
  }catch{return err("INVALID_JSON",400,origin)}
  const action=body.action;
  if(typeof action!=="string"||!ACTIONS.has(action))
    return err("UNKNOWN_ACTION",422,origin);
  if(action==="control_request")
    return requestControl(request,body,origin);
  if(body.station_id!==STATION)
    return err("UNSUPPORTED_STATION",422,origin);

  if(action==="status"){
    const cloud=await loadSchedule();
    return cloud.ok?reply({ok:true,source:"cloud_worker_public_schedule",
      schedule:cloud.schedule},200,origin):
      reply({ok:false,verified:false,reason:cloud.reason},503,origin);
  }
  if(action==="catalog"){
    let search:string;
    try{search=parseCatalogQuery(body)}catch{return err("INVALID_QUERY",422,origin)}
    const {data,error}=await basic().from("humkin_radio_tracks")
      .select("id,title,artist,album,kind,duration_seconds,enabled,published_at,storage_provider")
      .eq("enabled",true).eq("storage_provider","r2").not("published_at","is",null)
      .order("title",{ascending:true}).limit(500);
    if(error||!data)return err("CATALOG_UNAVAILABLE",503,origin);
    return reply({ok:true,source:"supabase_public_eligible_catalog",
      ...projectCatalog(data,search)},200,origin);
  }
  const {data,error}=await basic().from("humkin_tower_control_intents")
    .select("id,track_id,action,requested_at").order("id",{ascending:false}).limit(12);
  if(error)return err("INTENTS_UNAVAILABLE",503,origin);
  const cloud=await loadSchedule();
  return reply({ok:true,source:"supabase_public_intent_projection",
    cloud_verified:cloud.ok,cloud_reason:cloud.ok?null:cloud.reason,
    records:(data||[]).map((item:any)=>({
      id:item.id,track_id:item.track_id,action:item.action,
      requested_at:item.requested_at,
      state:classifyIntent(Number(item.id),cloud.ok?cloud.schedule:null)
    }))},200,origin);
});
