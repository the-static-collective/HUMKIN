import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

/**
 * HUMKIN HUM-WALLET 001 · Device-keyed nontransferable record convenience.
 * Real, atomic server events. Not payment, legal identity, transferable credits,
 * Guilds reviewed HUM, or cryptographic proof that acoustic listening happened.
 * Client signed reports are rate-bounded, and free/public MP3s remain available.
 */
const SUPA=Deno.env.get("SUPABASE_URL")||"";
const SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const db=createClient(SUPA,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
const ORIGINS=new Set(["https://humkin.abundent.org","https://www.humkin.abundent.org"]);
const ACTOR=/^[0-9a-f]{64}$/;
const NONCE=/^[0-9a-f]{32}$/;
const SONG=/^[-a-z0-9]{3,90}$/;
const HEX=/^[0-9a-f]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const LABEL="HUMKIN-HUM/v1";
const buffer=(s:string)=>new TextEncoder().encode(s);
function json(data:unknown,status=200,origin=""){
  const o=ORIGINS.has(origin)?origin:"https://humkin.abundent.org";
  return new Response(JSON.stringify(data),{status,headers:{
    "content-type":"application/json; charset=utf-8","cache-control":"no-store",
    "access-control-allow-origin":o,"vary":"Origin",
    "access-control-allow-methods":"POST,OPTIONS",
    "access-control-allow-headers":"content-type,apikey,authorization",
    "x-content-type-options":"nosniff"
  }});
}
class Invalid extends Error { constructor(m:string,public status=400){super(m)} }
function bad(s:string,status=400):never{throw new Invalid(s,status)}
function cleanKey(v:any){
  if(!v||v.kty!=="EC"||v.crv!=="P-256"||
     typeof v.x!=="string"||typeof v.y!=="string"||
     !/^[A-Za-z0-9_-]{43}$/.test(v.x)||!/^[A-Za-z0-9_-]{43}$/.test(v.y))
    bad("Invalid device public key",401);
  return {kty:"EC",crv:"P-256",x:v.x,y:v.y};
}
function signatureBytes(value:unknown):Uint8Array {
  if(typeof value!=="string"||!/^[A-Za-z0-9_-]{86}$/.test(value))
    bad("Invalid signature",401);
  const b64=value.replace(/-/g,"+").replace(/_/g,"/");
  try{const s=atob(b64);return Uint8Array.from(s,c=>c.charCodeAt(0))}
  catch{bad("Malformed signature",401)}
}
async function digest(s:string){
  const a=new Uint8Array(await crypto.subtle.digest("SHA-256",buffer(s)));
  return [...a].map(x=>x.toString(16).padStart(2,"0")).join("");
}
async function verifySigned(root:any){
  const p=root?.packet;
  if(!p||typeof p!=="object"||Array.isArray(p)||
     !ACTOR.test(p.actor)||!NONCE.test(p.nonce)||
     !["register","state","listen","collect"].includes(p.action)||
     !Number.isSafeInteger(p.ts)||Math.abs(Date.now()-p.ts)>90_000)
     bad("Invalid or expired signed HUM request",401);
  if(JSON.stringify(root).length>4000)bad("Packet too large",413);
  const reported=p.action==="listen"?p.played_ms:0;
  const song=p.action==="collect"?p.song_id:"";
  if(!Number.isSafeInteger(reported)||reported<0||reported>86_400_000 ||
     typeof song!=="string"||(song&&!SONG.test(song)))
    bad("Invalid request fields");
  let key:any;
  if(p.action==="register"){
    key=cleanKey(p.jwk);
    if(await digest(JSON.stringify(key))!==p.actor)bad("Device key fingerprint disagrees",401);
  }else{
    const {data,error}=await db.from("humkin_hum_wallets")
      .select("public_jwk").eq("actor",p.actor).maybeSingle();
    if(error)bad("Wallet identity lookup unavailable",503);
    if(!data)bad("Wallet not registered",401);
    key=cleanKey(data.public_jwk);
    if(await digest(JSON.stringify(key))!==p.actor)bad("Wallet identity mismatch",401);
  }
  const message=[LABEL,p.actor,p.nonce,String(p.ts),p.action,String(reported),song].join("\n");
  try{
    const pub=await crypto.subtle.importKey("jwk",key,
      {name:"ECDSA",namedCurve:"P-256"},false,["verify"]);
    if(!await crypto.subtle.verify({name:"ECDSA",hash:"SHA-256"},
          pub,signatureBytes(root.signature),buffer(message)))
      bad("Invalid wallet signature",401);
  }catch(e){
    if(e instanceof Invalid)throw e;
    bad("Wallet signature verification failed",401);
  }
  return {p,key,reported,song};
}
let staticCatalog:{at:number,songs:Map<string,number>}|null=null;
async function songCost(song:string):Promise<number>{
  if(!SONG.test(song))bad("Unknown published song");
  if(/^crate-[0-9a-f-]{36}$/.test(song)){
    const id=song.slice(6);
    if(!UUID.test(id))bad("Unrecognized station track");
    const {data,error}=await db.from("humkin_radio_tracks")
      .select("id,kind,is_single,enabled,published_at").eq("id",id).maybeSingle();
    if(error)bad("Station catalog unavailable",503);
    if(!data||!data.published_at||!data.enabled||data.kind!=="song")
      bad("That recording is not a published song");
    return data.is_single?2:1;
  }
  if(!staticCatalog||Date.now()-staticCatalog.at>300_000){
    const ctrl=new AbortController();
    const timeout=setTimeout(()=>ctrl.abort(),6000);
    try{
      const r=await fetch("https://humkin.abundent.org/fm/rotation.json",
        {signal:ctrl.signal,cache:"no-store"});
      if(!r.ok)bad("Published station catalog is unavailable",503);
      const value=await r.json();
      if(!Array.isArray(value.tracks)||value.tracks.length>600)bad("Station catalog format changed",503);
      const singles=new Set(Array.isArray(value.featured_rotation?.singles)?
                             value.featured_rotation.singles:[]);
      const found=new Map<string,number>();
      for(const t of value.tracks){
        if(t&&typeof t.id==="string"&&SONG.test(t.id)&&
           typeof t.src==="string"&&/\.mp3$/i.test(t.src)){
          found.set(t.id,singles.has(t.id)?2:1);
        }
      }
      staticCatalog={at:Date.now(),songs:found};
    }catch(e){
      if(e instanceof Invalid)throw e;
      bad("Published station catalog is offline",503);
    }finally{clearTimeout(timeout)}
  }
  const price=staticCatalog.songs.get(song);
  if(!price)bad("Song is not in the approved station catalog");
  return price;
}
Deno.serve(async(req)=>{
  const origin=req.headers.get("origin")||"";
  if(req.method==="OPTIONS")return json({ok:true},200,origin);
  if(req.method!=="POST")return json({error:"Signed POST required"},405,origin);
  if(Number(req.headers.get("content-length")||"0")>4500)
    return json({error:"Packet too large"},413,origin);
  try{
    const root=await req.json();
    const {p,key,reported,song}=await verifySigned(root);
    if(p.action==="register"){
      const {error}=await db.from("humkin_hum_wallets")
        .insert({actor:p.actor,public_jwk:key});
      if(error&&error.code!=="23505")bad("Can't register wallet",503);
      // A duplicate registration never overwrites a public key or balance.
    }
    const action=p.action==="register"?"state":p.action;
    const price=action==="collect"?await songCost(song):0;
    const {data,error}=await db.rpc("humkin_hum_wallet_apply",{
      p_actor:p.actor,p_nonce:p.nonce,p_action:action,
      p_played_ms:reported,p_song_id:song,p_price:price
    });
    if(error){
      const msg=String(error.message||"");
      if(msg.includes("humkin_hum_wallet_nonces_pkey")||msg.includes("duplicate key"))
        bad("This signed request was already processed",409);
      if(msg.includes("Not enough HUM"))bad("Listen a little longer to earn HUM",402);
      if(msg.includes("Unknown HUM key"))bad("Unknown wallet key",401);
      bad("Wallet request could not be committed",503);
    }
    return json(data,200,origin);
  }catch(e){
    if(e instanceof Invalid)return json({error:e.message},e.status,origin);
    return json({error:"Wallet temporarily unavailable"},503,origin);
  }
});
