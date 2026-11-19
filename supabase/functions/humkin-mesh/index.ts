// HUMKIN MESH-001: private owner-scoped distributed file index plus SIA-style stable links.
// Metadata registry only. No private bytes are uploaded, broadcast or made public by import.
import {createClient} from "npm:@supabase/supabase-js@2.57.0";
const API=Deno.env.get("SUPABASE_URL")||"";
const SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const OWNER="us@abundent.org";
const MEDIA_ORIGIN="https://media.abundent.org/";
const CLOUD_NODE="6fa7ccdf-d12a-4634-9c20-544be2db7cf3";
const SHA=/^[0-9a-f]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG=/^[a-z0-9](?:[a-z0-9-]{2,38}[a-z0-9])$/;
const FORMATS=new Set(["mp3","wav","m4a","flac","aiff","aif","ogg","opus","wma","aac","other"]);
const ORIGINS=new Set(["https://humkin.abundent.org","https://the-static-collective.github.io"]);
const publicKey=(key:unknown)=>typeof key==="string"&&
 /^tracks\/[0-9a-f-]{36}\/[0-9a-f]{64}\.mp3$/.test(key);
function cors(origin:string|null){
 return {"Access-Control-Allow-Origin":origin&&ORIGINS.has(origin)?origin:"",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info",
  "Access-Control-Max-Age":"600","Vary":"Origin"};
}
function reply(body:Record<string,unknown>,status=200,origin:string|null=null){
 return new Response(JSON.stringify(body),{status,headers:{...cors(origin),
  "Content-Type":"application/json","Cache-Control":"no-store"}});
}
function fail(error:string,status:number,origin:string|null){return reply({ok:false,error},status,origin);}
function clean(value:unknown,max:number){
 return typeof value==="string"&&value.trim()&&value.length<=max?value.trim():"";
}
function validDate(input:unknown){
 return typeof input==="string"&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(input)&&
 Number.isFinite(Date.parse(input))&&Date.parse(input)<=Date.now()+300000;
}
function safePath(value:unknown){
 return typeof value==="string"&&value.length>=1&&value.length<=1000&&
 !value.startsWith("/")&&!value.startsWith("\\")&&!/^[a-zA-Z]:/.test(value)&&
 !/[\x00-\x1f\x7f]/.test(value)&&!value.includes("\\")&&
 !value.split("/").some(part=>!part||part==="."||part==="..");
}
async function digest(text:string){
 const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));
 return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
function fileRow(ownerId:string,r:any){
 if(!r||typeof r!=="object"||!SHA.test(r.sha256)||!SHA.test(r.path_hash)||
  !safePath(r.relative_path)||!Number.isSafeInteger(r.bytes)||r.bytes<1||r.bytes>1099511627776||
  !FORMATS.has(r.extension)||!clean(r.title,240)||
  typeof r.artist!=="string"||r.artist.length>160||
  typeof r.album!=="string"||r.album.length>160||
  !(r.duration_seconds===null||r.duration_seconds===undefined||
    (Number.isFinite(r.duration_seconds)&&r.duration_seconds>=0&&r.duration_seconds<=86400)))
  throw Error("INVALID_INVENTORY_ENTRY");
 return {owner_id:ownerId,sha256:r.sha256,bytes:r.bytes,extension:r.extension,
  title:r.title.trim(),artist:r.artist.trim(),album:r.album.trim(),
  duration_seconds:r.duration_seconds===undefined?null:r.duration_seconds};
}
async function publicResolve(db:any,slug:string,origin:string|null){
 // The same response for missing, held and not-approved references; no private clues.
 if(!SLUG.test(slug))return reply({ok:true,available:false},200,origin);
 const {data:link,error}=await db.from("humkin_mesh_links")
  .select("slug,title,state,target_track_id,owner_id").eq("slug",slug).maybeSingle();
 if(error||!link||link.state!=="active")return reply({ok:true,available:false},200,origin);
 const {data:track, error:trError}=await db.from("humkin_radio_tracks")
  .select("id,uploaded_by,title,artist,album,sha256,storage_provider,r2_object_key,enabled,published_at")
  .eq("id",link.target_track_id).eq("uploaded_by",link.owner_id).maybeSingle();
 if(trError||!track||track.enabled!==true||!track.published_at||
   track.storage_provider!=="r2"||!publicKey(track.r2_object_key)||
   !SHA.test(track.sha256)||!track.r2_object_key.endsWith("/"+track.sha256+".mp3"))
   return reply({ok:true,available:false},200,origin);
 return reply({ok:true,available:true,slug,title:link.title,
  artist:track.artist,album:track.album,media_url:MEDIA_ORIGIN+track.r2_object_key},200,origin);
}
async function ownerAuth(db:any,request:Request){
 const token=/^Bearer\s+(.+)$/i.exec(request.headers.get("authorization")||"")?.[1];
 if(!token)return null;
 const {data,error}=await db.auth.getUser(token);
 if(error||!data.user||data.user.email?.toLowerCase()!==OWNER||
   !data.user.email_confirmed_at)return null;
 return data.user;
}
async function syncRadio(db:any,owner:string){
 const {data:tracks,error}=await db.from("humkin_radio_tracks")
  .select("id,sha256,bytes,title,artist,album,duration_seconds,r2_object_key")
  .eq("uploaded_by",owner).eq("storage_provider","r2")
  .not("published_at","is",null).limit(2000);
 if(error)throw Error("RADIO_CATALOG_UNAVAILABLE");
 const valid=(tracks||[]).filter((t:any)=>SHA.test(t.sha256)&&
 Number(t.bytes)>0&&publicKey(t.r2_object_key));
 if(!valid.length)return {synced:0};
 const now=new Date().toISOString();
 const node=await db.from("humkin_mesh_nodes").upsert({owner_id:owner,node_id:CLOUD_NODE,
   label:"Cloudflare R2 · public radio",kind:"cloud",last_seen:now},
   {onConflict:"owner_id,node_id"});
 if(node.error)throw Error("R2_NODE_SYNC_FAILED");
 // Chunk all writes to avoid exceeding Edge and PostgREST row limits.
 for(let start=0;start<valid.length;start+=100){
  const batch=valid.slice(start,start+100);
  const files=batch.map((t:any)=>({owner_id:owner,sha256:t.sha256,bytes:t.bytes,
    extension:"mp3",title:t.title,artist:t.artist||"",album:t.album||"",
    duration_seconds:Number(t.duration_seconds)||null,last_seen:now}));
  const objects=await db.from("humkin_mesh_files").upsert(files,{onConflict:"owner_id,sha256"});
  if(objects.error)throw Error("R2_FILE_SYNC_FAILED");
  const copies=await Promise.all(batch.map(async(t:any)=>({owner_id:owner,
    node_id:CLOUD_NODE,sha256:t.sha256,path_hash:await digest(t.r2_object_key),
    relative_path:t.r2_object_key,last_seen:now})));
  const write=await db.from("humkin_mesh_copies").upsert(copies,
    {onConflict:"owner_id,node_id,sha256,path_hash"});
  if(write.error)throw Error("R2_COPY_SYNC_FAILED");
 }
 return {synced:valid.length};
}
Deno.serve(async(request:Request)=>{
 const origin=request.headers.get("origin");
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors(origin)});
 if(request.method!=="POST")return fail("METHOD_NOT_ALLOWED",405,origin);
 if(origin&&!ORIGINS.has(origin))return fail("ORIGIN_NOT_ALLOWED",403,origin);
 if(!API||!SERVICE)return fail("UNCONFIGURED",503,origin);
 if(Number(request.headers.get("content-length")||0)>500000)
   return fail("REQUEST_TOO_LARGE",413,origin);
 let body:any;
 try{
  const raw=await request.text();
  if(raw.length>500000)return fail("REQUEST_TOO_LARGE",413,origin);
  body=JSON.parse(raw);
  if(!body||typeof body!=="object"||Array.isArray(body))throw Error();
 }catch{return fail("INVALID_JSON",400,origin)}
 const action=String(body.action||"");
 const db=createClient(API,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
 if(action==="resolve")return publicResolve(db,String(body.slug||""),origin);
 const user=await ownerAuth(db,request);
 if(!user)return fail("OWNER_SESSION_REQUIRED",403,origin);
 const owner=user.id;
 if(action==="status"){
  const [nodes,files,copies,links,radio]=await Promise.all([
   db.from("humkin_mesh_nodes").select("node_id,label,kind,last_seen").eq("owner_id",owner).order("last_seen",{ascending:false}).limit(50),
   db.from("humkin_mesh_files").select("sha256",{count:"exact",head:true}).eq("owner_id",owner),
   db.from("humkin_mesh_copies").select("sha256",{count:"exact",head:true}).eq("owner_id",owner),
   db.from("humkin_mesh_links").select("slug,title,state,target_track_id,updated_at").eq("owner_id",owner).order("updated_at",{ascending:false}).limit(100),
   db.from("humkin_radio_tracks").select("id,title,artist,album,sha256,storage_provider,r2_object_key,enabled,published_at")
     .eq("uploaded_by",owner).eq("storage_provider","r2").not("published_at","is",null).limit(1000)
  ]);
  if([nodes,files,copies,links,radio].some(x=>x.error))return fail("CATALOG_UNAVAILABLE",503,origin);
  let totalBytes=0,page=0,partial=false;
  for(;page<100;page++){
   const fetched=await db.from("humkin_mesh_files").select("bytes").eq("owner_id",owner).order("sha256")
     .range(page*1000,page*1000+999);
   if(fetched.error){partial=true;break}
   for(const item of fetched.data||[])totalBytes+=Number(item.bytes)||0;
   if((fetched.data||[]).length<1000)break;
  }
  if(page===100)partial=true;
  return reply({ok:true,schema:"humkin.mesh/status/v1",node_count:nodes.data.length,
    file_count:files.count||0,copy_count:copies.count||0,unique_bytes:totalBytes,
    byte_count_partial:partial,nodes:nodes.data,links:links.data,
    radio_tracks:radio.data.map((t:any)=>({id:t.id,title:t.title,artist:t.artist,
     album:t.album,sha256:t.sha256,enabled:t.enabled,public_ready:t.enabled&&!!t.published_at&&publicKey(t.r2_object_key)}))},200,origin);
 }
 if(action==="sync_radio"){
  try{return reply({ok:true,...await syncRadio(db,owner)},200,origin)}
  catch(error){console.error(error);return fail("RADIO_SYNC_FAILED",503,origin)}
 }
 if(action==="ingest"){
  if(!UUID.test(String(body.node_id||""))||body.node_id===CLOUD_NODE||
    !clean(body.label,120)||!validDate(body.scanned_at)||
    !Array.isArray(body.files)||body.files.length<1||body.files.length>100)
    return fail("INVALID_INVENTORY_BATCH",422,origin);
  const now=new Date().toISOString();
  const fileMap=new Map(),copyMap=new Map();
  try{
   for(const item of body.files){
    const record=fileRow(owner,item);
    if(fileMap.has(record.sha256)&&fileMap.get(record.sha256).bytes!==record.bytes)
      throw Error("INCONSISTENT_SHA_SIZE");
    fileMap.set(record.sha256,record);
    const key=record.sha256+":"+item.path_hash;
    copyMap.set(key,{owner_id:owner,node_id:body.node_id,sha256:record.sha256,
      path_hash:item.path_hash,relative_path:item.relative_path,last_seen:now});
   }
  }catch{return fail("INVALID_INVENTORY_ENTRY",422,origin)}
  const node=await db.from("humkin_mesh_nodes").upsert({owner_id:owner,node_id:body.node_id,
    label:body.label.trim(),kind:"local",last_seen:body.scanned_at},
    {onConflict:"owner_id,node_id"});
  if(node.error)return fail("NODE_REGISTRATION_FAILED",503,origin);
  const fileRecords=[...fileMap.values()].map(r=>({...r,last_seen:now}));
  const objects=await db.from("humkin_mesh_files").upsert(fileRecords,
    {onConflict:"owner_id,sha256"});
  if(objects.error)return fail("FILE_REGISTRATION_FAILED",503,origin);
  const copies=await db.from("humkin_mesh_copies").upsert([...copyMap.values()],
    {onConflict:"owner_id,node_id,sha256,path_hash"});
  if(copies.error)return fail("COPY_REGISTRATION_FAILED",503,origin);
  return reply({ok:true,registered_copies:copyMap.size,unique_files_in_batch:fileMap.size,
    note:"Metadata only; no music uploaded or published."},200,origin);
 }
 if(action==="link_create"||action==="link_repoint"||action==="link_hold"){
  const slug=String(body.slug||"");
  const reason=clean(body.reason,240);
  if(!SLUG.test(slug)||!reason)return fail("INVALID_LINK_REQUEST",422,origin);
  const previous=await db.from("humkin_mesh_links")
    .select("slug,owner_id,state,target_track_id").eq("slug",slug).maybeSingle();
  if(previous.error)return fail("LINK_REGISTRY_UNAVAILABLE",503,origin);
  if(action==="link_create"&&previous.data)return fail("LINK_ALREADY_EXISTS",409,origin);
  if(action!=="link_create"&&(!previous.data||previous.data.owner_id!==owner))
    return fail("LINK_NOT_FOUND",404,origin);
  if(action==="link_hold"){
   const held=await db.from("humkin_mesh_links")
    .update({state:"held",updated_at:new Date().toISOString(),change_reason:reason})
    .eq("slug",slug).eq("owner_id",owner).select("slug").single();
   return held.error?fail("LINK_UPDATE_FAILED",503,origin):reply({ok:true,slug,held:true},200,origin);
  }
  const trackId=String(body.track_id||"");
  if(!UUID.test(trackId))return fail("INVALID_TRACK_ID",422,origin);
  const {data:track,error}=await db.from("humkin_radio_tracks")
   .select("id,uploaded_by,published_at,enabled,storage_provider,r2_object_key,sha256,title")
   .eq("id",trackId).eq("uploaded_by",owner).maybeSingle();
  if(error||!track||!track.published_at||!track.enabled||
    track.storage_provider!=="r2"||!publicKey(track.r2_object_key)||
    !track.r2_object_key.endsWith("/"+track.sha256+".mp3"))
    return fail("TRACK_NOT_PUBLICLY_APPROVED",409,origin);
  const title=clean(body.title,240)||clean(track.title,240);
  if(!title)return fail("INVALID_TITLE",422,origin);
  const now=new Date().toISOString();
  if(action==="link_create"){
   const created=await db.from("humkin_mesh_links").insert({slug,owner_id:owner,
     target_track_id:trackId,title,state:"active",change_reason:reason})
     .select("slug").single();
   return created.error?fail("LINK_CREATION_FAILED",409,origin):
    reply({ok:true,slug,url:"https://humkin.abundent.org/m/?id="+slug},200,origin);
  }
  const changed=await db.from("humkin_mesh_links")
   .update({target_track_id:trackId,title,state:"active",updated_at:now,change_reason:reason})
   .eq("slug",slug).eq("owner_id",owner).select("slug").single();
  return changed.error?fail("LINK_UPDATE_FAILED",503,origin):
   reply({ok:true,slug,url:"https://humkin.abundent.org/m/?id="+slug},200,origin);
 }
 return fail("UNKNOWN_ACTION",400,origin);
});
