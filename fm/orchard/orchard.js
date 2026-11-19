/* HUMKIN Orchard 001 — the browser's local player and collection.
 * Server chart plays are NEVER synthesized from orchard HUM.
 * The local workbench does not claim to be a connected GHoT worker.
 */
(function(){
"use strict";
const M=window.HumkinOrchard,N=window.HumkinNightWatch;
if(!M)return;
const $=function(id){return document.getElementById(id)};
const store=(()=>{try{return localStorage}catch{return {getItem:()=>null,setItem:()=>{}}}})();
let state=M.read(store);
M.grow(state);
M.save(store,state);
let roomName="The Room With The Radio";
try{roomName=(store.getItem("humkin-orchard-room-name-v1")||roomName).slice(0,32)}catch{}
let tracks=[],deck=[],current=null,lastTime=null,trying=false,runPending=false,slotCursor=0,toastTimer=null;
const audio=$("orchard-audio");
const configUrl=new URL("../rotation.json",document.baseURI);
function safeText(s){return String(s==null?"":s)}
function make(tag,cls,content){
 const n=document.createElement(tag);
 if(cls)n.className=cls;
 if(content!==undefined)n.textContent=safeText(content);
 return n;
}
function toast(message){
 const e=$("toast");e.textContent=message;e.hidden=false;
 if(toastTimer)clearTimeout(toastTimer);
 toastTimer=setTimeout(function(){e.hidden=true},3700);
}
function persist(){state.lastSeen=Date.now();if(!M.save(store,state))toast("Local storage is unavailable. This visit may not save.")}
function summary(){
 const p=M.progress(state);
 $("balance").textContent=state.hum.toLocaleString()+" ⓗ";
 $("level").textContent=String(p.level).padStart(2,"0");
 $("listen-total").textContent=Math.floor(state.listenSeconds/60).toLocaleString()+" MIN";
 $("count").textContent=state.inventory.length;
 $("xp-label").textContent=p.earned+" / "+p.needed+" XP TO NEXT LEVEL";
 $("xp-fill").style.width=Math.round(p.ratio*100)+"%";
 $("catalog-caption").textContent=M.SHOP.length+" shop objects · "+(M.RARE.length-1)+" listening discoveries · one engine spool";
}
function quest(){
 const level=M.level(state.xp);
 let title,body;
 if(state.inventory.length===0){title="Put the first object on your shelf.";body="Your starter HUM can buy something odd from the shop."}
 else if(state.listenSeconds<240){title="Let the music find something strange.";body="Four minutes of real listening reveals your first local mystery artifact."}
 else if(level<4){title="Grow the listening room toward the workbench.";body="Keep listening, collecting and letting the garden grow. The Little Engine opens at level 4."}
 else if(state.receipts.length===0){title="Wake the Little Engine.";body="A voluntary local catalog audit can earn its first workbench object."}
 else{title="Keep making a little room.";body="More listening grows the orchard. More treasures appear along the way."}
 $("quest-title").textContent=title;$("quest-copy").textContent=body;
}
function scene(){
 const st=M.stage(state),level=M.level(state.xp);
 $("scene").className="scene stage-"+st+(audio.paused?"":" spinning")+(new Date().getHours()<6||new Date().getHours()>=19?" night":"");
 const captions=["A room, a dial, a little room to grow.","The first tree heard the second verse.","Two trees are debating the tempo.","The orchard has its own opinions now.","A little forest grew outside the window.","There are more trees than chairs.","The trees have formed a listening club."];
 $("scene-caption").textContent=captions[st]||captions[0];
 $("growth-caption").textContent="ORCHARD STAGE "+(st+1)+" / 7 · "+Math.floor(state.growthHours)+" HOURS OF QUIET GROWTH";
 const layer=$("placements");layer.replaceChildren();
 for(let slot=0;slot<8;slot++){
   const uid=state.placements[String(slot)],unit=state.inventory.find(function(u){return u.uid===uid});
   const spec=unit?M.item(unit.type):null;
   const btn=make("button","slot slot-"+slot+(spec?" occupied":""),"");
   btn.type="button";btn.dataset.slot=String(slot);
   btn.setAttribute("aria-label",spec?"Stow "+spec.name:"Empty "+(slot<4?"room":"garden")+" display place");
   const icon=make("span","icon",spec?spec.icon:"+");
   const label=make("span","slot-name",spec?spec.name:(slot<4?"ROOM SLOT":"GARDEN SLOT"));
   btn.append(icon,label);
   btn.addEventListener("click",function(){
     if(unit){M.stow(state,unit.uid);persist();render();toast(spec.name+" returned to the cabinet.")}
     else {openTab("inventory");$("collection").scrollIntoView({behavior:"smooth"});toast("Choose an item from the collection to place here.")}
   });
   layer.append(btn);
 }
 const playing=!audio.paused&&!audio.ended;
 $("turntable").setAttribute("aria-label",playing?"Record playing":"Record paused");
}
function card(spec,unit){
 const box=make("article","item-card"+(M.level(state.xp)<spec.level?" locked":""));
 const top=make("div","meta");
 top.append(make("span","",spec.kind==="shop"?"OBJECT NO. "+String(M.SHOP.indexOf(spec)+1).padStart(2,"0"):"LOCAL ARTIFACT"));
 top.append(make("span","",spec.zone==="room"?"ROOM":"ORCHARD"));
 box.append(top);
 box.append(make("div","emoji",spec.icon));
 box.append(make("h3","",spec.name));
 box.append(make("p","",spec.lore));
 if(unit){
   const origin=make("div","serial","ORIGIN · "+unit.origin.toUpperCase());
   const placed=Object.values(state.placements).includes(unit.uid);
   const button=make("button",placed?"placed":"","");
   button.type="button";button.textContent=placed?"✳ STOW FROM SCENE":"↗ PLACE IN "+(spec.zone==="room"?"ROOM":"GARDEN");
   button.addEventListener("click",function(){
     if(placed){M.stow(state,unit.uid);toast("Back into the cabinet.")}
     else{
       const slots=spec.zone==="room"?[0,1,2,3]:[4,5,6,7];
       const free=slots.find(function(s){return !state.placements[String(s)]});
       const at=free!==undefined?free:slots[slotCursor++%slots.length];
       M.place(state,unit.uid,at);
       toast(spec.name+" is now on display.");
     }
     persist();render();
   });
   box.append(origin,button);
 }else{
   const button=make("button","","");
   button.type="button";
   const level=M.level(state.xp),locked=level<spec.level;
   button.textContent=locked?"LOCKED · LEVEL "+spec.level:state.hum<spec.cost?"NEED "+(spec.cost-state.hum)+" MORE HUM":"BUY · "+spec.cost+" HUM";
   button.disabled=locked||state.hum<spec.cost;
   button.addEventListener("click",function(){
     const r=M.buy(state,spec.id);toast(r.message);if(r.ok){persist();render()}
   });
   box.append(button);
 }
 return box;
}
function shop(){
 const box=$("shop-items");box.replaceChildren();
 M.SHOP.forEach(function(spec){box.append(card(spec,null))});
}
function inventory(){
 const box=$("inventory-items");box.replaceChildren();
 state.inventory.slice().reverse().forEach(function(unit){
   const spec=M.item(unit.type);if(spec)box.append(card(spec,unit));
 });
 $("empty-collection").hidden=state.inventory.length>0;
}
function unlocks(){
 const box=$("unlocks");box.replaceChildren();
 M.features(state).forEach(function(f){
  const e=make("article","unlock "+(f.unlocked?"ready":f.ready?"":"future"));
  e.append(make("b","",f.name),make("span","",f.unlocked?"✳ READY · LEVEL "+f.at:f.ready?"LOCKED · LEVEL "+f.at:"BUILDING · TARGET LEVEL "+f.at));
  box.append(e);
 });
 const can=M.level(state.xp)>=4;
 $("run-audit").disabled=!can||runPending;
 if(!can)$("audit-status").textContent="Local catalog checks unlock at level 4. No background work runs without a click.";
}
function render(){
 summary();quest();scene();shop();inventory();unlocks();
 const lv=M.level(state.xp);
 [["door-signal",3],["door-gambit",3],["door-guild",3],["door-network",5]].forEach(function(pair){
   const node=$(pair[0]);if(node)node.hidden=lv<pair[1];
 });
 $("guild-portal").hidden=lv<3;
 $("network-banner").hidden=lv<5;
 $("next-door").textContent=lv<3?"NEXT DOOR · PERSONAL SIGNAL AT LEVEL 3":
   lv<5?"NEXT DOOR · LIVING ORCHARD AT LEVEL 5":"THE BACKROOM FREQUENCY IS STILL BEING BUILT.";
}
function openTab(which){
 ["shop","inventory","workshop","future"].forEach(function(k){
  const active=k===which;
  $("pane-"+k).hidden=!active;
  $("tab-"+k).setAttribute("aria-selected",String(active));
 });
}
["shop","inventory","workshop","future"].forEach(function(k){$("tab-"+k).addEventListener("click",function(){openTab(k)})});
function randomDeck(){
 // One entry per song; release tracks receive a second chance in subsequent
 // rounds via weighted picks, without guaranteed immediate repeats.
 const arr=tracks.slice();
 const release=t=>t.featured?2:1;
 const bag=[];
 let prev=state.lastTrack;
 while(arr.length){
  const candidate=arr.filter(function(t){return t.id!==prev});
  const pool=candidate.length?candidate:arr;
  const total=pool.reduce(function(s,t){return s+release(t)},0);
  let pick=Math.random()*total,chosen=pool[pool.length-1];
  for(const t of pool){pick-=release(t);if(pick<0){chosen=t;break}}
  bag.push(chosen);prev=chosen.id;arr.splice(arr.indexOf(chosen),1);
 }
 return bag;
}
function nextTrack(){
 if(!tracks.length){$("player-status").textContent="The radio catalog isn't available yet.";return false}
 if(!deck.length)deck=randomDeck();
 const t=deck.shift();current=t;state.lastTrack=t.id;
 lastTime=null;
 audio.src=t.src;
 $("track-art").src=t.artwork;
 $("track-art").alt=t.album+" album artwork";
 $("on-dial-heading").textContent=t.title;
 $("track-album").textContent=t.artist+" · "+t.album;
 $("player-status").textContent="Ready. Press PLAY to hear "+t.title+".";
 persist();return true;
}
async function loadCatalog(){
 try{
  const response=await fetch(configUrl.href,{cache:"no-store"});
  if(!response.ok)throw Error("HTTP "+response.status);
  const data=await response.json();
  if(!Array.isArray(data.tracks)||!data.tracks.length)throw Error("Empty station catalog.");
  const albums=new Set((data.featured_rotation&&data.featured_rotation.albums)||[]);
  const singles=new Set((data.featured_rotation&&data.featured_rotation.singles)||[]);
  tracks=data.tracks.filter(function(t){return t&&t.id&&t.src&&t.title}).map(function(t){
    const src=new URL(t.src,configUrl.href),art=new URL(t.artwork||"../cover.jpg",configUrl.href);
    if(src.origin!==location.origin||art.origin!==location.origin)return null;
    return {id:t.id,src:src.href,artwork:art.href,title:t.title,artist:t.artist||"HUMKIN",album:t.album||"HUMKIN RADIO",featured:albums.has(t.album)||singles.has(t.id)};
  }).filter(Boolean);
  if(!tracks.length)throw Error("No playable station tracks.");
  deck=randomDeck();nextTrack();$("skip").disabled=false;
  $("player-status").textContent="The dial is ready · "+tracks.length+" real recordings.";
 }catch(e){$("player-status").textContent="The dial couldn't load. Use THE DIAL above for the main player.";}
}
function audioUI(){
 const playing=!audio.paused&&!audio.ended;
 $("toggle-radio").textContent=playing?"Ⅱ PAUSE THE ORCHARD MIX":"▶ PLAY THE ORCHARD MIX";
 $("scene").classList.toggle("spinning",playing);
 if(playing)$("player-status").textContent="ON THE DIAL · Actual playback is growing your little world.";
}
$("toggle-radio").addEventListener("click",async function(){
 if(trying)return;
 trying=true;
 try{
  if(!tracks.length)await loadCatalog();
  if(!audio.src&& !nextTrack())return;
  if(audio.paused){await audio.play()}else audio.pause();
  audioUI();
 }catch(e){$("player-status").textContent="Playback needs a tap or an available recording. "+safeText(e.message).slice(0,100)}
 finally{trying=false}
});
$("skip").addEventListener("click",async function(){
 const wasPlaying=!audio.paused;
 if(!nextTrack())return;
 if(wasPlaying){try{await audio.play()}catch{}}
 audioUI();
});
audio.addEventListener("play",audioUI);
audio.addEventListener("pause",audioUI);
audio.addEventListener("seeking",function(){lastTime=null});
audio.addEventListener("loadedmetadata",function(){lastTime=null});
audio.addEventListener("ended",async function(){if(nextTrack()){try{await audio.play()}catch{}}});
audio.addEventListener("error",function(){
 $("player-status").textContent="The record didn't load. Try the next one.";
});
let saveTicks=0;
audio.addEventListener("timeupdate",function(){
 if(audio.paused||audio.seeking||audio.readyState<2||!current)return;
 const now=audio.currentTime;
 if(!Number.isFinite(now))return;
 if(lastTime===null){lastTime=now;return}
 const elapsed=now-lastTime;lastTime=now;
 if(elapsed<=0||elapsed>5)return;
 const oldLevel=M.level(state.xp);
 const at=Date.now(),r=M.listen(state,elapsed,at);
 if(N)N.note(store,{at,seconds:elapsed,trackId:current.id,title:current.title,kind:"song",
   previousLevel:oldLevel,level:M.level(state.xp),find:r.discover?(M.item(r.discover.type)?.name||""):""});
 if(r.discover){
  const thing=M.item(r.discover.type);
  toast("A STRANGE FIND! "+(thing?thing.name:"Something unusual")+" appeared in your cabinet.");
  persist();render();
 }else if(oldLevel!==M.level(state.xp)){
  toast("ORCHARD LEVEL "+M.level(state.xp)+" · The room just grew.");
  persist();render();
 }else{
  summary();quest();
  if(++saveTicks%14===0)persist();
 }
});
function humanDay(){return new Date().toISOString().slice(0,10)}
function showReceipt(){
 const r=state.receipts[state.receipts.length-1];
 $("receipt-output").textContent=r?
   "LOCAL TASK RECEIPT\n"+r.id+"\n\nDAY "+r.day+"\nSONGS "+r.count+"\nSHA-256\n"+r.hash+"\n\nStored on this device · not signed by the server.":
   "NO LOCAL RECEIPTS YET";
}
async function runAudit(){
 if(M.level(state.xp)<4){toast("The Little Engine opens at level 4.");return}
 if(runPending)return;
 runPending=true;$("run-audit").disabled=true;
 const status=$("audit-status"),card=document.querySelector(".engine-card");
 card.classList.add("running");status.textContent="Checking whether this device can safely do a tiny task…";
 try{
   if(navigator.connection&&navigator.connection.saveData)throw Error("Data Saver is enabled. No task started.");
   if(typeof navigator.getBattery==="function"){
     const battery=await navigator.getBattery();
     if(!battery.charging&&battery.level<0.25)throw Error("Battery below 25%. Keeping the little engine off.");
   }
   if(!window.crypto||!crypto.subtle)throw Error("Secure-context SHA-256 isn't available on this device.");
   const ctrl=new AbortController(),timer=setTimeout(function(){ctrl.abort()},10000);
   let response;
   try{response=await fetch(configUrl.href,{cache:"no-store",signal:ctrl.signal})}
   finally{clearTimeout(timer)}
   if(!response.ok)throw Error("Station manifest unavailable.");
   const body=await response.text();
   if(body.length>100000)throw Error("Unexpected catalog size.");
   const data=JSON.parse(body);
   if(!Array.isArray(data.tracks)||data.tracks.length<1||data.tracks.length>1000)throw Error("Catalog schema out of range.");
   const ids=new Set();
   for(const t of data.tracks){
     if(typeof t.id!=="string"||!t.id||ids.has(t.id)||typeof t.title!=="string"||!t.title||
        typeof t.src!=="string"||new URL(t.src,configUrl.href).origin!==location.origin)
       throw Error("Duplicate, malformed, or off-site track in station manifest.");
     ids.add(t.id);
   }
   const bytes=new TextEncoder().encode(body);
   const digest=await crypto.subtle.digest("SHA-256",bytes);
   const hash=Array.from(new Uint8Array(digest),function(b){return b.toString(16).padStart(2,"0")}).join("");
   const reward=M.workReward(state,humanDay(),hash,ids.size,Date.now());
   if(reward.ok){persist();render();status.textContent=reward.message+" This proves local execution only.";toast("THE LITTLE ENGINE WORKED · "+ids.size+" catalog entries checked.")}
   else status.textContent=reward.message;
   showReceipt();
 }catch(e){status.textContent="WORK HELD · "+safeText(e.message).slice(0,140)}
 finally{runPending=false;card.classList.remove("running");unlocks()}
}
$("run-audit").addEventListener("click",runAudit);
$("view-receipt").addEventListener("click",showReceipt);
$("room-name").value=roomName;
$("room-name").addEventListener("change",function(){
 roomName=this.value.trim().slice(0,32)||"The Room With The Radio";this.value=roomName;
 try{store.setItem("humkin-orchard-room-name-v1",roomName)}catch{}
 toast("Your room's name is saved on this device.");
});
function b64utf8(str){const a=new TextEncoder().encode(str);let b="";a.forEach(function(x){b+=String.fromCharCode(x)});return btoa(b).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}
function fromB64(s){const binary=atob(s.replace(/-/g,"+").replace(/_/g,"/"));const a=Uint8Array.from(binary,function(c){return c.charCodeAt(0)});return new TextDecoder().decode(a)}
$("share-orchard").addEventListener("click",async function(){
 const snap={v:1,n:roomName,l:M.level(state.xp),g:M.stage(state),
  m:Math.floor(state.listenSeconds/60),o:state.inventory.map(function(u){return u.type}).slice(0,40)};
 const url=new URL(location.href);url.searchParams.set("visit",b64utf8(JSON.stringify(snap)));
 const msg="Come look at "+roomName+" · a little HUMKIN listening room.";
 try{
  if(navigator.share)await navigator.share({title:"HUMKIN ORCHARD",text:msg,url:url.href});
  else if(navigator.clipboard){await navigator.clipboard.writeText(url.href);toast("Read-only orchard visit link copied.");}
  else{prompt("Copy this visit link (not a trade):",url.href)}
 }catch(e){if(e.name!=="AbortError")toast("Couldn't share from this browser.")}
});
function showVisitor(){
 try{
  const value=new URL(location.href).searchParams.get("visit");
  if(!value||value.length>1800)return;
  const s=JSON.parse(fromB64(value));
  if(s.v!==1||typeof s.n!=="string"||!Number.isInteger(s.l)||s.l<1||s.l>500||!Array.isArray(s.o))return;
  const panel=make("aside","visitor-panel");
  panel.style.cssText="margin-top:23px;padding:18px;background:#fff5de;color:#281d34;border:2px solid #281d34;border-radius:12px;max-width:680px";
  panel.append(make("strong","","VISITING ANOTHER LITTLE ROOM · READ-ONLY"));
  panel.append(make("p","",s.n.slice(0,32)+" · level "+s.l+" · "+Math.min(40,s.o.length)+" remembered objects"));
  const icons=s.o.slice(0,14).map(function(type){const thing=M.item(type);return thing?thing.icon:"✳"}).join(" ");
  panel.append(make("p","",icons||"The cabinet hasn't got any objects yet."));
  panel.append(make("small","","This is a snapshot from a shareable URL, not a verified account, transfer, or live room."));
  document.querySelector(".title-card").append(panel);
 }catch{}
}
$("backup-save").addEventListener("click",function(){
 const data={schema:"humkin.orchard.backup/v1",roomName:roomName,state:state};
 const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
 const a=document.createElement("a"),url=URL.createObjectURL(blob);
 a.href=url;a.download="humkin-orchard-local-backup.json";a.click();
 setTimeout(function(){URL.revokeObjectURL(url)},3000);
 toast("Local backup downloaded. Keep it somewhere safe.");
});
$("backup-restore").addEventListener("change",async function(event){
 const file=event.target.files&&event.target.files[0];event.target.value="";
 if(!file)return;
 if(file.size>200000){toast("That backup file is unexpectedly large.");return}
 try{
  const parsed=JSON.parse(await file.text());
  if(parsed.schema!=="humkin.orchard.backup/v1"||parsed.state.version!==M.VERSION)throw Error("Not an Orchard 001 backup.");
  if(!confirm("Restore this backup? It REPLACES your current local orchard and collection on this device."))return;
  state=M.normalize(parsed.state,Date.now());
  roomName=(typeof parsed.roomName==="string"?parsed.roomName.slice(0,32):"The Room With The Radio");
  $("room-name").value=roomName;
  try{store.setItem("humkin-orchard-room-name-v1",roomName)}catch{}
  persist();render();showReceipt();toast("Backup restored locally.");
 }catch(e){toast("Backup couldn't be read: "+safeText(e.message).slice(0,90))}
});
window.addEventListener("beforeunload",persist);
window.addEventListener("storage",function(e){
 if(e.key===M.KEY){state=M.read(store);render()}
});
setInterval(function(){M.grow(state,Date.now());persist();summary();quest()},60000);
render();showReceipt();showVisitor();loadCatalog();
})();
