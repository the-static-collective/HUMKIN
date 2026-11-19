// HUMKIN Radio · six-digit authenticator login (owner only).
// Verifies a distinct TOTP credential and issues a REAL Supabase Auth session.
// The owner's existing email sign-in remains a fallback. No Vercel involvement.
// Sensitive credential material stays encrypted with Web Crypto on Supabase Edge.
// Never log TOTP codes, provisioning URLs, sealed seeds, or session tokens.
import {createClient} from "npm:@supabase/supabase-js@2.57.0";
import {generateSeed,matchCode,provisioningUrl} from "./totp.mjs";

const API=Deno.env.get("SUPABASE_URL")||"";
const SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const ANON=Deno.env.get("SUPABASE_ANON_KEY")||"";
const OWNER="us@abundent.org";
const ORIGINS=new Set(["https://humkin.abundent.org","https://the-static-collective.github.io"]);
const encoder=new TextEncoder();
const cors=(origin:string)=>({
  "Access-Control-Allow-Origin":ORIGINS.has(origin)?origin:"",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Access-Control-Allow-Headers":"authorization,apikey,content-type",
  "Access-Control-Max-Age":"300","Vary":"Origin"
});
const respond=(origin:string,data:Record<string,unknown>,status=200)=>
  new Response(JSON.stringify(data),{
    status,headers:{...cors(origin),"Content-Type":"application/json; charset=utf-8",
      "Cache-Control":"no-store, no-cache, max-age=0","Pragma":"no-cache",
      "X-Content-Type-Options":"nosniff"}
  });
const deny=(origin:string,status=401)=>
  respond(origin,{ok:false,error:"NOT_AUTHORIZED_OR_CODE_INVALID"},status);
const b64=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes));
const unb64=(value:string)=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
let cachedKey:Promise<CryptoKey>|null=null;
async function encryptionKey(){
  if(!cachedKey)cachedKey=(async()=>{
    const material=await crypto.subtle.importKey("raw",encoder.encode(SERVICE),
      "HKDF",false,["deriveKey"]);
    return crypto.subtle.deriveKey({name:"HKDF",hash:"SHA-256",
      salt:encoder.encode("humkin-proton-v1:"+API),
      info:encoder.encode("independent-proton-owner-seed")},
      material,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
  })();
  return cachedKey;
}
async function seal(seed:string){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},
    await encryptionKey(),encoder.encode(seed)));
  return "v1:"+b64(iv)+":"+b64(encrypted);
}
async function unseal(sealed:string){
  const [version,iv,text]=String(sealed||"").split(":");
  if(version!=="v1"||!iv||!text)throw Error("SEED_CANNOT_BE_DECRYPTED");
  const result=await crypto.subtle.decrypt({name:"AES-GCM",iv:unb64(iv)},
    await encryptionKey(),unb64(text));
  return new TextDecoder().decode(result);
}
const service=()=>createClient(API,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
const client=()=>createClient(API,ANON,{auth:{persistSession:false,autoRefreshToken:false}});
async function ownerOf(db:any,request:Request){
  const token=/^Bearer ([^\s]+)$/i.exec(request.headers.get("authorization")||"")?.[1];
  if(!token)return null;
  const {data,error}=await db.auth.getUser(token);
  const user=data?.user;
  if(error||!user||user.email?.toLowerCase()!==OWNER||!user.email_confirmed_at)return null;
  return user;
}
async function action(db:any,origin:string,name:string,body:any,request:Request){
  if(name==="login"){
    if(!/^\d{6}$/.test(String(body.code||"")))return deny(origin);
    // One atomic reservation per attempt; rejects bursts and throttles guessing
    // before the sensitive TOTP secret is ever returned to the Edge process.
    const {data:attempt,error:gateError}=await db.rpc("humkin_proton_attempt_begin");
    if(gateError||attempt?.allowed!==true)return deny(origin);
    let step:null|number=null;
    try{
      const secret=await unseal(attempt.sealed);
      step=await matchCode(secret,body.code,Date.now(),Number(attempt.last_step));
    }catch{return deny(origin);}
    if(step===null)return deny(origin);
    const {data:claimed,error:claimError}=await db.rpc("humkin_proton_claim_step",{
      p_owner:attempt.owner_id,p_step:step
    });
    if(claimError||claimed!==true)return deny(origin);
    // The TOTP is NOT a Supabase JWT. Exchange through GoTrue Admin's
    // one-time magiclink generator and verify its token INSIDE the Edge.
    // No emailed link or redirect, no service-role credential in browser.
    const {data:link,error:linkError}=await db.auth.admin.generateLink({
      type:"magiclink",email:OWNER
    });
    if(linkError||!link?.properties?.hashed_token||
       link.user?.id!==attempt.owner_id||
       link.user?.email?.toLowerCase()!==OWNER||
       !link.user?.email_confirmed_at)
      return respond(origin,{ok:false,error:"SESSION_ISSUE_FAILED"},503);
    const {data:auth,error:authError}=await client().auth.verifyOtp({
      token_hash:link.properties.hashed_token,type:"magiclink"
    });
    if(authError||auth.user?.id!==attempt.owner_id||!auth.session?.access_token||
       !auth.session.refresh_token)
      return respond(origin,{ok:false,error:"SESSION_ISSUE_FAILED"},503);
    return respond(origin,{ok:true,
      access_token:auth.session.access_token,
      refresh_token:auth.session.refresh_token,
      expires_in:auth.session.expires_in});
  }
  // Everything except login REQUIRES the already valid Supabase owner JWT.
  const user=await ownerOf(db,request);
  if(!user)return deny(origin);
  const {data:existing,error:readError}=await db.from("humkin_proton_owner_login")
    .select("owner_id,enabled_at,pending_sealed,pending_expires_at")
    .eq("id",1).maybeSingle();
  if(readError)return respond(origin,{ok:false,error:"AUTH_STATE_UNAVAILABLE"},503);
  if(existing&&existing.owner_id!==user.id)return deny(origin,403);
  if(name==="status")
    return respond(origin,{ok:true,enrolled:Boolean(existing?.enabled_at)});
  if(name==="enroll_begin"){
    if(existing?.enabled_at)return respond(origin,{ok:false,error:"ALREADY_PAIRED"},409);
    const seed=generateSeed();
    const sealed=await seal(seed);
    const pending={
      owner_id:user.id,pending_sealed:sealed,
      pending_expires_at:new Date(Date.now()+10*60000).toISOString()
    };
    const {error}=existing?
      await db.from("humkin_proton_owner_login").update(pending).eq("id",1):
      await db.from("humkin_proton_owner_login").insert({id:1,...pending});
    if(error)return respond(origin,{ok:false,error:"ENROLLMENT_UNAVAILABLE"},503);
    return respond(origin,{ok:true,secret:seed,
      provisioning_url:provisioningUrl(seed)});
  }
  if(name==="enroll_confirm"){
    if(existing?.enabled_at||!existing?.pending_sealed||
       !existing.pending_expires_at||Date.parse(existing.pending_expires_at)<Date.now())
      return respond(origin,{ok:false,error:"START_ENROLLMENT_AGAIN"},409);
    if(!/^\d{6}$/.test(String(body.code||"")))return deny(origin);
    let step:null|number=null;
    try{step=await matchCode(await unseal(existing.pending_sealed),body.code);}
    catch{return respond(origin,{ok:false,error:"ENROLLMENT_UNAVAILABLE"},503);}
    if(step===null)return deny(origin);
    const {data:done,error}=await db.from("humkin_proton_owner_login")
      .update({secret_sealed:existing.pending_sealed,enabled_at:new Date().toISOString(),
        pending_sealed:null,pending_expires_at:null,last_used_step:step,
        attempt_count:0,attempt_window_start:new Date().toISOString(),
        blocked_until:"-infinity"})
      .eq("id",1).eq("owner_id",user.id).is("enabled_at",null)
      .eq("pending_sealed",existing.pending_sealed)
      .select("id").maybeSingle();
    if(error||!done)return respond(origin,{ok:false,error:"ENROLLMENT_UNAVAILABLE"},503);
    return respond(origin,{ok:true,enrolled:true});
  }
  if(name==="reset"){
    // The existing original owner email login is the recovery factor.
    if(body.confirm!=="RESET MY PROTON LOGIN")return deny(origin);
    const {error}=await db.from("humkin_proton_owner_login")
      .update({secret_sealed:null,pending_sealed:null,pending_expires_at:null,
        enabled_at:null,last_used_step:-1,attempt_count:0,
        blocked_until:"-infinity",attempt_window_start:new Date().toISOString()})
      .eq("id",1).eq("owner_id",user.id);
    if(error)return respond(origin,{ok:false,error:"RESET_UNAVAILABLE"},503);
    return respond(origin,{ok:true,enrolled:false});
  }
  return respond(origin,{ok:false,error:"UNKNOWN_ACTION"},400);
}
Deno.serve(async(request:Request)=>{
  const origin=request.headers.get("origin")||"";
  if(request.method==="OPTIONS")return new Response(null,{
    status:204,headers:cors(origin)
  });
  if(!ORIGINS.has(origin))return respond(origin,{ok:false,error:"ORIGIN_NOT_ALLOWED"},403);
  if(request.method!=="POST")return respond(origin,{ok:false,error:"METHOD_NOT_ALLOWED"},405);
  if(!API||!SERVICE||!ANON)return respond(origin,{ok:false,error:"AUTH_NOT_CONFIGURED"},503);
  if(Number(request.headers.get("content-length")||0)>2048)
    return respond(origin,{ok:false,error:"REQUEST_TOO_LARGE"},413);
  let body:any;
  try{body=await request.json()}catch{return respond(origin,{ok:false,error:"INVALID_JSON"},400);}
  const name=String(body?.action||"");
  if(!["login","status","enroll_begin","enroll_confirm","reset"].includes(name))
    return respond(origin,{ok:false,error:"UNKNOWN_ACTION"},400);
  try{return await action(service(),origin,name,body,request);}
  catch{
    // Generic failure, never expose a secret, provider error or JWT.
    return respond(origin,{ok:false,error:"AUTH_SERVICE_UNAVAILABLE"},503);
  }
});
