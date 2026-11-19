import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.57.0";

/** Account-free proposals; verified owner editorial review; NO automatic airtime.
 * All DB operations use server-held service role against RLS-closed table.
 * The only public mutation creates/withdraws pending proposals.
 */
const BASE=Deno.env.get("SUPABASE_URL")||"";
const SECRET=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const OWNER="us@abundent.org";
const ORIGINS=new Set(["https://humkin.abundent.org","https://www.humkin.abundent.org"]);
const db=createClient(BASE,SECRET,{auth:{persistSession:false,autoRefreshToken:false}});
const TABLE="humkin_program_proposals",SCHEMA="humkin.program.proposal/v1";
const CONDITIONS=new Set(["unheard","new-album","night","short","always"]);
const ACTIONS=new Set(["least-played","different-album","shortest","longest","surprise"]);
const DURATIONS=new Set([30,60,90,120]);
const STATION=/^[a-z0-9][a-z0-9-]{0,31}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}$/i;
function response(data:unknown,status=200,origin=""){
 const allowed=ORIGINS.has(origin)?origin:"https://humkin.abundent.org";
 return new Response(JSON.stringify(data),{status,headers:{
  "Content-Type":"application/json; charset=utf-8",
  "Cache-Control":"no-store","Access-Control-Allow-Origin":allowed,
  "Access-Control-Allow-Methods":"GET,POST,OPTIONS",
  "Access-Control-Allow-Headers":"authorization,apikey,content-type",
  "Vary":"Origin","X-Content-Type-Options":"nosniff"}});
}
function error(message:string,status=400,origin=""){return response({error:message},status,origin)}
function localDay(now=Date.now()){
 const bits=Object.fromEntries(new Intl.DateTimeFormat("en-US",{
  timeZone:"America/Chicago",year:"numeric",month:"2-digit",day:"2-digit"
 }).formatToParts(new Date(now)).map(p=>[p.type,p.value]));
 return bits.year+"-"+bits.month+"-"+bits.day;
}
function dateMs(raw:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))return NaN;
 const n=Date.parse(raw+"T00:00:00Z");
 return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===raw?n:NaN;
}
function clean(raw:unknown,max:number){return typeof raw==="string"?raw.trim().slice(0,max):""}
function validate(payload:any){
 if(!payload||payload.schema!==SCHEMA)throw Error("Unsupported Gambit proposal");
 const title=clean(payload.title,81),station_id=clean(payload.station_id,32);
 const day=clean(payload.day,10),time=clean(payload.time,5),note=clean(payload.note,501);
 const today=dateMs(localDay()),requested=dateMs(day);
 const minutes=Number(payload.minutes);
 if(title.length<3||title.length>80||!STATION.test(station_id))
  throw Error("Invalid title or station");
 if(!Number.isFinite(requested)||requested<today||requested>today+31*86400000)
  throw Error("Choose a valid programming date within one month");
 if(!/^(?:[01]\d|2[0-3]):(?:00|15|30|45)$/.test(time)||!DURATIONS.has(minutes))
  throw Error("Choose a quarter-hour start and 30–120 minute duration");
 if(typeof payload.note==="string"&&payload.note.trim().length>500)
  throw Error("Programming note too long");
 if(!Array.isArray(payload.rules)||payload.rules.length<1||payload.rules.length>8)
  throw Error("Propose 1–8 ordered Gambits");
 const rules=payload.rules.map((r:any)=>{
  if(!r||!CONDITIONS.has(r.when)||!ACTIONS.has(r.action)||typeof r.enabled!=="boolean")
   throw Error("Invalid priority rule");
  return {when:r.when,action:r.action,enabled:r.enabled};
 });
 if(!rules.some((r:any)=>r.enabled))throw Error("Enable at least one Gambit");
 return {schema:SCHEMA,title,station_id,day,time,minutes,rules,note};
}
async function hmac(raw:string){
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(SECRET),
   {name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const hash=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(raw));
 return Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,"0")).join("");
}
async function owner(req:Request){
 const token=/^Bearer\s+(.+)$/i.exec(req.headers.get("authorization")||"")?.[1];
 if(!token)throw Error("OWNER_AUTH_REQUIRED");
 const {data,error:err}=await db.auth.getUser(token);
 if(err||!data?.user||data.user.email?.toLowerCase()!==OWNER||!data.user.email_confirmed_at)
  throw Error("OWNER_AUTH_REQUIRED");
 return data.user.id;
}
async function submit(body:any,req:Request){
 if(!UUID.test(String(body.listener||"")))throw Error("Invalid participation pass");
 const proposal=validate(body.proposal);
 const actor=await hmac("daily-program-actor:"+body.listener);
 const network=await hmac("daily-program-network:"+
  (req.headers.get("cf-connecting-ip")||"unavailable").slice(0,128));
 const now=new Date(),today=localDay();
 const start=today+"T00:00:00Z";
 const week=new Date(now.getTime()-7*86400000).toISOString();
 const queries=await Promise.all([
  db.from(TABLE).select("id",{count:"exact",head:true}).eq("actor_hash",actor).gte("created_at",start),
  db.from(TABLE).select("id",{count:"exact",head:true}).eq("network_hash",network).gte("created_at",start),
  db.from(TABLE).select("id",{count:"exact",head:true}).gte("created_at",start),
  db.from(TABLE).select("id",{count:"exact",head:true}).eq("actor_hash",actor).gte("created_at",week)
 ]);
 if(queries.some(x=>x.error))throw Error("QUEUE_UNAVAILABLE");
 if((queries[0].count||0)>=3||(queries[1].count||0)>=12||
    (queries[2].count||0)>=60||(queries[3].count||0)>=8)
  throw Error("Daily or weekly contribution limit reached");
 const record={actor_hash:actor,network_hash:network,title:proposal.title,
  station_id:proposal.station_id,day:proposal.day,start_local:proposal.time,
  duration_minutes:proposal.minutes,proposal,state:"pending_review"};
 const {data,error:err}=await db.from(TABLE).insert(record).select("id,state,created_at").single();
 if(err||!data)throw Error("SUBMISSION_UNAVAILABLE");
 return {schema:"humkin.program.receipt/v1",id:data.id,state:data.state,created_at:data.created_at,
  message:"Submitted for editorial review. No program is on air; no HUM was awarded."};
}
async function mine(listener:string){
 if(!UUID.test(listener))throw Error("Invalid participation pass");
 const actor=await hmac("daily-program-actor:"+listener);
 const {data,error:err}=await db.from(TABLE)
  .select("id,title,station_id,day,start_local,duration_minutes,state,created_at,review_note")
  .eq("actor_hash",actor).order("created_at",{ascending:false}).limit(25);
 if(err)throw Error("QUEUE_UNAVAILABLE");
 return {schema:"humkin.program.mine/v1",items:data||[]};
}
async function ownerList(req:Request){
 await owner(req);
 const {data,error:err}=await db.from(TABLE)
  .select("id,proposal,title,station_id,day,start_local,duration_minutes,state,created_at,review_note,reviewed_at")
  .in("state",["pending_review","approved"]).order("created_at",{ascending:false}).limit(100);
 if(err)throw Error("QUEUE_UNAVAILABLE");
 return {schema:"humkin.program.owner/v1",items:data||[]};
}
async function reviewed(id:string,req:Request){
 await owner(req);
 if(!UUID.test(id))throw Error("Invalid proposal ID");
 const {data,error:err}=await db.from(TABLE)
  .select("id,proposal,station_id,state,reviewed_at,reviewed_by,review_note")
  .eq("id",id).eq("state","approved").maybeSingle();
 if(err||!data)throw Error("APPROVED_PROPOSAL_NOT_FOUND");
 return {schema:"humkin.program.reviewed/v1",
  id:data.id,state:data.state,reviewed_at:data.reviewed_at,
  reviewed_by:data.reviewed_by,review_note:data.review_note,
  proposal:data.proposal,
  warning:"Editorially approved only. Operator must recheck approved media and explicitly publish via R2 vault."};
}
async function review(body:any,req:Request){
 const reviewer=await owner(req);
 const id=String(body.id||""),approve=body.approve===true;
 const note=clean(body.note,501);
 if(!UUID.test(id)||note.length>500||body.approve!==true&&body.approve!==false)
  throw Error("Invalid review");
 if(approve&&!body.catalog_checked)throw Error("Check catalog eligibility before editorial approval");
 const state=approve?"approved":"declined";
 const {data,error:err}=await db.from(TABLE)
  .update({state,reviewed_by:reviewer,review_note:note,reviewed_at:new Date().toISOString()})
  .eq("id",id).eq("state","pending_review").select("id,state").maybeSingle();
 if(err||!data)throw Error("PROPOSAL_NOT_PENDING");
 return {reviewed:true,id:data.id,state:data.state,airtime:false};
}
async function withdraw(body:any){
 const id=String(body.id||""),listener=String(body.listener||"");
 if(!UUID.test(id)||!UUID.test(listener))throw Error("Invalid receipt/pass");
 const actor=await hmac("daily-program-actor:"+listener);
 const {data,error:err}=await db.from(TABLE)
  .update({state:"withdrawn"}).eq("id",id).eq("actor_hash",actor)
  .eq("state","pending_review").select("id").maybeSingle();
 if(err||!data)throw Error("PROPOSAL_NOT_PENDING");
 return {withdrawn:true,id};
}
Deno.serve(async req=>{
 const origin=req.headers.get("origin")||"";
 if(req.method==="OPTIONS")return response({},204,origin);
 if(origin&&!ORIGINS.has(origin))return error("Origin not permitted",403,origin);
 try{
  if(req.method==="GET"){
   const url=new URL(req.url),mode=url.searchParams.get("mode")||"mine";
   if(mode==="mine")return response(await mine(url.searchParams.get("listener")||""),200,origin);
   if(mode==="owner")return response(await ownerList(req),200,origin);
   if(mode==="approved")return response(await reviewed(url.searchParams.get("id")||"",req),200,origin);
   return error("Unknown mode",404,origin);
  }
  if(req.method!=="POST")return error("Method not allowed",405,origin);
  if(Number(req.headers.get("content-length")||0)>6000)return error("Request too large",413,origin);
  const bodyText=await req.text();
  if(bodyText.length>6000)return error("Request too large",413,origin);
  let body:any;try{body=JSON.parse(bodyText)}catch{return error("Invalid JSON",400,origin)}
  const result=body?.action==="submit"?await submit(body,req):
    body?.action==="review"?await review(body,req):
    body?.action==="withdraw"?await withdraw(body):
    null;
  return result?response(result,200,origin):error("Unknown action",400,origin);
 }catch(err){
  const message=err instanceof Error?err.message:"UNKNOWN_ERROR";
  if(message==="OWNER_AUTH_REQUIRED")return error("Owner authorization required",403,origin);
  if(/QUEUE_UNAVAILABLE|SUBMISSION_UNAVAILABLE/.test(message))
   return error("Programming queue unavailable",503,origin);
  if(message==="PROPOSAL_NOT_PENDING")return error("Already reviewed or withdrawn",409,origin);
  if(message==="APPROVED_PROPOSAL_NOT_FOUND")return error("Approved proposal unavailable",404,origin);
  return error(message.slice(0,140),400,origin);
 }
});
