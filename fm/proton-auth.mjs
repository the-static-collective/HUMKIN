import {sessionStorageMode} from "./browser-safe-auth.mjs";
// Shared HUMKIN Proton Authenticator alternate login.
// Works inside both Crate Loader and Linkblocks R2 desk.
// Codes go only to Supabase Edge. Never log credentials or bearer tokens.
const ENDPOINT="https://kbhqacsdvjsstzyplqij.supabase.co/functions/v1/humkin-proton-login";
const KEY="sb_publishable_Bv9JuOctSQTmnE3O1dP8RA_MKRNSD-o";
const OWNER="us@abundent.org";

export function installProtonLogin({mount,getClient,onSignedIn=async()=>{}}){
  if(!mount||typeof getClient!=="function")throw Error("Missing HUMKIN authenticator host.");
  mount.innerHTML=[
    '<div class="hk-proton" style="margin:16px 0;padding:13px;border:1px solid currentColor;border-radius:10px">',
    '<style>.hk-proton [hidden]{display:none!important}</style>',
    '<p style="margin:0 0 8px"><strong>OR · PROTON AUTHENTICATOR</strong></p>',
    '<p class="small note" style="margin:0 0 10px">Six digits instead of an email link. A separate HUMKIN Radio entry in Proton. Existing email sign-in stays available.</p>',
    '<label for="hk-proton-code">Six-digit code from Proton</label>',
    '<input id="hk-proton-code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="123456" style="width:150px;max-width:100%;font-size:1.15rem;letter-spacing:.12em">',
    '<div class="actions row" style="display:flex;flex-wrap:wrap;gap:8px;margin:9px 0">',
    '<button id="hk-proton-signin" type="button">UNLOCK WITH PROTON</button>',
    '<button id="hk-proton-enroll" type="button" hidden class="secondary">SET UP PROTON ONCE</button>',
    '<button id="hk-proton-reset" type="button" hidden class="ghost">RESET PROTON ENROLLMENT</button></div>',
    '<div id="hk-proton-setup" hidden>',
    '<p class="small note">On a device already signed into HUMKIN, scan this QR with Proton Authenticator, or enter the secret manually. Only shown during enrollment.</p>',
    '<canvas id="hk-proton-qr" aria-label="Scan with Proton Authenticator" style="display:block;max-width:100%;background:white;border-radius:9px"></canvas>',
    '<label for="hk-proton-secret">Manual setup key</label>',
    '<input id="hk-proton-secret" type="text" readonly autocomplete="off" spellcheck="false" style="font-family:monospace;font-size:.8rem;width:100%">',
    '<p class="small note">Enter the new HUMKIN Radio code above, then press CONFIRM PAIRING. Do not share the setup key.</p>',
    '<button id="hk-proton-confirm" type="button" class="secondary">CONFIRM PAIRING</button></div>',
    '<p id="hk-proton-message" role="status" aria-live="polite" class="small note">To enroll, sign in with the existing HUMKIN email on a device where it works.</p>',
    '</div>'
  ].join("");
  const $=id=>mount.querySelector("#"+id);
  const code=$("hk-proton-code"),message=$("hk-proton-message");
  const buttons=["hk-proton-signin","hk-proton-enroll","hk-proton-reset","hk-proton-confirm"];
  const say=text=>message.textContent=text;
  function wait(state){for(const id of buttons)$(id).disabled=state;}
  function takeCode(){
    const value=code.value.trim();code.value="";
    if(!/^\d{6}$/.test(value))throw Error("Enter the six digits currently showing in Proton.");
    return value;
  }
  async function call(action,fields={},owner=false){
    const db=await getClient();
    const headers={"Content-Type":"application/json","apikey":KEY};
    if(owner){
      const {data,error}=await db.auth.getSession();
      if(error||!data?.session?.access_token||
         data.session.user?.email?.toLowerCase()!==OWNER)
        throw Error("First unlock HUMKIN with your existing email on this browser.");
      headers.Authorization="Bearer "+data.session.access_token;
    }
    const response=await fetch(ENDPOINT,{method:"POST",headers,cache:"no-store",
      body:JSON.stringify({action,...fields})});
    let reply;
    try{reply=await response.json();}
    catch{throw Error("The authenticator service isn't responding.");}
    if(!response.ok||reply.ok!==true){
      const msg=String(reply.error||"AUTH_UNAVAILABLE");
      throw Error({
        ALREADY_PAIRED:"HUMKIN Radio is already paired in Proton.",
        START_ENROLLMENT_AGAIN:"Pairing timed out; press SET UP PROTON ONCE again.",
        NOT_AUTHORIZED_OR_CODE_INVALID:"Code incorrect, already used, or temporarily rate-limited. Use a new code or email login.",
        AUTH_NOT_CONFIGURED:"HUMKIN Proton service isn't configured yet.",
        SESSION_ISSUE_FAILED:"Code accepted, but Supabase could not open a session. Use a new code later or email login."
      }[msg]||"Proton login unavailable: "+msg);
    }
    return reply;
  }
  async function status(){
    const db=await getClient();
    const {data}=await db.auth.getSession();
    const signedIn=data?.session?.user?.email?.toLowerCase()===OWNER;
    $("hk-proton-enroll").hidden=!signedIn;
    $("hk-proton-reset").hidden=true;
    if(!signedIn)return;
    try{
      const result=await call("status",{},true);
      $("hk-proton-enroll").hidden=result.enrolled===true;
      $("hk-proton-reset").hidden=result.enrolled!==true;
      if(result.enrolled)say("Proton is paired. This browser has a valid HUMKIN owner session.");
      else say("Ready to pair HUMKIN Radio with Proton Authenticator—one-time setup.");
    }catch(error){say(error.message);}
  }
  async function qr(uri){
    const canvas=$("hk-proton-qr");
    try{
      const QRCode=(await import("https://esm.sh/qrcode@1.5.4")).default;
      await QRCode.toCanvas(canvas,uri,{width:205,margin:2,
        color:{dark:"#182435",light:"#ffffff"}});
    }catch{
      canvas.hidden=true;
      say("QR unavailable. In Proton Authenticator add a TOTP account manually using the key below.");
    }
  }
  $("hk-proton-signin").addEventListener("click",async()=>{
    wait(true);
    try{
      const result=await call("login",{code:takeCode()});
      say("Proton code accepted. Opening the HUMKIN session on this browser…");
      const db=await getClient();
      const {data,error}=await db.auth.setSession({
        access_token:result.access_token,refresh_token:result.refresh_token
      });
      if(error||data?.user?.email?.toLowerCase()!==OWNER)
        throw Error("Supabase rejected the issued session.");
      say("Unlocked with Proton. Your R2 uploader and catalog are available."+
        (sessionStorageMode()==="localStorage"?"":" Browser session storage is restricted; sign-in may need repeating after closing the tab."));
      await onSignedIn();await status();
    }catch(error){
      if(/(?:request was denied|NotAllowedError|SecurityError)/i.test(String(error.message||"")))
        say("The Mac browser denied access to its session storage. Enable site data for humkin.abundent.org or try this page in another browser. Your Proton pairing is fine.");
      else say(error.message);
    }
    finally{wait(false);}
  });
  $("hk-proton-enroll").addEventListener("click",async()=>{
    wait(true);
    try{
      const result=await call("enroll_begin",{},true);
      $("hk-proton-setup").hidden=false;
      $("hk-proton-qr").hidden=false;
      $("hk-proton-secret").value=result.secret;
      say("Pair HUMKIN Radio in Proton, then enter the first six-digit code above.");
      await qr(result.provisioning_url);
    }catch(error){say(error.message);}
    finally{wait(false);}
  });
  $("hk-proton-confirm").addEventListener("click",async()=>{
    wait(true);
    try{
      await call("enroll_confirm",{code:takeCode()},true);
      $("hk-proton-setup").hidden=true;
      $("hk-proton-secret").value="";$("hk-proton-qr").width=0;
      say("HUMKIN Radio is now paired. Use a NEW code when signing in on another computer.");
      await status();
    }catch(error){say(error.message);}
    finally{wait(false);}
  });
  $("hk-proton-reset").addEventListener("click",async()=>{
    if(!confirm("Reset HUMKIN Radio's Proton login? Existing email sign-in remains available. You'll need to pair Proton again."))return;
    wait(true);
    try{
      await call("reset",{confirm:"RESET MY PROTON LOGIN"},true);
      $("hk-proton-setup").hidden=true;
      $("hk-proton-secret").value="";
      say("Proton pairing reset. You can enroll a new HUMKIN Radio entry.");
      await status();
    }catch(error){say(error.message);}
    finally{wait(false);}
  });
  // No secret generated just by opening a public page.
  status().catch(error=>say(error.message));
}
