import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.57.0";

/** HUMKIN PARTICIPATION ENGINE 001.
 * Public account-free intake; private review; atomic non-transferable verified HUM.
 * NO self-minting. NO automatic broadcast, external posting, or hardware enrollment.
 * Media lives in a private Storage bucket; no unsafe file previews published.
 */
const URL_BASE=Deno.env.get("SUPABASE_URL")??"";
const SECRET=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
const db=createClient(URL_BASE,SECRET,{auth:{persistSession:false,autoRefreshToken:false}});
const BUCKET="humkin-contribution-inbox";
const OWNER="us@abundent.org";
const ORIGINS=new Set(["https://humkin.abundent.org","https://www.humkin.abundent.org"]);
const KIND=new Set(["street","video","bumper","song","server","script","segment"]);
const PLATFORMS=new Set(["none","youtube","instagram","tiktok","facebook","bluesky","other"]);
const AUDIO=new Set(["audio/mpeg","audio/mp4","audio/wav"]);
const VIDEO=new Set(["video/mp4","video/webm"]);
const EXTMIME={"mp4":"video/mp4","webm":"video/webm","mp3":"audio/mpeg","m4a":"audio/mp4","wav":"audio/wav"};
const JOBS=[
 {id:"street",guild:"STREET TEAM",title:"THE SIGNAL CARRIERS",reward:"25 VERIFIED HUM / ACCEPTED ORIGINAL POST",level:2,
  notes:"An original honest post, with clear disclosure of possible HUM rewards. Max three accepted submissions per seven days; one per public URL. No follower quotas, spam, or forced positive opinion."},
 {id:"video",guild:"VISUAL PRODUCTION",title:"THE PICTURE DEPARTMENT",reward:"100–300 VERIFIED HUM / APPROVED VIDEO",level:3,
  notes:"An original HUMKIN song visual or music video, 15–120 seconds. Upload MP4/WebM (max 25 MB) or paste a publicly accessible video link. Your rights and permission are required."},
 {id:"bumper",guild:"BROADCASTERS",title:"STATION ID & BUMPER BOOTH",reward:"70 VERIFIED HUM / APPROVED BUMPER",level:3,
  notes:"Make a 5–30 second station ID or bumper. Record on your phone, upload MP3/M4A/WAV, or provide a public link. Submission is not permission to go live."},
 {id:"script",guild:"WRITERS",title:"THE SCRIPT SEED GARDEN",reward:"35 VERIFIED HUM / APPROVED SCRIPT",level:2,
  notes:"Write a clean, original 30–500 character bumper, comic bit or introduction. No audio file required."},
 {id:"segment",guild:"NEWSROOM",title:"THE LITTLE REPORTER",reward:"90 VERIFIED HUM / APPROVED FEATURE",level:4,
  notes:"A 15–180 second original spoken report or feature, with a factual source link if needed. No automatic publishing."},
 {id:"song",guild:"MUSIC PRODUCERS",title:"THE COMMUNITY RECORD CRATE",reward:"350 VERIFIED HUM / APPROVED ORIGINAL SONG",level:5,
  notes:"Submit original music of at least 45 seconds through an audio upload or publicly accessible media link. Rights and broadcast permissions are reviewed."},
 {id:"server",guild:"ENGINEERS",title:"THE RELAY MACHINE SHOP",reward:"UP TO 400 VERIFIED HUM / ACTUALLY VERIFIED SERVICE",level:7,
  notes:"Describe a computer you own or have permission to use. A hardware claim alone earns nothing: real reward only after a secure, useful node passes staff verification."}
];
const MISSION_BY_ID=new Map(JOBS.map(x=>[x.id,x]));

function reply(payload:unknown,status=200,origin="") {
 const allowed=ORIGINS.has(origin)?origin:"https://humkin.abundent.org";
 return new Response(JSON.stringify(payload),{status,headers:{
  "Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",
  "Access-Control-Allow-Origin":allowed,"Access-Control-Allow-Methods":"GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":"content-type,authorization,apikey","Vary":"Origin",
  "X-Content-Type-Options":"nosniff"
 }});
}
function problem(message:string,status=400,origin=""){return reply({error:message},status,origin)}
function stationDay(t=Date.now()){
 const parts=Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:"America/Chicago",
  year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(t)).map(p=>[p.type,p.value]));
 return parts.year+"-"+parts.month+"-"+parts.day;
}
function startDay(day:string){return new Date(day+"T00:00:00Z").getTime()}
async function hmac(value:string){
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(SECRET),
  {name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const raw=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value));
 return [...new Uint8Array(raw)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
function validListener(raw:unknown){return typeof raw==="string"&&/^[0-9a-f-]{36}$/i.test(raw)}
function validUuid(raw:unknown){return typeof raw==="string"&&/^[0-9a-f-]{36}$/i.test(raw)}
function urlCheck(raw:unknown,kind:string,platform:string){
 if(typeof raw!=="string")return "";
 const value=raw.trim();
 if(!value)return "";
 if(value.length>550)throw Error("Proof link too long");
 let url:URL;
 try{url=new URL(value)}catch{throw Error("Invalid proof URL")}
 if(url.protocol!=="https:"||url.username||url.password||url.port)
  throw Error("A public HTTPS proof URL is required");
 const host=url.hostname.toLowerCase();
 if(!host.includes(".")||host.startsWith(".")||host.endsWith(".")||
    host==="localhost"||host.endsWith(".local")||host.endsWith(".internal")||
    /^\d+(\.\d+){3}$/.test(host)||host.includes(":"))
   throw Error("Proof must link to a public website");
 const platforms:Record<string,string[]>={
   youtube:["youtube.com","youtu.be"],instagram:["instagram.com"],
   tiktok:["tiktok.com"],facebook:["facebook.com","fb.watch"],
   bluesky:["bsky.app"]
 };
 if(kind==="street"&&platform!=="other"){
   const hosts=platforms[platform]||[];
   if(!hosts.some(base=>host===base||host.endsWith("."+base)))
    throw Error("Your post link doesn't match the selected network");
 }
 url.hash="";return url.toString();
}
function rewards(kind:string,length:number){
 switch(kind){
  case "street":return 25;
  case "video":return length>=60?300:length>=30?180:100;
  case "bumper":return 70;
  case "song":return 350;
  case "server":return 400;
  case "script":return 35;
  case "segment":return 90;
  default:return 0;
 }
}
function mimeFile(x:unknown,kind:string){
 if(!x||typeof x!=="object")return null;
 const data=x as Record<string,unknown>;
 const ext=String(data.ext??"").toLowerCase().replace(/^\./,"");
 const mime=String(data.mime??"").toLowerCase();
 const size=Number(data.size);
 if(!(ext in EXTMIME)||EXTMIME[ext as keyof typeof EXTMIME]!==mime||
  !Number.isSafeInteger(size)||size<1024||size>26214400)
  throw Error("Use a 1 KB–25 MB MP4/WebM or supported audio file");
 if((kind==="video"&&!VIDEO.has(mime))||
   (kind!=="video"&&!AUDIO.has(mime)))
   throw Error("File type doesn't match this department");
 return {ext,mime,size};
}
async function authOwner(req:Request){
 const head=req.headers.get("authorization")||"";
 if(!head.startsWith("Bearer "))throw Error("Station owner sign-in required");
 const token=head.slice(7);
 const {data,error}=await db.auth.getUser(token);
 if(error||!data?.user?.id||data.user.email?.toLowerCase()!==OWNER)
   throw Error("Only the signed-in station owner can review submissions");
 return data.user.id;
}
async function ensureBucket(){
 const {error}=await db.storage.createBucket(BUCKET,{
   public:false,fileSizeLimit:26214400,
   allowedMimeTypes:[...AUDIO,...VIDEO]
 });
 if(error&&!/already exists|duplicate|exist/i.test(error.message))throw error;
}
async function createUpload(path:string){
 await ensureBucket();
 const {data,error}=await db.storage.from(BUCKET).createSignedUploadUrl(path);
 if(error||!data?.token)throw Error("Private upload authorization unavailable");
 return {path,token:data.token};
}
function exposure(row:any){
 return {id:row.id,kind:row.kind,title:row.title,state:row.state,
  potential_hum:row.potential_hum,created_at:row.created_at,
  review_note:row.review_note||"",media:!!row.media_path};
}
async function me(req:Request,query:URL){
 const listener=query.searchParams.get("listener");
 if(!validListener(listener))return {error:"Participation pass missing",status:400};
 const hash=await hmac("actor:v1:"+listener);
 const [submissions,credits]=await Promise.all([
   db.from("humkin_contribution_intake")
     .select("id,kind,title,state,potential_hum,created_at,review_note,media_path")
     .eq("actor_hash",hash).order("created_at",{ascending:false}).limit(60),
   db.from("humkin_contribution_rewards").select("hum")
     .eq("actor_hash",hash).limit(1000)
 ]);
 if(submissions.error||credits.error)throw submissions.error||credits.error;
 return {schema:"humkin.participation.v1",
  account:"Device-local participation pass. Save a backup to restore on another device.",
  verified_hum:(credits.data||[]).reduce((s,x)=>s+x.hum,0),
  pending_hum:(submissions.data||[]).filter(x=>x.state==="pending_review")
    .reduce((s,x)=>s+x.potential_hum,0),
  submissions:(submissions.data||[]).map(exposure)};
}
async function submit(data:any,req:Request){
 const listener=String(data.listener||"");
 const kind=String(data.kind||"");
 const title=String(data.title||"").trim();
 const details=String(data.details||"").trim();
 const platform=String(data.platform||"none");
 const handle=String(data.handle||"").trim();
 const length=Number(data.duration||0);
 if(!validListener(listener)||!KIND.has(kind)||!MISSION_BY_ID.has(kind))
  return {error:"Invalid mission request",status:400};
 if(title.length<3||title.length>100||details.length>1400||
    !PLATFORMS.has(platform)||handle.length>72||
    !Number.isSafeInteger(length)||length<0||length>3600)
  return {error:"Title, duration or description is out of range",status:400};
 const isSocial=kind==="street";
 if(isSocial&&platform==="none")return {error:"Choose a social network",status:400};
 if(isSocial&&!data.disclosure_confirmed)
  return {error:"The post needs a clear disclosure of potential rewards",status:400};
 if(kind!=="server"&&!data.rights_confirmed)
  return {error:"Confirm you have rights or permission for the submitted material",status:400};
 if(kind==="server"&&details.length<30)
  return {error:"Describe the proposed machine and how it could serve the station",status:400};
 if(kind==="script"&&(details.length<30||details.length>500))
  return {error:"Please write 30–500 characters of actual script",status:400};
 if((kind==="video"&&(!length||length<15||length>120))||
    (kind==="bumper"&&(length<5||length>30))||
    (kind==="segment"&&(length<15||length>180))||
    (kind==="song"&&length<45))
  return {error:"This mission requires a recording of the listed duration",status:400};
 let link="";
 try{link=urlCheck(data.reference_url,kind,platform)}catch(e){return {error:String(e.message),status:400}};
 if(kind==="street"&&!link)return {error:"Paste a public link to the original post",status:400};
 let file=null;
 try{file=mimeFile(data.file,kind)}catch(e){return {error:String(e.message),status:400}}
 if(file&&!["video","bumper","song","segment"].includes(kind))
  return {error:"This mission does not accept media files",status:400};
 if(["video","bumper","song","segment"].includes(kind)&&!link&&!file)
  return {error:"Choose a file to upload or provide a public media link",status:400};
 const day=stationDay();
 const start=day+"T00:00:00Z";
 const week=new Date(Date.now()-7*86400000).toISOString();
 const actor=await hmac("actor:v1:"+listener);
 const ip=req.headers.get("cf-connecting-ip")||"device:"+listener;
 const network=await hmac("network:v1:"+ip.slice(0,128));
 const countQuery=(key:string,val:string,since:string)=>
   db.from("humkin_contribution_intake").select("id",{count:"exact",head:true})
     .eq(key,val).gte("created_at",since);
 const [own,net,global,weekly]=await Promise.all([
   countQuery("actor_hash",actor,start),
   countQuery("network_hash",network,start),
   db.from("humkin_contribution_intake").select("id",{head:true,count:"exact"}).gte("created_at",start),
   db.from("humkin_contribution_intake").select("id",{head:true,count:"exact"})
     .eq("actor_hash",actor).eq("kind",kind).gte("created_at",week)
 ]);
 if(own.error||net.error||global.error||weekly.error)throw own.error||net.error||global.error||weekly.error;
 if((own.count||0)>=3||(net.count||0)>=12||(global.count||0)>=50)
  return {error:"Today's mission intake is full. It reopens after the Central-time day changes.",status:429};
 const maxWeek=kind==="street"?3:kind==="song"?2:kind==="video"?3:kind==="server"?1:6;
 if((weekly.count||0)>=maxWeek)
  return {error:"Weekly mission submission limit reached",status:429};
 const path=file?crypto.randomUUID()+"/"+crypto.randomUUID()+"."+file.ext:null;
 const record={
  actor_hash:actor,network_hash:network,kind,title,details,platform,
  public_handle:handle,reference_url:link,length_seconds:length,
  media_path:path,media_mime:file?.mime??null,media_size:file?.size??0,
  rights_confirmed:!!data.rights_confirmed,
  disclosure_confirmed:!!data.disclosure_confirmed,
  state:file?"awaiting_upload":"pending_review",potential_hum:rewards(kind,length)
 };
 const {data:created,error}=await db.from("humkin_contribution_intake")
  .insert(record).select("id,state,potential_hum").single();
 if(error){
  if(error.code==="23505")return {error:"That public link was already submitted through this pass",status:409};
  throw error;
 }
 let upload=null;
 if(file){
   try{upload=await createUpload(path!)}
   catch(e){
     // The row intentionally remains awaiting_upload with a recoverable receipt.
     console.error("Participation upload setup",String(e));
     return {created:{id:created.id,state:"awaiting_upload"},
       error:"The mission was saved, but media upload is unavailable. Try a public link or contact station staff.",
       status:503};
   }
 }
 return {accepted:true,id:created.id,state:created.state,
  potential_hum:created.potential_hum,upload,
  warning:"This is an unverified submission. Only owner review can grant verified HUM; publishing is a separate decision."};
}
async function finalize(data:any){
 const listener=String(data.listener||"");
 const id=String(data.id||"");
 if(!validListener(listener)||!validUuid(id))return {error:"Invalid participation receipt",status:400};
 const actor=await hmac("actor:v1:"+listener);
 const {data:row,error}=await db.from("humkin_contribution_intake")
  .select("id,media_path,media_mime,media_size,state").eq("id",id).eq("actor_hash",actor).maybeSingle();
 if(error)throw error;
 if(!row||row.state!=="awaiting_upload"||!row.media_path)
  return {error:"This recording is not awaiting upload",status:409};
 const {data:info,error:storageError}=await db.storage.from(BUCKET).info(row.media_path);
 if(storageError||!info)return {error:"The file isn't in the private station inbox yet",status:409};
 const size=Number(info.size??0);
 const contentType=String(info.contentType||info.metadata?.mimetype||"").toLowerCase();
 if(size<1024||size>row.media_size||size>26214400||
    (contentType&&contentType!==row.media_mime))
  return {error:"Uploaded media didn't match the declared type or size",status:409};
 const {error:updated}=await db.from("humkin_contribution_intake")
  .update({state:"pending_review"}).eq("id",id).eq("actor_hash",actor)
  .eq("state","awaiting_upload");
 if(updated)throw updated;
 return {accepted:true,id,state:"pending_review",warning:"Stored privately; pending owner review. Nothing airs automatically."};
}
async function withdraw(data:any){
 const listener=String(data.listener||""),id=String(data.id||"");
 if(!validListener(listener)||!validUuid(id))return {error:"Invalid receipt",status:400};
 const actor=await hmac("actor:v1:"+listener);
 const {data,error}=await db.from("humkin_contribution_intake")
  .update({state:"withdrawn"}).eq("id",id).eq("actor_hash",actor)
  .in("state",["awaiting_upload","pending_review"]).select("id,media_path");
 if(error)throw error;
 if(!data?.length)return {error:"This item cannot be withdrawn; please contact the station about accepted work.",status:409};
 if(data[0].media_path){
  await db.storage.from(BUCKET).remove([data[0].media_path]);
 }
 return {withdrawn:true,id};
}
async function ownerQueue(req:Request){
 await authOwner(req);
 const {data,error}=await db.from("humkin_contribution_intake")
  .select("id,kind,title,details,platform,public_handle,reference_url,length_seconds,media_path,state,potential_hum,created_at")
  .in("state",["pending_review","awaiting_upload"]).order("created_at",{ascending:true}).limit(100);
 if(error)throw error;
 const items=[];
 for(const row of data??[]){
   let media_url="";
   if(row.media_path&&row.state==="pending_review"){
     const {data:signed}=await db.storage.from(BUCKET).createSignedUrl(row.media_path,300);
     media_url=signed?.signedUrl??"";
   }
   items.push({...row,media_url});
 }
 return {schema:"humkin.participation.owner.v1",items};
}
async function review(body:any,req:Request){
 const reviewer=await authOwner(req);
 const id=String(body.id||""),accept=body.accept===true;
 const note=String(body.note||"").trim();
 if(!validUuid(id)||note.length>500)return {error:"Invalid review request",status:400};
 if(accept&&!body.rights_checked)
   return {error:"Review requires confirmation of relevant rights and quality",status:400};
 const {data,error}=await db.rpc("humkin_contrib_review",{
   p_submission:id,p_accept:accept,p_note:note,p_reviewed_by:reviewer
 });
 if(error){
  if(error.message.includes("not pending"))return {error:"Already reviewed or not yet uploaded",status:409};
  throw error;
 }
 return {reviewed:true,id,decision:data?.[0]?.decision??(accept?"accepted":"declined"),
  awarded_hum:data?.[0]?.hum??0,
  note:"Credit granted once by server transaction; publishing still separate."};
}
Deno.serve(async req=>{
 const origin=req.headers.get("origin")||"";
 if(req.method==="OPTIONS")return reply({},200,origin);
 if(origin&&!ORIGINS.has(origin))return problem("Station origin not permitted",403,origin);
 try{
  const url=new URL(req.url);
  if(req.method==="GET"){
   const mode=url.searchParams.get("mode")||"missions";
   const result=mode==="missions"?{schema:"humkin.participation.v1",missions:JOBS,
        unit:"Verified HUM = server-reviewed, nontransferable contribution credits; not Orchard local HUM, cryptocurrency or money."}:
     mode==="mine"?await me(req,url):mode==="owner"?await ownerQueue(req):null;
   if(!result)return problem("Unknown desk",404,origin);
   if((result as any).error)return problem((result as any).error,(result as any).status||400,origin);
   return reply(result,200,origin);
  }
  if(req.method!=="POST")return problem("Method unavailable",405,origin);
  if(Number(req.headers.get("content-length")||0)>6200)return problem("Submission too large",413,origin);
  const raw=await req.text();if(raw.length>6200)return problem("Submission too large",413,origin);
  let body:any;try{body=JSON.parse(raw)}catch{return problem("Invalid JSON",400,origin)}
  const result=body?.action==="submit"?await submit(body,req):
    body?.action==="finalize"?await finalize(body):
    body?.action==="withdraw"?await withdraw(body):
    body?.action==="review"?await review(body,req):
    {error:"Unknown desk action",status:400};
  if(result?.error)return problem(result.error,result.status||400,origin);
  return reply(result,200,origin);
 }catch(e){
  console.error("Participation Engine",String(e));
  const message=String((e as Error)?.message||"");
  if(message.includes("Station owner sign-in")||message.includes("signed-in station owner"))
   return problem("Owner authorization required",403,origin);
  return problem("Station intake temporarily unavailable",503,origin);
 }
});
