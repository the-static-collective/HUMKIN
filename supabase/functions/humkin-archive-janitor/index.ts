// ARCHIVE JANITOR 001 — isolated, bounded, cleanup-only maintenance.
import {createClient} from "npm:@supabase/supabase-js@2.57.0";
import {AwsClient} from "npm:aws4fetch@1.0.20";
const env=(k:string)=>Deno.env.get(k)||"";
const API=env("SUPABASE_URL"),SERVICE=env("SUPABASE_SERVICE_ROLE_KEY");
const ACCOUNT=env("HUMKIN_R2_ACCOUNT_ID"),ACCESS=env("HUMKIN_R2_ACCESS_KEY_ID"),SECRET=env("HUMKIN_R2_SECRET_ACCESS_KEY");
const BUCKET="humkin-radio-media", INBOX="humkin-radio-inbox", PUBLIC="https://media.abundent.org";
const MAX=64*1024*1024, LIMIT=5;
const HEX=/^[0-9a-f]{64}$/, UUID=/^[0-9a-f-]{36}$/;
const fields="id,uploaded_by,sha256,bytes,storage_path,published_at,storage_provider,r2_object_key,r2_synced_at,supabase_source_removed_at";
const hash=async (b:ArrayBuffer)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",b)),n=>n.toString(16).padStart(2,"0")).join("");
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
function eligible(r:any,owner:string,cutoff:number){
 return r.uploaded_by===owner&&UUID.test(r.id)&&HEX.test(r.sha256)&&r.storage_provider==="r2"&&Boolean(r.published_at)&&!r.supabase_source_removed_at&&
  Boolean(r.r2_synced_at)&&Date.parse(r.r2_synced_at)<=cutoff&&Number.isSafeInteger(Number(r.bytes))&&Number(r.bytes)>0&&Number(r.bytes)<=MAX&&
  r.storage_path===owner+"/"+r.sha256+".mp3"&&r.r2_object_key==="tracks/"+r.id+"/"+r.sha256+".mp3";
}
Deno.serve(async req=>{
 if(req.method!=="POST"||req.headers.has("origin"))return reply({ok:false,error:"FORBIDDEN"},403);
 const token=req.headers.get("x-humkin-janitor")||"";
 if(!HEX.test(token))return reply({ok:false,error:"FORBIDDEN"},403);
 if(!API||!SERVICE||!ACCOUNT||!ACCESS||!SECRET)return reply({ok:false,error:"NOT_CONFIGURED"},503);
 const db=createClient(API,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:cfg,error:ce}=await db.from("humkin_archive_janitor_config").select("owner_id,token_hash,enabled").eq("id",1).single();
 if(ce||!cfg||await hash(new TextEncoder().encode(token).buffer)!==cfg.token_hash)return reply({ok:false,error:"FORBIDDEN"},403);
 let body:any;try{body=await req.json()}catch{return reply({ok:false,error:"INVALID_JSON"},400)}
 const dry=body?.mode==="audit";if(!dry&&body?.mode!=="reclaim")return reply({ok:false,error:"INVALID_MODE"},400);
 if(!dry&&!cfg.enabled)return reply({ok:false,error:"HELD"},409);
 const cutoff=Date.now()-86400000;
 const {data:rows,error}=await db.from("humkin_radio_tracks").select(fields).eq("uploaded_by",cfg.owner_id).eq("storage_provider","r2").not("published_at","is",null).is("supabase_source_removed_at",null).lte("r2_synced_at",new Date(cutoff).toISOString()).order("r2_synced_at").order("id").limit(LIMIT);
 if(error)return reply({ok:false,error:"CATALOG_READ_FAILED"},503);
 const aws=new AwsClient({accessKeyId:ACCESS,secretAccessKey:SECRET,service:"s3",region:"auto"});
 const results:any[]=[];
 for(const row of rows||[]){
  const result:any={id:row.id,status:"held"};results.push(result);
  try{
   if(!eligible(row,cfg.owner_id,cutoff))throw Error("METADATA_MISMATCH");
   // Never touch private drafts, public live storage, or R2 objects.
   const {data:files,error:se}=await db.storage.from(INBOX).list(cfg.owner_id,{search:row.sha256+".mp3",limit:10});
   const file=files?.find(f=>f.name===row.sha256+".mp3");
   if(se||!file||Number(file.metadata?.size)!==Number(row.bytes))throw Error("SOURCE_NOT_CONFIRMED");
   const {count,error:shared}=await db.from("humkin_radio_tracks").select("id",{count:"exact",head:true}).eq("storage_path",row.storage_path);
   if(shared||count!==1)throw Error("SOURCE_SHARED_OR_UNKNOWN");
   const url="https://"+ACCOUNT+".r2.cloudflarestorage.com/"+BUCKET+"/"+row.r2_object_key;
   const resp=await aws.fetch(url,{method:"GET",redirect:"error",signal:AbortSignal.timeout(12000)});
   if(!resp.ok||Number(resp.headers.get("content-length"))!==Number(row.bytes)){await resp.body?.cancel();throw Error("R2_SIZE_OR_READ_FAILED")}
   const bytes=await resp.arrayBuffer();
   if(bytes.byteLength!==Number(row.bytes)||await hash(bytes)!==row.sha256)throw Error("R2_HASH_MISMATCH");
   const probe=await fetch(PUBLIC+"/"+row.r2_object_key+"?janitor="+Date.now(),{headers:{Range:"bytes=0-0"},cache:"no-store",redirect:"error",signal:AbortSignal.timeout(6000)});
   const valid=probe.status===206&&probe.headers.get("content-range")==="bytes 0-0/"+row.bytes;
   await probe.body?.cancel();if(!valid)throw Error("PUBLIC_RANGE_FAILED");
   if(dry){result.status="verified";result.bytes=Number(row.bytes);continue}
   const {data:current,error:re}=await db.from("humkin_radio_tracks").select(fields).eq("id",row.id).single();
   const {data:gate,error:ge}=await db.from("humkin_archive_janitor_config").select("enabled,owner_id").eq("id",1).single();
   if(re||ge||!gate?.enabled||gate.owner_id!==cfg.owner_id||!current||!eligible(current,cfg.owner_id,cutoff)||JSON.stringify(current)!==JSON.stringify(row))throw Error("STATE_CHANGED");
   const {error:de}=await db.storage.from(INBOX).remove([row.storage_path]);if(de)throw Error("REMOVE_FAILED");
   const {data:updated,error:ue}=await db.from("humkin_radio_tracks").update({supabase_source_removed_at:new Date().toISOString()}).eq("id",row.id).eq("storage_provider","r2").eq("r2_object_key",row.r2_object_key).eq("storage_path",row.storage_path).is("supabase_source_removed_at",null).select("id");
   if(ue||updated?.length!==1)throw Error("REMOVED_RECORD_RECONCILE");
   result.status="reclaimed";result.bytes=Number(row.bytes);
  }catch(e){result.error=e instanceof Error?e.message:"UNKNOWN";break}
 }
 return reply({ok:results.every(r=>r.status!=="held"),mode:dry?"audit":"reclaim",results});
});
