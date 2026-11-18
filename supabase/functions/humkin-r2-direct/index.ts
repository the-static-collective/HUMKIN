// HUMKIN RADIO — owner-only direct private R2 intake.
// Browser receives short-lived PUT authorization for one derived MP3 key, never R2 keys.
// Every file is checked in the private bucket before catalog approval/publication.
import {createClient} from "npm:@supabase/supabase-js@2.57.0";
import {AwsClient} from "npm:aws4fetch@1.0.20";

const API=Deno.env.get("SUPABASE_URL")||"";
const SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const ACCOUNT=Deno.env.get("HUMKIN_R2_ACCOUNT_ID")||"";
const PUBLIC_ACCESS=Deno.env.get("HUMKIN_R2_ACCESS_KEY_ID")||"";
const PUBLIC_SECRET=Deno.env.get("HUMKIN_R2_SECRET_ACCESS_KEY")||"";
// Reuse existing server-held public R2 credentials when they already have access
// to the separate private bucket. Never reuse an incomplete private key pair.
const PRIVATE_ACCESS_CONFIG=Deno.env.get("HUMKIN_R2_PRIVATE_ACCESS_KEY_ID")||"";
const PRIVATE_SECRET_CONFIG=Deno.env.get("HUMKIN_R2_PRIVATE_SECRET_ACCESS_KEY")||"";
const PRIVATE_PAIR_COMPLETE=Boolean(PRIVATE_ACCESS_CONFIG&&PRIVATE_SECRET_CONFIG);
const PRIVATE_ACCESS=PRIVATE_PAIR_COMPLETE?PRIVATE_ACCESS_CONFIG:PUBLIC_ACCESS;
const PRIVATE_SECRET=PRIVATE_PAIR_COMPLETE?PRIVATE_SECRET_CONFIG:PUBLIC_SECRET;
const PRIVATE_CREDENTIAL_MODE=PRIVATE_PAIR_COMPLETE?"dedicated":"existing";
const PRIVATE_BUCKET=Deno.env.get("HUMKIN_R2_PRIVATE_BUCKET")||"humkin-radio-private";
const PUBLIC_BUCKET="humkin-radio-media";
const PUBLIC_ORIGIN="https://media.abundent.org";
const OWNER="us@abundent.org";
const MAX_BYTES=50*1024*1024;
const HEX=/^[0-9a-f]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUCKET=/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
const ORIGINS=new Set(["https://humkin.abundent.org","https://the-static-collective.github.io"]);
const configured=Boolean(API&&SERVICE&&/^[0-9a-f]{32}$/i.test(ACCOUNT)&&
  PUBLIC_ACCESS&&PUBLIC_SECRET&&PRIVATE_ACCESS&&PRIVATE_SECRET&&BUCKET.test(PRIVATE_BUCKET)&&PRIVATE_BUCKET!==PUBLIC_BUCKET);

const cors=(origin:string|null)=>({
  "Access-Control-Allow-Origin":origin&&ORIGINS.has(origin)?origin:"",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info",
  "Access-Control-Max-Age":"600","Vary":"Origin"
});
const reply=(body:Record<string,unknown>,status=200,origin:string|null=null)=>
  new Response(JSON.stringify(body),{status,headers:{...cors(origin),
    "Content-Type":"application/json","Cache-Control":"no-store"}});
const fail=(code:string,status:number,origin:string|null)=>reply({ok:false,error:code},status,origin);
const aws=(access:string,secret:string)=>new AwsClient({
  accessKeyId:access,secretAccessKey:secret,service:"s3",region:"auto"});
function objectUrl(bucket:string,key=""){return `https://${ACCOUNT}.r2.cloudflarestorage.com/${bucket}${key?"/"+key:""}`;}
async function sha(bytes:ArrayBuffer){
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))]
    .map(c=>c.toString(16).padStart(2,"0")).join("");
}
function clean(input:unknown,max:number):string{
  return typeof input==="string"&&input.trim().length>=1&&input.trim().length<=max?input.trim():"";
}
function eligible(row:any,userId:string){
  return row&&row.uploaded_by===userId&&row.storage_provider==="r2_private"&&
    !row.published_at&&UUID.test(String(row.id||""))&&HEX.test(String(row.sha256||""))&&
    row.r2_staging_key===`stage/${row.id}/${row.sha256}.mp3`&&
    Number(row.bytes)>=1&&Number(row.bytes)<=MAX_BYTES;
}
async function checkBucket(client:AwsClient,bucket:string){
  try{const response=await client.fetch(objectUrl(bucket)+"?list-type=2&max-keys=1",{method:"GET"});
    if(response.body)await response.body.cancel();
    return response.ok;
  }catch{return false;}
}
async function verifyPrivate(client:AwsClient,row:any,withBytes=true){
  const key=String(row.r2_staging_key||"");
  const head=await client.fetch(objectUrl(PRIVATE_BUCKET,key),{method:"HEAD"});
  if(!head.ok||Number(head.headers.get("content-length"))!==Number(row.bytes))
    return {ok:false,error:"PRIVATE_FILE_MISSING_OR_SIZE_WRONG"} as const;
  if(!withBytes)return {ok:true} as const;
  const get=await client.fetch(objectUrl(PRIVATE_BUCKET,key),{method:"GET"});
  if(!get.ok)return {ok:false,error:"PRIVATE_FILE_NOT_READABLE"} as const;
  const bytes=await get.arrayBuffer();
  if(bytes.byteLength!==Number(row.bytes)||await sha(bytes)!==row.sha256)
    return {ok:false,error:"PRIVATE_FILE_HASH_MISMATCH"} as const;
  return {ok:true,bytes} as const;
}
Deno.serve(async(request:Request)=>{
  const origin=request.headers.get("origin");
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors(origin)});
  if(request.method!=="POST")return fail("METHOD_NOT_ALLOWED",405,origin);
  if(origin&&!ORIGINS.has(origin))return fail("ORIGIN_NOT_ALLOWED",403,origin);
  if(!API||!SERVICE)return fail("SUPABASE_NOT_CONFIGURED",503,origin);
  const token=/^Bearer\s+(.+)$/i.exec(request.headers.get("authorization")||"")?.[1];
  if(!token)return fail("OWNER_SESSION_REQUIRED",401,origin);
  const db=createClient(API,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:auth,error:authError}=await db.auth.getUser(token);
  const user=auth?.user;
  if(authError||!user||user.email?.toLowerCase()!==OWNER||!user.email_confirmed_at)
    return fail("OWNER_NOT_AUTHORIZED",403,origin);
  let body:Record<string,unknown>;
  try{body=await request.json()}catch{return fail("INVALID_JSON",400,origin)}
  const action=String(body?.action||"");
  if(action==="status"){
    if(!configured)return reply({ok:true,ready:false,reason:"PRIVATE_R2_KEYS_NOT_CONFIGURED"},200,origin);
    const privateReady=await checkBucket(aws(PRIVATE_ACCESS,PRIVATE_SECRET),PRIVATE_BUCKET);
    const publicReady=await checkBucket(aws(PUBLIC_ACCESS,PUBLIC_SECRET),PUBLIC_BUCKET);
    return reply({ok:true,ready:privateReady&&publicReady,
      reason:!privateReady?"PRIVATE_R2_BUCKET_NOT_ACCESSIBLE":!publicReady?
        "PUBLIC_R2_BUCKET_NOT_ACCESSIBLE":"READY",
      credential_mode:PRIVATE_CREDENTIAL_MODE,
      max_file_bytes:MAX_BYTES,parallel_uploads:3},200,origin);
  }
  if(!["prepare","finalize","publish"].includes(action))return fail("UNKNOWN_ACTION",400,origin);
  if(!configured)return fail("PRIVATE_R2_NOT_CONFIGURED",503,origin);
  const privateAws=aws(PRIVATE_ACCESS,PRIVATE_SECRET);
  const publicAws=aws(PUBLIC_ACCESS,PUBLIC_SECRET);
  if(action==="prepare"){
    const hash=String(body.sha256||""),bytes=Number(body.bytes);
    const title=clean(body.title,120),artist=clean(body.artist,160),
      album=clean(body.album,160),originalName=clean(body.original_name,240);
    const duration=Number(body.duration_seconds);
    const kind=String(body.kind||"song"),isSingle=body.is_single===true;
    if(!HEX.test(hash)||!Number.isInteger(bytes)||bytes<1||bytes>MAX_BYTES||
      !title||!artist||!album||!originalName||!(duration>=1&&duration<=14400)||
      !["song","bumper"].includes(kind)||kind==="bumper"&&isSingle)
      return fail("INVALID_RECORDING_METADATA",422,origin);
    let {data:row,error:lookupError}=await db.from("humkin_radio_tracks")
      .select("id,uploaded_by,sha256,bytes,storage_provider,published_at,r2_staging_key,r2_upload_verified_at")
      .eq("sha256",hash).maybeSingle();
    if(lookupError)return fail("CATALOG_UNAVAILABLE",503,origin);
    if(row&&(!eligible(row,user.id)||Number(row.bytes)!==bytes))
      return reply({ok:true,already_cataloged:true,track_id:row.id},200,origin);
    if(!row){
      const id=crypto.randomUUID(),key=`stage/${id}/${hash}.mp3`;
      const record={id,uploaded_by:user.id,sha256:hash,storage_path:`${user.id}/${hash}.mp3`,
        original_name:originalName,title,artist,album,bytes,duration_seconds:duration,
        kind,is_single:isSingle,enabled:false,storage_provider:"r2_private",
        r2_staging_key:key,r2_upload_verified_at:null};
      const added=await db.from("humkin_radio_tracks").insert(record)
        .select("id,uploaded_by,sha256,bytes,storage_provider,published_at,r2_staging_key,r2_upload_verified_at").single();
      if(added.error){
        if(added.error.code==="23505")return reply({ok:true,already_cataloged:true},200,origin);
        return fail("CATALOG_STAGE_FAILED",503,origin);
      }
      row=added.data;
    }
    if(!eligible(row,user.id))return fail("DRAFT_NOT_ELIGIBLE",409,origin);
    if(row.r2_upload_verified_at){
      const checked=await verifyPrivate(privateAws,row,false);
      if(checked.ok)return reply({ok:true,already_staged:true,track_id:row.id},200,origin);
    }
    const signed=await privateAws.sign(new Request(
      objectUrl(PRIVATE_BUCKET,row.r2_staging_key)+"?X-Amz-Expires=300",{
        method:"PUT",headers:{"Content-Type":"audio/mpeg"}}),{
        aws:{signQuery:true,allHeaders:true}});
    return reply({ok:true,track_id:row.id,put_url:signed.url.toString(),
      content_type:"audio/mpeg",expires_seconds:300},200,origin);
  }
  const id=String(body.track_id||"");
  if(!UUID.test(id))return fail("INVALID_TRACK_ID",422,origin);
  const {data:row,error:lookupError}=await db.from("humkin_radio_tracks")
    .select("id,uploaded_by,sha256,bytes,published_at,storage_provider,r2_staging_key,r2_upload_verified_at")
    .eq("id",id).single();
  if(lookupError||!eligible(row,user.id))return fail("DRAFT_NOT_FOUND",404,origin);
  try{
    const verified=await verifyPrivate(privateAws,row,true);
    if(!verified.ok)return fail(verified.error,409,origin);
    if(!verified.bytes)return fail("R2_VERIFY_FAILED",409,origin);
    if(action==="finalize"){
      const {data,error}=await db.from("humkin_radio_tracks")
        .update({r2_upload_verified_at:new Date().toISOString()})
        .eq("id",id).eq("uploaded_by",user.id).eq("storage_provider","r2_private")
        .select("id").single();
      if(error||!data)return fail("VERIFY_COMMIT_FAILED",503,origin);
      return reply({ok:true,staged:true,track_id:id,verified_sha256:row.sha256},200,origin);
    }
    if(!row.r2_upload_verified_at)return fail("DRAFT_NOT_VERIFIED",409,origin);
    const key=`tracks/${id}/${row.sha256}.mp3`;
    const put=await publicAws.fetch(objectUrl(PUBLIC_BUCKET,key),{method:"PUT",
      headers:{"Content-Type":"audio/mpeg","Cache-Control":"public,max-age=86400"},
      body:verified.bytes});
    if(!put.ok)return fail("R2_PUBLIC_WRITE_FAILED",502,origin);
    const head=await publicAws.fetch(objectUrl(PUBLIC_BUCKET,key),{method:"HEAD"});
    if(!head.ok||Number(head.headers.get("content-length"))!==Number(row.bytes))
      return fail("R2_PUBLIC_SIZE_VERIFICATION_FAILED",502,origin);
    const probe=await fetch(PUBLIC_ORIGIN+"/"+key+"?verify="+row.sha256.slice(0,12),
      {method:"GET",headers:{Range:"bytes=0-0"},cache:"no-store"});
    const delivered=probe.ok;
    try{await probe.body?.cancel()}catch{}
    if(!delivered)return fail("R2_PUBLIC_DELIVERY_FAILED",502,origin);
    const {data:committed,error:commitError}=await db.from("humkin_radio_tracks")
      .update({storage_provider:"r2",r2_object_key:key,
        r2_synced_at:new Date().toISOString(),r2_staging_key:null,
        published_at:new Date().toISOString(),enabled:true})
      .eq("id",id).eq("uploaded_by",user.id).eq("storage_provider","r2_private")
      .is("published_at",null).select("id").single();
    if(commitError||!committed)return fail("R2_CATALOG_PUBLICATION_FAILED",503,origin);
    // The private object is only a staging copy; deletion happens after verified
    // public delivery and committed catalog state. Failure cannot unpublish the song.
    let staging_copy_removed=false;
    try{staging_copy_removed=(await privateAws.fetch(objectUrl(PRIVATE_BUCKET,row.r2_staging_key),
      {method:"DELETE"})).ok}catch{}
    return reply({ok:true,published:true,track_id:id,object_key:key,
      url:PUBLIC_ORIGIN+"/"+key,staging_copy_removed},200,origin);
  }catch(error){
    console.error("HUMKIN direct R2 operation failed",error instanceof Error?error.message:"unknown");
    return fail("R2_DIRECT_BRIDGE_FAILED",502,origin);
  }
});
