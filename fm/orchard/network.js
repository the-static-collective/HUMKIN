/* HUMKIN ORCHARD NETWORK 004. Browser P-256 signatures, opt-in public homes,
 * actual server-serialized trades, and a bounded catalog comparison task.
 * No private signing key or secret is sent to the station. No fake Top 42 plays.
 */
(()=>{
"use strict";
const API="https://kbhqacsdvjsstzyplqij.supabase.co/functions/v1/humkin-orchard-network";
const CHART="https://kbhqacsdvjsstzyplqij.supabase.co/functions/v1/humkin-league";
const ROTATION="https://humkin.abundent.org/fm/rotation.json";
const DB_NAME="humkin-orchard-listener-key-v1";
const M=window.HumkinOrchard;
const $=id=>document.getElementById(id);
let keys=null,mine=null,allHomes=[],recipient="",running=false,toastTimer=0,heartbeatTimer=0,requestBusy=false,servingBusy=false;
let importedNative=null;
function receiveNativeProjection(){
 // A phone can carry its decorative *self-report*, NOT a proof of listening,
 // tradeable artifact, server balance, identity or verified work.
 const url=new URL(location.href),value=url.searchParams.get("native");
 if(!value)return;
 try{
  if(value.length>2400||!/^[A-Za-z0-9_-]+$/.test(value))throw Error("Invalid scene");
  const encoded=value.replace(/-/g,"+").replace(/_/g,"/");
  const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
  const result=JSON.parse(new TextDecoder().decode(bytes));
  if(result.v!==1||!Number.isInteger(result.stage)||!Array.isArray(result.things))
   throw Error("Unrecognized scene version");
  const things=result.things.slice(0,24).filter(x=>typeof x==="string"&&M?.item?.(x));
  importedNative={room:typeof result.room==="string"?result.room.slice(0,32):"Native Listening Room",
    stage:Math.max(0,Math.min(6,result.stage)),things,
    minutes:Number.isInteger(result.minutes)?Math.max(0,Math.min(100000,result.minutes)):0};
 }catch{
  importedNative=null;
 }finally{
  url.searchParams.delete("native");
  history.replaceState(null,"",url);
 }
}
function node(tag,cls,text){
 const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e;
}
function tip(message){
 const t=$("toast");t.textContent=message;t.hidden=false;clearTimeout(toastTimer);
 toastTimer=setTimeout(()=>t.hidden=true,4800);
}
function errorText(e){return e instanceof Error?e.message:"Network request failed"}
function hex(raw){return Array.from(new Uint8Array(raw),b=>b.toString(16).padStart(2,"0")).join("")}
function base64(raw){
 let str="";for(const b of new Uint8Array(raw))str+=String.fromCharCode(b);
 return btoa(str).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
async function sha(value){return hex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))}
function canonJwk(j){return {kty:"EC",crv:"P-256",x:j.x,y:j.y}}
function newNonce(){return hex(crypto.getRandomValues(new Uint8Array(16)).buffer)}
function openDb(){
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open(DB_NAME,1);
  req.onupgradeneeded=()=>req.result.createObjectStore("identity",{keyPath:"slot"});
  req.onerror=()=>reject(req.error||Error("Cannot open private identity storage."));
  req.onsuccess=()=>resolve(req.result);
 });
}
async function readKey(){
 const db=await openDb();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction("identity","readonly"),req=tx.objectStore("identity").get("primary");
  req.onsuccess=()=>resolve(req.result||null);
  req.onerror=()=>reject(req.error||Error("Cannot read listener key."));
  tx.oncomplete=()=>db.close();
 });
}
async function saveKey(value){
 const db=await openDb();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction("identity","readwrite");
  tx.objectStore("identity").put({...value,slot:"primary"});
  tx.oncomplete=()=>{db.close();resolve(true)};
  tx.onerror=()=>reject(tx.error||Error("Cannot store private key."));
 });
}
async function apiGet(mode,identity){
 const url=new URL(API);
 url.searchParams.set("mode",mode);
 if(identity)url.searchParams.set("id",identity);
 const response=await fetch(url,{cache:"no-store"});
 let json;
 try{json=await response.json()}catch{throw Error("Network returned invalid JSON.")}
 if(!response.ok||json.error)throw Error(json.error||"HTTP "+response.status);
 return json;
}
async function signed(action,payload={}){
 if(!keys)throw Error("Establish a listener key before taking a network action.");
 const packet={actor:keys.id,nonce:newNonce(),action,ts:Date.now(),payload};
 const bytes=new TextEncoder().encode(JSON.stringify(packet));
 const signature=base64(await crypto.subtle.sign(
  {name:"ECDSA",hash:"SHA-256"},keys.privateKey,bytes));
 const response=await fetch(API,{method:"POST",cache:"no-store",
  headers:{"Content-Type":"application/json"},body:JSON.stringify({packet,signature})});
 let data;
 try{data=await response.json()}catch{throw Error("Network returned an unreadable receipt.")}
 if(!response.ok||data.error)throw Error(data.error||"HTTP "+response.status);
 return data;
}
function local(){
 if(importedNative)return {...importedNative,things:importedNative.things.slice()};
 let saved=M?M.fresh():null;
 try{if(M)saved=M.read(localStorage)}catch{}
 let room="The Room With The Radio";
 try{room=localStorage.getItem("humkin-orchard-room-name-v1")||room}catch{}
 const things=saved?.inventory?.slice(-24).map(x=>x.type)||[];
 return {room,stage:M?M.stage(saved):0,things,minutes:Math.floor((saved?.listenSeconds||0)/60)};
}
function showLocal(){
 const data=local();
 $("home-name").value=data.room.slice(0,32);
 const notice=$("native-import-notice");
 if(notice)notice.hidden=!importedNative;
 $("snapshot-preview").textContent=
   "GARDEN STAGE "+(data.stage+1)+"/7 · "+data.things.length+
   " local objects · "+data.minutes+" local listening minutes. "+
   (data.things.length?"Collected: "+data.things.slice(0,8).join(", "):"This room has room to grow.");
}
function formatId(s){return s?.slice(0,7)+"…"+s?.slice(-6)}
function showIdentity(){
 const ready=!!keys;
 $("enroll").textContent=ready?"↻ RECONNECT THIS LISTENER KEY":"✳ ESTABLISH MY LISTENER KEY";
 $("my-identity").hidden=!ready;
 $("publish-controls").hidden=!ready;
 $("offer-controls").hidden=!ready;
 $("run-work").disabled=!ready||running;
 $("identity-status").textContent=ready?
  "Your private signing key is on this device. Server ownership will be checked independently.":
  "No network identity yet. Your existing local HUM and decorations will not be altered.";
 if(ready)$("my-id").textContent=keys.id;
 showLocal();
}
async function enroll(){
 $("enroll").disabled=true;
 try{
  if(!window.crypto?.subtle||!indexedDB)throw Error("This browser needs WebCrypto and IndexedDB.");
  if(!keys){
   const pair=await crypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},false,["sign","verify"]);
   const jwk=canonJwk(await crypto.subtle.exportKey("jwk",pair.publicKey));
   const id=await sha(JSON.stringify(jwk));
   const value={id,privateKey:pair.privateKey,publicJwk:jwk};
   await saveKey(value);keys=value;
  }
  const response=await signed("register",{jwk:keys.publicJwk,name:$("display-name").value});
  mine=response;
  showIdentity();drawState();
  tip("Your network listener key is established. Starter curiosities are now recorded on the station server.");
 }catch(e){tip(errorText(e));$("identity-status").textContent="Identity setup not complete: "+errorText(e)}
 finally{$("enroll").disabled=false}
}
async function sync(){
 if(!keys)return;
 try{mine=await signed("state",{});drawState();$("network-signal").textContent="NETWORK RESPONDING · SIGNED LISTENER STATE VERIFIED"}
 catch(e){tip("Network state: "+errorText(e))}
}
function drawState(){
 if(!mine)return;
 const p=mine.node;
 if(p){
  $("display-name").value=p.display_name||"A Neighbor";
  $("publish-optin").checked=!!p.is_public;
  $("publish-message").textContent=p.is_public?
   "This room is publicly visible. You can uncheck the box and save to withdraw publication.":
   "This room is private. Only the keyholder can change publication.";
 }
 const cabinet=$("cabinet");cabinet.replaceChildren();
 const choice=$("artifact-choice");choice.replaceChildren();
 if(!mine.artifacts?.length){
  cabinet.append(node("div","empty","Your network cabinet is empty. Establish your listener key first."));
 }else mine.artifacts.forEach(a=>{
   const card=node("article","artifact");
   card.append(node("span","glyph",glyph(a.kind)));
   card.append(node("b","",name(a.kind)));
   card.append(node("small","","NETWORK SERIAL "+a.serial+" · ORIGIN "+a.origin));
   card.append(node("small","","ID "+formatId(a.id)));
   cabinet.append(card);
   const option=node("option","",name(a.kind)+" · #"+a.serial);
   option.value=a.id;choice.append(option);
 });
 $("inbox").replaceChildren();$("outbox").replaceChildren();
 const incoming=(mine.inbox||[]).filter(x=>x.status==="open"&&Date.parse(x.expires_at)>Date.now());
 const outgoing=(mine.sent||[]).filter(x=>x.status==="open"&&Date.parse(x.expires_at)>Date.now());
 drawOffers("inbox",incoming,true);
 drawOffers("outbox",outgoing,false);
 const receipts=$("work-receipts");receipts.replaceChildren();
 (mine.receipts||[]).slice(0,4).forEach(r=>{
  const entry=node("p","receipt","✳ "+r.station_day+" · "+
    r.capability+" · "+r.track_count+" verified catalog entries.");
  receipts.append(entry);
 });
 if(mine.receipts?.length)$("work-status").textContent=
  "The station has "+mine.receipts.length+" server-recorded checks for this key (most recent 15 shown).";
}
function name(kind){
 return {"chipped-blue-cup":"Chipped Blue Cup","window-seed":"Window Seed",
   "relay-leaf":"The Relay Leaf","porch-bell":"The Porch Bell"}[kind]||kind.replace(/-/g," ");
}
function glyph(kind){
 return {"chipped-blue-cup":"☕","window-seed":"🌱","relay-leaf":"🍃","porch-bell":"🔔"}[kind]||"✳";
}
function drawOffers(id,offers,isInbox){
 const area=$(id);
 if(!offers.length){area.append(node("p","empty","No open "+(isInbox?"incoming":"outgoing")+" offers."));return}
 offers.forEach(o=>{
  const card=node("article","offer-item");
  card.append(node("strong","",isInbox?"A neighbor offered a collectible":"Your offer is awaiting acceptance"));
  card.append(node("small","",isInbox?"FROM "+formatId(o.sender_id):"TO "+formatId(o.recipient_id)));
  card.append(node("small","","ARTIFACT "+formatId(o.artifact_id)+" · ENDS "+new Date(o.expires_at).toLocaleString()));
  const button=node("button","sub",isInbox?"ACCEPT THIS OBJECT":"CANCEL OFFER");
  button.type="button";button.addEventListener("click",async()=>{
   if(!confirm(isInbox?"Accept this gift/trade? The server will atomically transfer this object to your cabinet.":
    "Cancel this pending offer?"))return;
   button.disabled=true;
   try{
    const resp=await signed(isInbox?"accept":"cancel",{offer_id:o.id});
    tip(isInbox?"Ownership transfer confirmed by the network.":"Offer cancelled.");
    await sync();await refreshWorld();
   }catch(e){tip(errorText(e))}
   finally{button.disabled=false}
  });
  card.append(button);area.append(card);
 });
}
async function publish(){
 const b=$("publish");b.disabled=true;
 try{
  const snap=local();
  snap.room=$("home-name").value.trim().slice(0,32)||snap.room;
  const publicRoom=$("publish-optin").checked;
  const nameValue=$("display-name").value.trim().slice(0,32)||"A Neighbor";
  if(publicRoom&&!confirm("Publish the room name, growth stage and chosen local decoration IDs for everyone to see? Your local listening history and personal data will not be published."))return;
  const result=await signed("publish",{home:snap,name:nameValue,public:publicRoom});
  $("publish-message").textContent=publicRoom?"Your network home is now publicly served by the station.":"Network home saved privately.";
  try{localStorage.setItem("humkin-orchard-room-name-v1",snap.room)}catch{}
  tip(publicRoom?"A LITTLE PUBLIC PORCH IS LIVE.":"Home saved privately.");
  await sync();await refreshWorld();
 }catch(e){tip(errorText(e))}
 finally{b.disabled=false}
}
async function presence(){
 if(!keys)return;
 try{
  const serve=$("serve-optin").checked;
  await signed("heartbeat",{serve,offered_capabilities:["home.snapshot.v1","radio.catalog.audit.v1"]});
  $("network-signal").textContent=serve?"SIGNED PRESENCE · LIVE SNAPSHOT SERVICE OFFERED":"SIGNED PRESENCE · VISIBLE AS RECENT FOR TWO MINUTES";
  $("serve-status").textContent=serve?"LIVE PORCH SERVICE OFFERED · YOUR BROWSER WILL ANSWER ONLY WHILE THE PAGE IS VISIBLE.":"LIVE SERVICE OFF · NO SNAPSHOTS ARE BEING SERVED.";
 }catch(e){tip(errorText(e))}
}
async function refreshWorld(){
 const cards=$("homes");cards.replaceChildren();
 try{
  const data=await apiGet("world");
  allHomes=data.homes||[];
  $("world-count").textContent=allHomes.length;
  $("network-signal").textContent=data.online_now+" RECENTLY PRESENT · "+allHomes.length+" PUBLIC PORCHES";
  if(!allHomes.length){cards.append(node("p","empty","The public orchard is young. The first shared room could be yours."));return}
  allHomes.forEach(h=>{
   const button=node("button","home-card");
   button.type="button";
   button.append(node("span","glyph",h.stage>=4?"🌳":h.stage>=1?"🌱":"📻"));
   button.append(node("b","",h.room||"A Listening Room"));
   button.append(node("small","",h.name+" · STAGE "+(h.stage+1)));
   if(h.serving)button.append(node("small","live","✳ SERVING LIVE SNAPSHOTS"));
   else if(h.online)button.append(node("small","live","✳ RECENTLY PRESENT"));
   button.addEventListener("click",()=>visit(h.identity));
   cards.append(button);
  });
 }catch(e){cards.append(node("p","empty","The network porch is temporarily unavailable. "+errorText(e)))}
}
async function visit(actor){
 try{
  const h=await apiGet("home",actor);
  recipient=h.identity;
  $("request-live").disabled=!keys||!h.serving;
  $("request-status").textContent=h.serving?"Live request available when both listeners have signed keys.":"The listener is not offering a foreground live snapshot at this moment.";
  $("visitor").hidden=false;
  $("visitor-name").textContent=h.home?.room||"A Listening Room";
  $("visitor-meta").textContent=h.name+" · "+(h.serving?"OFFERING LIVE SNAPSHOTS":h.online?"RECENTLY PRESENT":"NOT CURRENTLY PRESENT")+
   " · GARDEN STAGE "+((h.home?.stage||0)+1)+"/7 · public owner ID "+formatId(h.identity);
  $("visitor-scene").replaceChildren();
  const things=(h.home?.things||[]).slice(0,15);
  (things.length?things:["📻","🌱"]).forEach(t=>{
   const spec=M?.item?.(t);
   const e=node("span","",spec?spec.icon:(t.startsWith?.("📻")?t:"✳"));
   e.title=spec?.name||"Room decoration";
   $("visitor-scene").append(e);
  });
  $("visitor-artifacts").textContent=
   (h.server_artifacts?.length||0)+" SERVER-ISSUED COLLECTIBLES · "+
   (h.server_artifacts||[]).slice(0,4).map(x=>name(x.kind)+" #"+x.serial).join(" · ");
  const u=new URL(location.href);u.searchParams.set("home",actor);
  history.replaceState(null,"",u);
  $("visitor").scrollIntoView({behavior:"smooth",block:"nearest"});
 }catch(e){tip(errorText(e))}
}
async function offer(){
 const to=$("recipient-id").value.trim().toLowerCase();
 const id=$("artifact-choice").value;
 if(!/^[a-f0-9]{64}$/.test(to)||!id){tip("Enter a complete recipient ID and choose an artifact.");return}
 if(to===keys?.id){tip("Trading to yourself is unnecessary.");return}
 const selected=mine?.artifacts?.find(x=>x.id===id);
 if(!selected)return;
 if(!confirm("Offer "+name(selected.kind)+" #"+selected.serial+" to "+formatId(to)+
  " for one day? The recipient must accept before ownership moves."))return;
 try{
  await signed("offer",{to,artifact_id:id});
  tip("A signed offer is now waiting for its recipient.");
  await sync();
 }catch(e){tip(errorText(e))}
}
async function lightWork(){
 if(running||!keys)return;
 if(navigator.connection?.saveData){tip("Data Saver is on. No volunteer job started.");return}
 if(typeof navigator.getBattery==="function"){
  try{const battery=await navigator.getBattery();
   if(!battery.charging&&battery.level<.25){tip("Battery below 25%; the station is holding this job.");return}
  }catch{}
 }
 running=true;$("run-work").disabled=true;
 const status=$("work-status");
 try{
  status.textContent="Requesting a signed, bounded catalog work offer…";
  const issued=await signed("challenge",{capability:"radio.catalog.audit.v1",consent:true});
  if(!issued.offer||issued.offer.capability!=="radio.catalog.audit.v1")throw Error("Unsupported station work offer.");
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7500);
  let text;
  try{
   const response=await fetch(ROTATION,{cache:"no-store",signal:controller.signal});
   if(!response.ok)throw Error("Published catalog unavailable.");
   text=await response.text();
  }finally{clearTimeout(timer)}
  if(text.length>issued.offer.max_bytes)throw Error("Catalog exceeds the work offer's size limit.");
  const tracks=JSON.parse(text).tracks;
  if(!Array.isArray(tracks)||!tracks.length||tracks.length>1000)throw Error("Invalid catalog.");
  const found=new Set();
  for(const t of tracks){
   if(!t||typeof t.id!=="string"||!t.id||found.has(t.id)||
      typeof t.title!=="string"||!t.title||
      typeof t.src!=="string"||
      new URL(t.src,ROTATION).origin!=="https://humkin.abundent.org")throw Error("Catalog invariant failed.");
   found.add(t.id);
  }
  status.textContent="Submitting signed result for independent station-side validation…";
  const digest=await sha(text);
  const accepted=await signed("complete",{challenge_id:issued.offer.id,digest});
  status.textContent="VERIFIED NETWORK RECEIPT · "+tracks.length+" catalog entries agree with station origin. One Relay Leaf issued.";
  tip("THE LITTLE ENGINE DID A REAL NETWORK ROUND TRIP.");
  await sync();
 }catch(e){status.textContent="WORK HELD / REFUSED · "+errorText(e)}
 finally{running=false;$("run-work").disabled=!keys}
}

async function pollLive(){
 if(servingBusy||!keys||!$("serve-optin").checked||document.visibilityState!=="visible")return;
 servingBusy=true;
 try{
  const job=await signed("poll_live",{capability:"foreground.home.snapshot.v1"});
  if(job.serving&&Array.isArray(job.requests)&&job.requests.length){
   for(const request of job.requests){
    const reply=await signed("serve_live",{request_id:request.id,home:local()});
    $("serve-status").textContent="SERVED A REAL FRESH SNAPSHOT · "+new Date().toLocaleTimeString()+
      " · "+formatId(request.requester_id)+ " RECEIVED A SERVER-RELAYED ROOM.";
    tip(reply.served?.first_service_artifact?
      "FIRST LIVE SERVICE! YOUR NETWORK CABINET RECEIVED A PORCH BELL.":
      "A NEIGHBOR RECEIVED A FRESH SNAPSHOT FROM YOUR OPEN BROWSER.");
   }
   await sync();await refreshWorld();
  }
 }catch(e){$("serve-status").textContent="LIVE SERVICE HELD · "+errorText(e)}
 finally{servingBusy=false}
}
async function askLive(){
 if(requestBusy)return;
 if(!keys){tip("Establish your listener key before asking for a fresh snapshot.");return}
 if(!recipient){tip("Choose a public listening room first.");return}
 requestBusy=true;$("request-live").disabled=true;
 try{
  $("request-status").textContent="Requesting one signed, voluntary fresh room snapshot…";
  const request=await signed("request_live",{to:recipient});
  const uid=request.request.id;
  const expiry=Date.parse(request.request.expires_at);
  let served=false;
  while(Date.now()<expiry&&document.visibilityState==="visible"){
   await new Promise(resolve=>setTimeout(resolve,5000));
   const reply=await apiGet("live-result",uid);
   if(reply.state==="served"){
    served=true;
    $("request-status").textContent="LIVE SERVICE RETURNED · A fresh server-relayed snapshot arrived from that browser at "+new Date(reply.served_at).toLocaleTimeString()+".";
    const home=reply.home||{};
    $("visitor-scene").replaceChildren();
    const things=(home.things||[]).slice(0,15);
    (things.length?things:["📻","🌱"]).forEach(t=>{
     const spec=M?.item?.(t);
     const el=node("span","",spec?.icon||"✳");el.title=spec?.name||"Listening room";
     $("visitor-scene").append(el);
    });
    tip("A REAL NEIGHBOR'S PHONE OR BROWSER SERVED A FRESH ROOM SNAPSHOT.");
    break;
   }
   if(reply.state==="expired")break;
  }
  if(!served)$("request-status").textContent="NO LIVE ANSWER · That listener may have closed the page. The ordinary public snapshot remains available.";
 }catch(e){$("request-status").textContent="LIVE REQUEST HELD · "+errorText(e)}
 finally{requestBusy=false;$("request-live").disabled=false}
}

async function chart(){
 try{
  const r=await fetch(CHART,{cache:"no-store"});
  if(!r.ok)throw Error("Chart unavailable");
  const j=await r.json();
  $("chart-day").textContent="TODAY · "+(j.station_day||"CHICAGO TIME");
  const c=$("chart-mini");c.replaceChildren();
  const items=(j.chart||[]).slice(0,7);
  if(!items.length)c.append(node("li","","Still waiting for a qualified listen."));
  for(const t of items)c.append(node("li","",
   (t.title||t.name||t.id||"A Recording")+" · "+(t.plays||0)+" PLAYS"));
 }catch{$("chart-mini").replaceChildren(node("li","","Record office temporarily offline."))}
}
async function boot(){
 receiveNativeProjection();
 showIdentity();
 try{keys=await readKey();showIdentity();if(keys)await sync()}
 catch(e){$("identity-status").textContent="Private key storage isn't accessible: "+errorText(e)}
 await Promise.all([refreshWorld(),chart()]);
 const initial=new URL(location.href).searchParams.get("home");
 if(initial&&/^[a-f0-9]{64}$/.test(initial))visit(initial);
}
$("enroll").addEventListener("click",enroll);
$("copy-id").addEventListener("click",async()=>{
 try{await navigator.clipboard.writeText(keys.id);tip("Your public listener ID was copied.")}
 catch{prompt("Copy your public listener ID:",keys.id)}
});
$("publish").addEventListener("click",publish);
$("refresh-own").addEventListener("click",sync);
$("refresh-world").addEventListener("click",refreshWorld);
$("presence-now").addEventListener("click",presence);
$("close-visitor").addEventListener("click",()=>{
 $("visitor").hidden=true;recipient="";
 const u=new URL(location.href);u.searchParams.delete("home");history.replaceState(null,"",u);
});
$("choose-recipient").addEventListener("click",()=>{
 if(!keys){tip("Establish a listener key before offering a collectible.");return}
 $("recipient-id").value=recipient;document.getElementById("trade-section").scrollIntoView({behavior:"smooth"});
});
$("offer").addEventListener("click",offer);
$("run-work").addEventListener("click",lightWork);
$("presence-optin").addEventListener("change",()=>{
 if($("presence-optin").checked)presence();
 else{
  $("serve-optin").checked=false;
  presence();
 }
});
$("serve-optin").addEventListener("change",async()=>{
 if($("serve-optin").checked){
  if(!keys||!mine?.node?.is_public){
   $("serve-optin").checked=false;
   tip("Establish your listener key and PUBLISH your public room before offering fresh live service.");
   return;
  }
  $("presence-optin").checked=true;
  await presence();await pollLive();
 }else{
  await presence();
 }
});
$("request-live").addEventListener("click",askLive);
setInterval(pollLive,20000);
heartbeatTimer=setInterval(()=>{
 if(keys&&($("presence-optin").checked||$("serve-optin").checked)&&document.visibilityState==="visible")presence();
},60000);
boot();
})();
