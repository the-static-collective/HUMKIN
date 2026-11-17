import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

/** HUMKIN ORCHARD NETWORK 004 — signed, opt-in little network.
 * An active phone submits signed snapshots/heartbeats; Supabase serves the
 * cached HOME. This is NOT a peer server, blockchain stake or a live GHoT daemon.
 * Service-role tables are RLS-locked; mutation requires signed P-256 packets.
 */
const SUPA=Deno.env.get("SUPABASE_URL")??"";
const SECRET=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
const db=createClient(SUPA,SECRET,{auth:{autoRefreshToken:false,persistSession:false}});
const ROTATION="https://humkin.abundent.org/fm/rotation.json";
const ORIGINS=new Set(["https://humkin.abundent.org","https://www.humkin.abundent.org"]);
const ACTORS=/^[0-9a-f]{64}$/;
const NONCES=/^[0-9a-f]{32,64}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const HEX=/^[0-9a-f]{64}$/;
const ACTIONS=new Set(["register","state","publish","heartbeat","challenge","complete","offer","accept","cancel"]);
function respond(data:unknown,status=200,origin=""){
 const allow=ORIGINS.has(origin)?origin:"https://humkin.abundent.org";
 return new Response(JSON.stringify(data),{status,headers:{
  "Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",
  "Access-Control-Allow-Origin":allow,"Access-Control-Allow-Methods":"GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":"content-type,apikey,authorization",
  "Access-Control-Max-Age":"86400","Vary":"Origin","X-Content-Type-Options":"nosniff"
 }});
}
class Fault extends Error{constructor(message:string,public code=400){super(message)}}
function err(s:string,code=400):never{throw new Fault(s,code)}
function decode64(s:string){
 if(typeof s!=="string"||!/^[a-zA-Z0-9_-]{80,120}$/.test(s))err("Invalid P-256 signature");
 const str=s.replace(/-/g,"+").replace(/_/g,"/");
 const decoded=atob(str);return Uint8Array.from(decoded,c=>c.charCodeAt(0));
}
function encodeHex(buffer:ArrayBuffer){
 return Array.from(new Uint8Array(buffer),n=>n.toString(16).padStart(2,"0")).join("");
}
async function hash(s:string|ArrayBuffer){
 return encodeHex(await crypto.subtle.digest("SHA-256",typeof s==="string"?new TextEncoder().encode(s):s));
}
function cleanJwk(raw:any){
 if(!raw||raw.kty!=="EC"||raw.crv!=="P-256"||
    typeof raw.x!=="string"||typeof raw.y!=="string"||
    !/^[a-zA-Z0-9_-]{43}$/.test(raw.x)||!/^[a-zA-Z0-9_-]{43}$/.test(raw.y))err("P-256 public key required");
 return {kty:"EC",crv:"P-256",x:raw.x,y:raw.y};
}
async function fingerprint(jwk:any){return hash(JSON.stringify(cleanJwk(jwk)))}
function cleanseName(s:unknown){
 if(typeof s!=="string")return "A Neighbor";
 const v=s.normalize("NFKC").replace(/[\u0000-\u001f\u007f<>]/g,"").trim().slice(0,32);
 return v||"A Neighbor";
}
function cleanseHome(raw:unknown){
 const d=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw as any:{};
 const room=cleanseName(d.room??"The Room With The Radio");
 const stage=Number.isInteger(d.stage)?Math.max(0,Math.min(6,d.stage)):0;
 const localThings=Array.isArray(d.things)?d.things.slice(0,24):[];
 const things=localThings.filter((x:any)=>typeof x==="string"&&/^[a-z0-9-]{3,50}$/.test(x));
 const minute=Number.isInteger(d.minutes)?Math.min(100000,Math.max(0,d.minutes)):0;
 return {room,stage,things,minutes:minute,
  disclosure:"Listener self-reported decorative snapshot. Server-owned collectible IDs are separate."};
}
function dayChicago(){
 const p=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Chicago",year:"numeric",month:"2-digit",day:"2-digit"})
  .formatToParts(new Date());
 const x=Object.fromEntries(p.map(y=>[y.type,y.value]));
 return x.year+"-"+x.month+"-"+x.day;
}
async function verify(input:any){
 if(!input||typeof input!=="object"||Array.isArray(input))err("Signed packet required");
 const p=input.packet;
 if(!p||!ACTORS.test(p.actor)||!NONCES.test(p.nonce)||!ACTIONS.has(p.action)||
    !Number.isSafeInteger(p.ts)||Math.abs(Date.now()-p.ts)>120000||
    typeof input.signature!=="string"||p.payload===null||typeof p.payload!=="object"||
    Array.isArray(p.payload))err("Invalid or expired signed request",401);
 if(JSON.stringify(p).length>8500)err("Packet too large",413);
 let jwk;
 if(p.action==="register"){jwk=cleanJwk(p.payload.jwk);
   if(await fingerprint(jwk)!==p.actor)err("Public key fingerprint mismatch",401);
 }else{
   const {data,error}=await db.from("humkin_orchard_nodes").select("public_jwk").eq("id",p.actor).maybeSingle();
   if(error)err("Identity lookup unavailable",503);
   if(!data)err("Unknown identity; establish a listener key first",401);
   jwk=cleanJwk(data.public_jwk);
 }
 try{
  const publicKey=await crypto.subtle.importKey("jwk",jwk,{name:"ECDSA",namedCurve:"P-256"},false,["verify"]);
  const valid=await crypto.subtle.verify({name:"ECDSA",hash:"SHA-256"},publicKey,
   decode64(input.signature),new TextEncoder().encode(JSON.stringify(p)));
  if(!valid)err("Signature did not match identity",401);
 }catch(e){if(e instanceof Fault)throw e;err("Invalid listener signature",401)}
 return p as {actor:string,nonce:string,action:string,ts:number,payload:any};
}
async function rememberNonce(p:{actor:string,nonce:string,action:string}){
 const {error}=await db.from("humkin_orchard_nonces")
   .insert({node_id:p.actor,nonce:p.nonce,action:p.action});
 if(error){
   if(error.code==="23505")err("This signed request has already been used",409);
   err("Unable to record signed request",503);
 }
}
async function state(actor:string){
 const [n,a,o,i,r]=await Promise.all([
  db.from("humkin_orchard_nodes").select("id,display_name,is_public,home,created_at,updated_at,last_seen").eq("id",actor).single(),
  db.from("humkin_orchard_artifacts").select("id,serial,kind,origin,created_at").eq("owner_id",actor).order("serial",{ascending:false}).limit(100),
  db.from("humkin_orchard_offers").select("id,artifact_id,sender_id,recipient_id,status,expires_at,created_at").eq("sender_id",actor).order("created_at",{ascending:false}).limit(25),
  db.from("humkin_orchard_offers").select("id,artifact_id,sender_id,recipient_id,status,expires_at,created_at").eq("recipient_id",actor).order("created_at",{ascending:false}).limit(25),
  db.from("humkin_orchard_receipts").select("id,capability,station_day,track_count,validated_at").eq("node_id",actor).order("validated_at",{ascending:false}).limit(15)
 ]);
 if(n.error||a.error||o.error||i.error||r.error)err("Network state temporarily unavailable",503);
 return {node:n.data,artifacts:a.data??[],sent:o.data??[],inbox:i.data??[],receipts:r.data??[]};
}
async function publicHome(actor:string){
 const {data,error}=await db.from("humkin_orchard_nodes")
   .select("id,display_name,home,updated_at,last_seen").eq("id",actor).eq("is_public",true).maybeSingle();
 if(error)err("Network home unavailable",503);
 if(!data)err("This home is not publicly shared",404);
 const {data:arts,error:errArt}=await db.from("humkin_orchard_artifacts")
  .select("id,serial,kind,origin,created_at").eq("owner_id",actor).order("serial",{ascending:false}).limit(40);
 if(errArt)err("Network cabinet unavailable",503);
 const online=!!data.last_seen&&Date.now()-Date.parse(data.last_seen)<120000;
 return {identity:data.id,name:data.display_name,home:data.home,updated_at:data.updated_at,
   online,server_artifacts:arts??[]};
}
async function world(){
 const {data,error}=await db.from("humkin_orchard_nodes")
   .select("id,display_name,home,updated_at,last_seen")
   .eq("is_public",true).order("updated_at",{ascending:false}).limit(36);
 if(error)err("Community orchard unavailable",503);
 const nodes=(data??[]).map(x=>({identity:x.id,name:x.display_name,stage:x.home?.stage??0,
  room:x.home?.room??"A Listening Room",updated_at:x.updated_at,
  online:!!x.last_seen&&Date.now()-Date.parse(x.last_seen)<120000}));
 return {schema:"humkin.orchard.network/v1",type:"public-world",
  homes:nodes,online_now:nodes.filter(x=>x.online).length,
  notice:"Signed recent contact is presence, not a phone server, proof of work or proof of stake."};
}
async function register(p:any){
 const {count,error:limitError}=await db.from("humkin_orchard_nodes")
  .select("id",{head:true,count:"exact"}).gte("created_at",new Date(Date.now()-86400000).toISOString());
 if(limitError)err("Registration temporarily unavailable",503);
 if((count??0)>=200)err("The public registration cap is reached for today",429);
 const {data:found,error:lookupError}=await db.from("humkin_orchard_nodes")
  .select("id").eq("id",p.actor).maybeSingle();
 if(lookupError)err("Registration lookup unavailable",503);
 if(!found){
  const {error}=await db.from("humkin_orchard_nodes").insert({
   id:p.actor,public_jwk:cleanJwk(p.payload.jwk),
   display_name:cleanseName(p.payload.name)});
  if(error&&error.code!=="23505")err("Could not register network identity",503);
  // Cosmetic starter IDs are unique objects with no financial scarcity promise.
  const seeds=[
   {owner_id:p.actor,issued_to:p.actor,kind:"chipped-blue-cup",origin:"welcome:cup"},
   {owner_id:p.actor,issued_to:p.actor,kind:"window-seed",origin:"welcome:seed"}
  ];
  const {error:giftError}=await db.from("humkin_orchard_artifacts").insert(seeds);
  if(giftError&&giftError.code!=="23505")err("Starter cabinet temporarily unavailable",503);
 }
 await rememberNonce(p);
 return {ok:true,registered:true,...await state(p.actor)};
}
async function retrieveRotation(){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),6500);
 try{
  const r=await fetch(ROTATION,{cache:"no-store",signal:ctrl.signal});
  if(!r.ok)err("Radio manifest temporarily unavailable",503);
  const text=await r.text();
  if(text.length>100000)err("Manifest exceeds audit limit",503);
  const j=JSON.parse(text),trackList=j.tracks;
  if(!Array.isArray(trackList)||trackList.length<1||trackList.length>1000)
   err("Malformed radio catalog",503);
  const ids=new Set<string>();
  for(const t of trackList){
   if(typeof t.id!=="string"||!t.id||
     typeof t.title!=="string"||!t.title||
     typeof t.src!=="string"||ids.has(t.id))err("Radio catalog has invalid or duplicate IDs",503);
   const src=new URL(t.src,ROTATION);
   if(src.origin!=="https://humkin.abundent.org")err("Off-site track in catalog",503);
   ids.add(t.id);
  }
  return {count:trackList.length,digest:await hash(text)};
 }finally{clearTimeout(timer)}
}
async function handle(p:any){
 const actor=p.actor,v=p.payload;
 switch(p.action){
 case "register": return register(p);
 case "state": return {ok:true,...await state(actor)};
 case "publish":{
  const {data:existing,error:loadErr}=await db.from("humkin_orchard_nodes")
   .select("last_publish_at").eq("id",actor).single();
  if(loadErr)err("Home unavailable",503);
  if(existing.last_publish_at&&Date.now()-Date.parse(existing.last_publish_at)<20000)
    err("Give the orchard a few seconds between updates",429);
  const home=cleanseHome(v.home);
  if(typeof v.public!=="boolean")err("Choose whether the room is public");
  const {error}=await db.from("humkin_orchard_nodes").update({
   home,is_public:v.public,display_name:cleanseName(v.name),
   last_publish_at:new Date().toISOString(),updated_at:new Date().toISOString()
  }).eq("id",actor);
  if(error)err("Cannot publish home",503);
  return {ok:true,published:v.public,home};
 }
 case "heartbeat":{
  const {data:n,error:readError}=await db.from("humkin_orchard_nodes")
   .select("last_seen").eq("id",actor).single();
  if(readError)err("Presence unavailable",503);
  if(n.last_seen&&Date.now()-Date.parse(n.last_seen)<35000)return {ok:true,online:true,limited:true};
  const {error}=await db.from("humkin_orchard_nodes")
   .update({last_seen:new Date().toISOString()}).eq("id",actor);
  if(error)err("Presence unavailable",503);
  return {ok:true,online:true,expires_in_seconds:120,proof:"signed-contact-only"};
 }
 case "challenge":{
  const today=dayChicago();
  const {data:receipt,error:receiptError}=await db.from("humkin_orchard_receipts")
   .select("id").eq("node_id",actor).eq("station_day",today).limit(1);
  if(receiptError)err("Work ledger temporarily unavailable",503);
  if(receipt?.length)err("Today's verified catalog check is already recorded",409);
  const {count,error:countError}=await db.from("humkin_orchard_challenges")
   .select("id",{head:true,count:"exact"}).eq("node_id",actor)
   .gte("created_at",new Date(Date.now()-86400000).toISOString());
  if(countError)err("Work offers unavailable",503);
  if((count??0)>=5)err("Five work offers is today's limit",429);
  const expected=await retrieveRotation();
  const {data,error}=await db.from("humkin_orchard_challenges").insert({
   node_id:actor,expected_digest:expected.digest,track_count:expected.count
  }).select("id,expires_at,capability").single();
  if(error)err("Cannot issue a work challenge",503);
  return {ok:true,offer:{...data,source:ROTATION,max_bytes:100000,
    deadline_ms:Date.parse(data.expires_at),expected_schema:"humkin.radio.rotation.v1",
    note:"A bounded, voluntary catalog consistency check. The client may HOLD or REFUSE."}};
 }
 case "complete":{
  if(!UUID.test(v.challenge_id??"")||!HEX.test(v.digest??""))
   err("Valid challenge and SHA-256 digest required");
  const {data,error}=await db.rpc("humkin_orchard_finish_audit",
   {p_node:actor,p_challenge:v.challenge_id,p_digest:v.digest});
  if(error)err("Catalog audit rejected: "+String(error.message).slice(0,110),409);
  return {ok:true,receipt:data,proof:"server-checked catalog agreement; not proof of unique CPU work"};
 }
 case "offer":{
  if(!UUID.test(v.artifact_id??"")||!ACTORS.test(v.to??""))
    err("Provide a server-issued artifact and an existing recipient ID");
  const {data,error}=await db.rpc("humkin_orchard_offer_open",
   {p_sender:actor,p_recipient:v.to,p_artifact:v.artifact_id});
  if(error)err("Trade offer rejected: "+String(error.message).slice(0,100),409);
  return {ok:true,offer_id:data,status:"open",expires_in_hours:24};
 }
 case "accept":{
  if(!UUID.test(v.offer_id??""))err("Valid trade offer required");
  const {data,error}=await db.rpc("humkin_orchard_offer_accept",
   {p_recipient:actor,p_offer:v.offer_id});
  if(error)err("Trade acceptance rejected: "+String(error.message).slice(0,100),409);
  return {ok:true,transfer:data};
 }
 case "cancel":{
  if(!UUID.test(v.offer_id??""))err("Valid offer ID required");
  const {data,error}=await db.rpc("humkin_orchard_offer_cancel",
   {p_sender:actor,p_offer:v.offer_id});
  if(error||!data)err("Offer cannot be cancelled",409);
  return {ok:true,cancelled:true};
 }
 default: err("Unknown action",404);
 }
}
Deno.serve(async req=>{
 const origin=req.headers.get("origin")??"";
 if(req.method==="OPTIONS")return respond({ok:true},200,origin);
 try{
  const url=new URL(req.url);
  if(req.method==="GET"){
   if(url.searchParams.get("mode")==="home"){
    const actor=url.searchParams.get("id")||"";
    if(!ACTORS.test(actor))err("Valid public home ID required");
    return respond({schema:"humkin.orchard.network/v1",...await publicHome(actor)},200,origin);
   }
   if(url.searchParams.get("mode")==="world"||!url.searchParams.has("mode"))
    return respond(await world(),200,origin);
   err("Unknown public view",404);
  }
  if(req.method!=="POST")err("Method not supported",405);
  const raw=await req.text();
  if(raw.length>13000)err("Request exceeds the signed packet limit",413);
  let body;
  try{body=JSON.parse(raw)}catch{err("Invalid JSON")}
  const p=await verify(body);
  if(p.action!=="register")await rememberNonce(p);
  return respond({schema:"humkin.orchard.network/v1",...await handle(p)},200,origin);
 }catch(e){
  const fault=e instanceof Fault?e:new Fault("The little network couldn't finish this request",503);
  if(!(e instanceof Fault))console.error("orchard-network internal:",e);
  return respond({error:fault.message,schema:"humkin.orchard.network/v1"},fault.code,origin);
 }
});
