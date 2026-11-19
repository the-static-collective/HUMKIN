// HUMKIN MESH RADIO — optional direct-to-R2 crate intake.
// Loaded only on demand. Uses the same verified Supabase owner session and
// the existing HUMKIN R2 Edge Function as /fm/load/. No R2 keys in the browser.
// Nothing is made public until the owner presses PUBLISH.
import {installProtonLogin} from "../proton-auth.mjs";
import {humkinAuthOptions} from "../browser-safe-auth.mjs";
const API="https://kbhqacsdvjsstzyplqij.supabase.co";
const KEY="sb_publishable_Bv9JuOctSQTmnE3O1dP8RA_MKRNSD-o"; // RLS-scoped, public.
const OWNER="us@abundent.org";
const MAX_BYTES=50*1024*1024;
const $=id=>document.getElementById(id);

export function installR2Intake({getFiles,onPublished,log}){
  let db=null,direct=null,putPrivateMp3=null,working=false,verified=[];
  const notify=msg=>{$("r2-message").textContent=msg;log("R2: "+msg);};
  const busy=state=>{
    working=state;
    for(const id of ["r2-check","r2-send-link","r2-verify-link","r2-upload","r2-refresh","r2-publish"])
      $(id).disabled=state;
    if(!state)$("r2-publish").disabled=!verified.length;
  };
  const ui=session=>{
    const who=session?.user?.email?.toLowerCase();
    const logged=who===OWNER;
    $("r2-login").textContent=logged?"HUMKIN owner signed in · "+who:
      "Owner sign-in needed on this browser. If you already unlocked the Crate Loader here, use CHECK CONNECTION.";
    $("r2-upload").disabled=!logged||working;
    $("r2-refresh").disabled=!logged||working;
    $("r2-publish").disabled=!logged||working||!verified.length;
    return logged;
  };
  async function client(){
    if(!db){
      const [{createClient},r2] = await Promise.all([
        import("https://esm.sh/@supabase/supabase-js@2.57.0"),
        import("../load/r2-direct-client.mjs")
      ]);
      db=createClient(API,KEY,{auth:humkinAuthOptions()});
      direct=r2.r2Direct;
      putPrivateMp3=r2.putPrivateMp3;
      db.auth.onAuthStateChange(()=>setTimeout(()=>refreshLogin().catch(()=>{}),0));
    }
    return db;
  }
  async function ownerSession(){
    const c=await client();
    const {data,error}=await c.auth.getSession();
    if(error)throw error;
    if(!ui(data?.session))throw Error("Unlock the HUMKIN owner account on this browser first.");
    return {db:c,session:data.session};
  }
  async function refreshLogin(){
    const c=await client();
    const {data,error}=await c.auth.getSession();
    if(error)throw error;
    ui(data?.session);
    return data?.session||null;
  }
  async function check(){
    const {db:c}=await ownerSession();
    const state=await direct(c,"status");
    $("r2-connection").textContent=state.ready===true?
      "PRIVATE R2 READY · MP3 files go directly from this computer to the HUMKIN private staging bucket. Publish afterward to make them playable across the network.":
      "PRIVATE R2 NOT READY · "+String(state.reason||"Check bucket/permissions")+
      ". Existing Crate Loader can use its Supabase staging fallback.";
    return state;
  }
  async function listDrafts(){
    const {db:c,session}=await ownerSession();
    const {data,error}=await c.from("humkin_radio_tracks")
      .select("id,title,artist,sha256,bytes,r2_upload_verified_at")
      .eq("uploaded_by",session.user.id)
      .eq("storage_provider","r2_private")
      .is("published_at",null)
      .not("r2_upload_verified_at","is",null)
      .order("created_at",{ascending:true}).limit(2000);
    if(error)throw error;
    verified=data||[];
    const el=$("r2-drafts");el.replaceChildren();
    if(!verified.length){
      const item=document.createElement("li");
      item.textContent="No verified private R2 drafts. Upload an MP3 crate above.";
      el.append(item);
    }else{
      for(const row of verified.slice(0,100)){
        const li=document.createElement("li");
        li.textContent=(row.artist||"HUMKIN")+" — "+row.title+
          " · "+(Number(row.bytes||0)/1048576).toFixed(1)+" MiB";
        el.append(li);
      }
      if(verified.length>100){
        const li=document.createElement("li");
        li.textContent="...and "+(verified.length-100)+" more verified drafts.";
        el.append(li);
      }
    }
    $("r2-publish").disabled=!verified.length||working;
    $("r2-drafts-count").textContent=verified.length+" verified private draft"+(verified.length===1?"":"s");
    return verified;
  }
  function durationOf(file){
    return new Promise((resolve,reject)=>{
      const player=document.createElement("audio");
      let settled=false;
      const src=URL.createObjectURL(file);
      const timer=setTimeout(()=>finish(null),12000);
      function finish(value){
        if(settled)return;settled=true;
        clearTimeout(timer);
        player.removeAttribute("src");player.load();
        URL.revokeObjectURL(src);
        if(value!==null&&value>=1&&value<=14400)resolve(value);
        else reject(Error("Could not determine MP3 duration; open the original Crate Loader for this file."));
      }
      player.preload="metadata";
      player.onloadedmetadata=()=>finish(Number.isFinite(player.duration)?player.duration:null);
      player.onerror=()=>finish(null);
      player.src=src;
    });
  }
  async function stage(){
    const selected=getFiles();
    const mp3s=selected.filter(x=>/\.mp3$/i.test(x.file.name));
    if(!mp3s.length){
      notify(selected.length?
        "No MP3s selected. This direct intake handles MP3s; convert WAV/M4A with the existing Crate Loader.":
        "Choose your Mac music folder above first. No files have been uploaded.");
      return;
    }
    busy(true);
    let completed=0,uploaded=0,duplicates=0,errors=0;
    try{
      const {db:c}=await ownerSession();
      const state=await direct(c,"status");
      if(state.ready!==true)throw Error("Private R2 isn't ready: "+state.reason+
        ". The old Crate Loader can still stage through Supabase.");
      const items=mp3s.slice();
      let next=0;
      const worker=async()=>{
        while(next<items.length){
          const item=items[next++];
          const file=item.file,record=item.record;
          try{
            if(file.size>MAX_BYTES||file.size<1)throw Error("MP3 must be between 1 byte and 50 MiB.");
            const duration=Number(record?.duration_seconds)>0?
              Number(record.duration_seconds):await durationOf(file);
            const meta={
              sha256:item.sha256,bytes:file.size,original_name:file.name.slice(0,240),
              title:String(record?.title||file.name.replace(/\.mp3$/i,"")).slice(0,120).trim(),
              artist:String(record?.artist||"HUMKIN").slice(0,160).trim(),
              album:String(record?.album||"HUMKIN RADIO · INBOX").slice(0,160).trim(),
              duration_seconds:duration,kind:"song",is_single:false
            };
            const preparation=await direct(c,"prepare",meta);
            if(preparation.already_cataloged){duplicates++;continue;}
            if(!preparation.already_staged){
              if(!preparation.put_url||!preparation.track_id)
                throw Error("The R2 service did not return an upload authorization.");
              await putPrivateMp3(file,preparation.put_url);
              await direct(c,"finalize",{track_id:preparation.track_id});
            }
            uploaded++;
          }catch(error){
            errors++;log("R2 "+file.name+": "+error.message);
          }finally{
            completed++;
            $("r2-progress").value=completed;
            $("r2-progress").max=items.length;
            $("r2-upload-count").textContent=completed+" / "+items.length+
              " processed · "+uploaded+" verified private R2 · "+duplicates+
              " already cataloged · "+errors+" errors";
          }
        }
      };
      await Promise.all(Array.from({length:Math.min(3,items.length)},worker));
      notify("R2 crate finished: "+uploaded+" verified in private R2, "+duplicates+
        " already in the catalog, "+errors+" errors. Nothing was published automatically.");
      await listDrafts();
    }catch(error){notify(error.message);}
    finally{busy(false);await refreshLogin().catch(()=>{});}
  }
  async function publish(){
    if(!verified.length){notify("No verified R2 drafts to publish.");return;}
    if(!confirm("Publish "+verified.length+
      " verified private R2 song(s) into HUMKIN's public radio catalog? All selected recordings must be yours to share."))return;
    busy(true);
    let published=0,failed=0;
    try{
      const {db:c}=await ownerSession();
      for(const item of verified.slice()){
        try{
          const result=await direct(c,"publish",{track_id:item.id});
          if(result.published!==true)throw Error("Not confirmed published.");
          published++;
          $("r2-upload-count").textContent="Published "+published+" / "+verified.length+" radio recordings.";
        }catch(error){failed++;log("R2 publishing "+item.title+": "+error.message);}
      }
      notify("Published "+published+" to HUMKIN public R2 + catalog. "+failed+
        " publication errors. Reloading playable radio links.");
      await listDrafts();
      if(published)await onPublished();
    }catch(error){notify(error.message);}
    finally{busy(false);await refreshLogin().catch(()=>{});}
  }
  $("r2-check").addEventListener("click",async()=>{
    try{notify("Checking HUMKIN owner session and R2...");await check();await listDrafts();
      notify("Connection checked. "+verified.length+" verified drafts found.");
    }catch(error){notify(error.message);}
  });
  $("r2-send-link").addEventListener("click",async()=>{
    busy(true);
    try{
      const c=await client();
      const {error}=await c.auth.signInWithOtp({
        email:OWNER,options:{emailRedirectTo:location.origin+"/fm/mesh-radio/",
          shouldCreateUser:false}
      });
      if(error)throw error;
      notify("Fresh sign-in email requested. If the link goes to localhost, COPY its unopened link address and paste it below instead.");
    }catch(error){notify(error.message);}
    finally{busy(false);}
  });
  $("r2-verify-link").addEventListener("click",async()=>{
    const input=$("r2-paste-link"),raw=input.value.trim();input.value="";
    busy(true);
    try{
      const link=new URL(raw);
      if(link.origin!==API||link.pathname!=="/auth/v1/verify")
        throw Error("Not a HUMKIN Supabase confirmation link.");
      const token=link.searchParams.get("token");
      const type=link.searchParams.get("type");
      if(!/^[a-fA-F0-9]{40,256}$/.test(token||"")||
         !["signup","magiclink","email"].includes(type))
        throw Error("Use the complete, fresh, unopened email verification link.");
      const c=await client();
      const {data,error}=await c.auth.verifyOtp({token_hash:token,type});
      if(error)throw error;
      if(data?.user?.email?.toLowerCase()!==OWNER){
        await c.auth.signOut();throw Error("Not the HUMKIN owner account.");
      }
      notify("Mac unlocked. Checking direct R2...");
      await check();await listDrafts();
    }catch(error){notify("Sign-in not complete: "+error.message);}
    finally{busy(false);await refreshLogin().catch(()=>{});}
  });
  $("r2-upload").addEventListener("click",stage);
  $("r2-refresh").addEventListener("click",async()=>{
    try{await listDrafts();notify("Verified drafts refreshed.");}
    catch(error){notify(error.message);}
  });
  $("r2-publish").addEventListener("click",publish);
  // The rest of the browser radio works without importing Supabase at all.
  ui(null);
  $("r2-progress").value=0;
  installProtonLogin({mount:$("proton-mesh"),getClient:client,onSignedIn:async()=>{
    await refreshLogin();await check();await listDrafts();
  }});
}
