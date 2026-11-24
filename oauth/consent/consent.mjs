// Shared owner-reviewed OAuth 2.1 consent. HUMKIN's existing browser Auth storage,
// Proton authenticator and email sign-in; no client secrets, no auto-approval.
import {createClient} from "https://esm.sh/@supabase/supabase-js@2.119.2";
import {humkinAuthOptions} from "../../fm/browser-safe-auth.mjs";
import {installProtonLogin} from "../../fm/proton-auth.mjs";

const API="https://kbhqacsdvjsstzyplqij.supabase.co";
const KEY="sb_publishable_Bv9JuOctSQTmnE3O1dP8RA_MKRNSD-o";
const OWNER="us@abundent.org";
const db=createClient(API,KEY,{auth:humkinAuthOptions()});
const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const id=params.get("authorization_id")||"";
let busy=false;
function status(message){$("status").textContent=message;}
function show(which){
  $("login").hidden=which!=="login";
  $("consent").hidden=which!=="consent";
}
function safeReturn(url){
  const parsed=new URL(url);
  if(parsed.protocol==="https:" ||
    (parsed.protocol==="http:"&&["localhost","127.0.0.1"].includes(parsed.hostname))){
    location.assign(parsed.href);
    return;
  }
  throw Error("Authorization server returned an unsafe destination.");
}
async function load(){
  if(!/^[a-zA-Z0-9_-]{8,180}$/.test(id)){
    show("");status("Missing or invalid authorization request. Start sign-in from the application requesting access.");
    return;
  }
  const {data:user,error:userError}=await db.auth.getUser();
  if(userError||!user?.user||user.user.email?.toLowerCase()!==OWNER||
     !user.user.email_confirmed_at){
    show("login");status("Sign in as the verified HUMKIN owner to review this request.");
    return;
  }
  try{
    status("Reading the client's actual permissions…");
    const {data,error}=await db.auth.oauth.getAuthorizationDetails(id);
    if(error||!data)throw Error("Cannot validate this authorization request.");
    if(!("authorization_id" in data)){
      if(typeof data.redirect_url!=="string")throw Error("Invalid authorization redirect.");
      safeReturn(data.redirect_url);return;
    }
    $("client-name").textContent=String(data.client?.name||"Unnamed application").slice(0,120);
    $("client-uri").textContent=String(data.client?.uri||"").slice(0,250);
    $("requested-scopes").textContent=String(data.scope||"No additional scopes listed.").slice(0,250);
    $("redirect-uri").textContent=String(data.redirect_uri||"").slice(0,400);
    show("consent");status("Check the requesting application, scopes, and return destination. Choose Approve or Deny.");
  }catch(e){
    show("");status(String(e?.message||"Authorization details unavailable."));
  }
}
async function decide(approved){
  if(busy)return;
  busy=true;
  $("approve").disabled=true;$("deny").disabled=true;
  try{
    status(approved?"Approving this connection…":"Denying this connection…");
    const {data,error}=approved?
      await db.auth.oauth.approveAuthorization(id):
      await db.auth.oauth.denyAuthorization(id);
    if(error||!data?.redirect_url)throw Error("Authorization server did not complete the decision.");
    safeReturn(data.redirect_url);
  }catch(e){
    status(String(e?.message||"Authorization unavailable."));
  }finally{
    busy=false;$("approve").disabled=false;$("deny").disabled=false;
  }
}
$("approve").addEventListener("click",()=>decide(true));
$("deny").addEventListener("click",()=>decide(false));
$("email-login").addEventListener("click",async()=>{
  try{
    const {error}=await db.auth.signInWithOtp({email:OWNER,
      options:{emailRedirectTo:location.href}});
    if(error)throw error;
    status("Check the HUMKIN owner email for the sign-in link. Return here to review this connection.");
  }catch(e){status("Owner email sign-in unavailable: "+String(e?.message||"Unknown error"));}
});
installProtonLogin({
  mount:$("proton-login"),getClient:async()=>db,
  onSignedIn:async()=>{await load()}
});
// An externally supplied URL never causes automatic consent.
load();
