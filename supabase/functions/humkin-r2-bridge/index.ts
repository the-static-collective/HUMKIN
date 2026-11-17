// HUMKIN RADIO — owner-only verified Supabase Storage → Cloudflare R2 bridge.
// No R2 credentials or Supabase service-role tokens are sent to the browser.
import {createClient} from "npm:@supabase/supabase-js@2.57.0";
import {AwsClient} from "npm:aws4fetch@1.0.20";

const API=Deno.env.get("SUPABASE_URL")||"";
const SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const ACCOUNT=Deno.env.get("HUMKIN_R2_ACCOUNT_ID")||"";
const ACCESS=Deno.env.get("HUMKIN_R2_ACCESS_KEY_ID")||"";
const SECRET=Deno.env.get("HUMKIN_R2_SECRET_ACCESS_KEY")||"";
const BUCKET="humkin-radio-media";
const PUBLIC="https://media.abundent.org";
const OWNER="us@abundent.org";
const MAX_BYTES=64*1024*1024;
const ORIGINS=new Set(["https://humkin.abundent.org",
 "https://the-static-collective.github.io"]);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX=/^[0-9a-f]{64}$/;
const KEY=/^[0-9a-f-]{36}\/[0-9a-f]{64}\.mp3$/;
const configured=Boolean(API&&SERVICE&&/^[0-9a-f]{32}$/i.test(ACCOUNT)&&ACCESS&&SECRET);
function cors(origin:string|null){
 const allowed=origin&&ORIGINS.has(origin)?origin:"";
 return {"Access-Control-Allow-Origin":allowed,
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info",
  "Access-Control-Max-Age":"600","Vary":"Origin"};
}
function reply(body:Record<string,unknown>,status=200,origin:string|null=null){
 return new Response(JSON.stringify(body),{status,headers:{
  ...cors(origin),"Content-Type":"application/json","Cache-Control":"no-store"}});
}
async function digestHex(bytes:ArrayBuffer){
 const hash=new Uint8Array(await crypto.subtle.digest("SHA-256",bytes));
 return Array.from(hash,b=>b.toString(16).padStart(2,"0")).join("");
}
function r2Url(key:string){
 const url=new URL(`https://${ACCOUNT}.r2.cloudflarestorage.com/${BUCKET}/${key}`);
 return url.href;
}
const failure=(code:string,status:number,origin:string|null)=>reply({ok:false,error:code},status,origin);

Deno.serve(async(request:Request)=>{
 const origin=request.headers.get("origin");
 if(request.method==="OPTIONS")
  return new Response(null,{status:204,headers:cors(origin)});
 if(request.method!=="POST")return failure("METHOD_NOT_ALLOWED",405,origin);
 if(origin&&!ORIGINS.has(origin))return failure("ORIGIN_NOT_ALLOWED",403,origin);
 if(!API||!SERVICE)return failure("SUPABASE_NOT_CONFIGURED",503,origin);
 const token=/^Bearer\s+(.+)$/i.exec(request.headers.get("authorization")||"")?.[1];
 if(!token)return failure("OWNER_SESSION_REQUIRED",401,origin);

 const db=createClient(API,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:identity,error:authError}=await db.auth.getUser(token);
 const user=identity?.user;
 if(authError||!user||user.email?.toLowerCase()!==OWNER||!user.email_confirmed_at)
  return failure("OWNER_NOT_AUTHORIZED",403,origin);

 let requestBody:{action?:unknown;track_id?:unknown};
 try{requestBody=await request.json()}catch{return failure("INVALID_JSON",400,origin)}
 const action=String(requestBody?.action||"");

 if(action==="status"){
  const {data,error}=await db.from("humkin_radio_tracks")
   .select("storage_provider,published_at,bytes,supabase_source_removed_at").limit(2000);
  if(error)return failure("CATALOG_UNAVAILABLE",503,origin);
  const all=data||[];
  const published=all.filter(r=>r.published_at);
  const r2=published.filter(r=>r.storage_provider==="r2");
  const pending=published.filter(r=>r.storage_provider!=="r2");
  return reply({ok:true,configured,r2_public_origin:PUBLIC,
   total_cloud_tracks:all.length,published_tracks:published.length,
   migrated_tracks:r2.length,pending_tracks:pending.length,
   pending_bytes:pending.reduce((s,r)=>s+Number(r.bytes||0),0),
   r2_bytes:r2.reduce((s,r)=>s+Number(r.bytes||0),0),
   private_drafts:all.length-published.length,
   supabase_copies_remaining:all.filter(r=>!r.supabase_source_removed_at).length,
   supabase_storage_estimate_bytes:all.filter(r=>!r.supabase_source_removed_at)
      .reduce((n,r)=>n+Number(r.bytes||0),0),
   reclaimable_copies:r2.filter(r=>!r.supabase_source_removed_at).length,
   reclaimable_bytes:r2.filter(r=>!r.supabase_source_removed_at)
      .reduce((n,r)=>n+Number(r.bytes||0),0)},200,origin);
 }
 if(!["publish","migrate","cleanup"].includes(action))return failure("UNKNOWN_ACTION",400,origin);
 if(!configured)return failure("R2_NOT_CONFIGURED",503,origin);
 const id=String(requestBody.track_id||"");
 if(!UUID.test(id))return failure("INVALID_TRACK_ID",400,origin);
 const {data:row,error:lookupError}=await db.from("humkin_radio_tracks")
  .select("id,uploaded_by,sha256,bytes,storage_path,published_at,storage_provider,r2_object_key,supabase_source_removed_at")
  .eq("id",id).single();
 if(lookupError||!row||row.uploaded_by!==user.id)
   return failure("TRACK_NOT_FOUND",404,origin);
 if(action==="cleanup"){
   if(row.storage_provider!=="r2"||!row.r2_object_key)
     return failure("R2_COPY_NOT_VERIFIED",409,origin);
   if(row.supabase_source_removed_at)
     return reply({ok:true,already_clean:true,track_id:id},200,origin);
   if(!/^[0-9a-f-]{36}$/.test(id)||!/^tracks\/[0-9a-f-]{36}\/[0-9a-f]{64}\.mp3$/.test(row.r2_object_key))
     return failure("INVALID_R2_METADATA",409,origin);
   const aws=new AwsClient({accessKeyId:ACCESS,secretAccessKey:SECRET,service:"s3",region:"auto"});
   const head=await aws.fetch(r2Url(row.r2_object_key),{method:"HEAD"});
   if(!head.ok||Number(head.headers.get("content-length"))!==Number(row.bytes))
     return failure("R2_COPY_NOT_AVAILABLE",409,origin);
   const publicProbe=await fetch(PUBLIC+"/"+row.r2_object_key+"?cleanup="+Date.now(),
     {method:"GET",headers:{Range:"bytes=0-0"},cache:"no-store"});
   if(!publicProbe.ok)return failure("R2_PUBLIC_DELIVERY_FAILED",409,origin);
   try{await publicProbe.body?.cancel()}catch{}
   // Redundant copies exist in either old LIVE (migrations) or INBOX (new
   // publications). Delete ONLY after verified R2 copy; never delete R2 here.
   for(const bucket of ["humkin-radio-live","humkin-radio-inbox"]){
     const {error}=await db.storage.from(bucket).remove([row.storage_path]);
     if(error)return failure("SUPABASE_COPY_DELETE_FAILED",502,origin);
   }
   const {error:updateError}=await db.from("humkin_radio_tracks")
     .update({supabase_source_removed_at:new Date().toISOString()})
     .eq("id",id).eq("uploaded_by",user.id).eq("storage_provider","r2");
   if(updateError)return failure("COPY_DELETE_RECORDED_LATER",503,origin);
   return reply({ok:true,track_id:id,source_copy_removed:true,
     bytes_reclaimed:Number(row.bytes)},200,origin);
 }
 if(row.storage_provider==="r2")
   return reply({ok:true,already_migrated:true,track_id:id,object_key:row.r2_object_key},200,origin);
 if(action==="publish"&&row.published_at)
   return failure("ALREADY_PUBLISHED_USE_MIGRATE",409,origin);
 if(action==="migrate"&&!row.published_at)
   return failure("DRAFT_USE_PUBLISH",409,origin);
 if(!HEX.test(String(row.sha256||""))||!KEY.test(String(row.storage_path||""))||
    !(Number(row.bytes)>0&&Number(row.bytes)<=MAX_BYTES))
   return failure("INVALID_SOURCE_METADATA",422,origin);
 // A completely server-derived object key. The browser cannot choose arbitrary
 // R2 paths or fetch URLs, which prevents arbitrary overwrite and SSRF.
 const key=`tracks/${id}/${row.sha256}.mp3`;
 const originBucket=row.published_at?"humkin-radio-live":"humkin-radio-inbox";
 try{
  const {data:file,error:downloadError}=await db.storage.from(originBucket).download(row.storage_path);
  if(downloadError||!file)return failure("SOURCE_NOT_AVAILABLE",409,origin);
  if(file.size!==Number(row.bytes))return failure("SOURCE_SIZE_MISMATCH",409,origin);
  const contents=await file.arrayBuffer();
  const hash=await digestHex(contents);
  if(hash!==row.sha256)return failure("SOURCE_CHECKSUM_MISMATCH",409,origin);
  const aws=new AwsClient({accessKeyId:ACCESS,secretAccessKey:SECRET,service:"s3",region:"auto"});
  const headers={"Content-Type":"audio/mpeg","Cache-Control":"public,max-age=86400"};
  const put=await aws.fetch(r2Url(key),{method:"PUT",headers,body:contents});
  if(!put.ok)return failure("R2_WRITE_FAILED_"+put.status,502,origin);
  const head=await aws.fetch(r2Url(key),{method:"HEAD"});
  if(!head.ok||Number(head.headers.get("content-length"))!==Number(row.bytes))
    return failure("R2_VERIFICATION_FAILED",502,origin);
  // Public-read verification. A written object isn't on-air until reachable by listeners.
  const publicUrl=PUBLIC+"/"+key;
  const probe=await fetch(publicUrl+"?verified="+hash.slice(0,16),{
    method:"GET",headers:{"Range":"bytes=0-0"},cache:"no-store"});
  if(!probe.ok){try{await probe.body?.cancel()}catch{}
    return failure("R2_PUBLIC_DELIVERY_FAILED",502,origin);}
  try{await probe.body?.cancel()}catch{}
  const update:Record<string,unknown>={
    storage_provider:"r2",r2_object_key:key,r2_synced_at:new Date().toISOString()};
  if(!row.published_at){update.published_at=new Date().toISOString();update.enabled=true;}
  const {data:committed,error:commitError}=await db.from("humkin_radio_tracks")
   .update(update).eq("id",id).eq("uploaded_by",user.id)
   .eq("storage_provider","supabase")
   .select("id,storage_provider,r2_object_key,published_at").single();
  if(commitError||!committed)return failure("CATALOG_COMMIT_FAILED",503,origin);
  return reply({ok:true,track_id:id,object_key:key,url:publicUrl,
    bytes:Number(row.bytes),storage_provider:"r2",source_retained:true},200,origin);
 }catch(error){
  console.error("R2 bridge operation failed",error instanceof Error?error.message:"unknown");
  return failure("R2_BRIDGE_FAILED",502,origin);
 }
});
