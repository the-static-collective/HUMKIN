/* SAVE THE HOUR 001: render real music choices; never touch broadcast APIs. */
(function(){
"use strict";
const G=window.HumkinGambits,H=window.HumkinSaveTheHour,S=window.HumkinSignal;
if(!G||!H||!S)return;
const $=id=>document.getElementById(id);
const config=new URL("../rotation.json",location.href);
const store=(()=>{try{return localStorage}catch{return null}})();
const GLYPHS={record:"◉",gear:"⌁",gambit:"↣",crew:"✳",weather:"☼",relic:"✦"};
let rows=[],state=null,counts={};
function node(tag,text,cls){const el=document.createElement(tag);if(text!=null)el.textContent=text;if(cls)el.className=cls;return el;}
function say(text){$("game-status").textContent=text;}
function dayCentral(){
 try{
   const parts=Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:"America/Chicago",
     year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).filter(p=>p.type!=="literal").map(p=>[p.type,p.value]));
   return parts.year+"-"+parts.month+"-"+parts.day;
 }catch{return new Date().toISOString().slice(0,10);}
}
function readCounts(){
 try{const p=JSON.parse(store?.getItem(H.COUNTS_KEY)||"{}");
   if(p&&typeof p==="object"&&!Array.isArray(p))return p;
 }catch{}
 return {};
}
function persist(){
 if(!store||!state)return;
 try{store.setItem(H.KEY,JSON.stringify(state));}catch{say("This browser cannot save the hand; it lasts until the page is closed.");}
}
function published(raw){
 return G.safeCatalog(raw).filter(t=>{
   try{
     const link=new URL(t.src,config);
     return link.origin===location.origin&&link.pathname.toLowerCase().endsWith(".mp3");
   }catch{return false;}
 });
}
function finishOnce(){
 if(!state||state.counted||!H.evaluate(state,rows).complete)return;
 // Entirely local rehearsal counts; not actual plays or chart metrics.
 const next={...counts};
 for(const p of state.played){const n=Number(next[p.trackId]);next[p.trackId]=
   Number.isSafeInteger(n)&&n>=0?Math.min(1000000,n+1):1;}
 counts=next;state={...state,counted:true};
 try{store?.setItem(H.COUNTS_KEY,JSON.stringify(counts));}catch{}
 persist();
}
function render(){
 if(!state)return;
 const result=H.evaluate(state,rows),used=new Set(state.played.map(p=>p.cardId));
 const condition=$("game-condition");condition.replaceChildren();
 condition.append(node("h3",result.condition.name),
   node("p",result.condition.description),
   node("p","Goal: "+result.objective,"hour-small"));
 $("game-progress").textContent=state.played.length+" / 3 plays";
 const hand=$("game-hand");hand.replaceChildren();
 for(const id of state.hand){
   const card=H.CARDS.find(c=>c.id===id),button=node("button",undefined,"hour-card");
   button.type="button";button.dataset.family=card.family;
   const already=used.has(id);
   if(already)button.classList.add("used");
   button.disabled=already||result.complete;
   button.setAttribute("aria-label",(already?"Played ":"Play ")+card.name+", "+card.action);
   button.append(node("span",card.family+" · "+card.id,"card-type"),
     node("span",GLYPHS[card.family],"card-medallion"),
     node("strong",card.name),node("span",card.description,"card-description"),
     node("span",card.action.toUpperCase(),"card-action"));
   button.addEventListener("click",()=>choose(id));
   hand.append(button);
 }
 const slots=$("game-plays");slots.replaceChildren();
 for(let i=0;i<3;i++){
   const p=state.played[i],li=node("li");
   if(!p){li.className="empty";li.textContent="Slot "+(i+1)+" · waiting for a card";}
   else{
     const t=rows.find(x=>x.id===p.trackId),card=H.CARDS.find(c=>c.id===p.cardId);
     li.append(node("strong",(i+1)+". "+(t?.title||"Unavailable recording")),
       node("small",(t?.artist||"")+" · "+(t?.album||"")+" · "+card.name),
       node("small",p.explanation));
   }slots.append(li);
 }
 $("game-score").textContent="Practice score "+result.score;
 $("game-copy").hidden=!result.complete;
 $("game-signal").hidden=true;
 if(result.complete){
   try{
     const url=S.toUrl(new URL("../signal/",location.href),{
       version:1,name:"Save the Hour · "+result.condition.name,
       intro:"Three songs from my local HUMKIN card game, not a broadcast.",
       mode:"across",tracks:state.played.map(p=>p.trackId)
     },rows);
     $("game-signal").href=url;$("game-signal").hidden=false;
   }catch{say("The public Signal couldn't be assembled from this catalog.");}
   say(result.won?"STATION RESCUED. Your personal three-song Signal is ready.":
     "Three recordings chosen. Challenge not met; your personal Signal is still playable.");
 }else{say("Choose "+(3-state.played.length)+" more "+(3-state.played.length===1?"card":"cards")+" to finish your set.");}
 $("game-reset").disabled=false;
}
function choose(id){
 if(!state)return;
 try{
   state=H.play(state,id,rows,counts);persist();finishOnce();render();
 }catch(err){say("Card not played: "+err.message);}
}
function newHand(){
 if(rows.length<3)return;
 const round=state?.day===dayCentral()?Math.min(9999,state.round+1):0;
 state=H.start(rows,dayCentral(),round);persist();render();
}
function restore(){
 const day=dayCentral();
 try{
   const saved=JSON.parse(store?.getItem(H.KEY)||"null");
   if(saved?.version===H.VERSION&&saved.day===day&&Number.isInteger(saved.round)
     &&Array.isArray(saved.played)&&saved.played.length<=3){
     const canonical=H.start(rows,day,saved.round);
     if(JSON.stringify(saved.hand)===JSON.stringify(canonical.hand)&&
       saved.conditionId===canonical.conditionId&&
       saved.played.every(p=>p&&canonical.hand.includes(p.cardId)&&rows.some(t=>t.id===p.trackId))&&
       new Set(saved.played.map(p=>p.cardId)).size===saved.played.length&&
       new Set(saved.played.map(p=>p.trackId)).size===saved.played.length){
       state=saved;return;
     }
   }
 }catch{}
 state=H.start(rows,day,0);persist();
}
$("game-reset").addEventListener("click",newHand);
$("game-copy").addEventListener("click",async()=>{
 try{
  const receipt=H.receipt(state,rows);
  if(!navigator.clipboard?.writeText)throw Error("Clipboard unavailable");
  await navigator.clipboard.writeText(JSON.stringify(receipt,null,2));
  say("Copied local practice receipt. This is not an official broadcast or collectible.");
 }catch{say("Copy unavailable in this browser. Your personal Signal link remains usable.");}
});
fetch(config,{cache:"no-store"}).then(r=>{
 if(!r.ok)throw Error("Catalog unavailable");return r.json();
}).then(body=>{
 rows=published(body.tracks);
 if(rows.length<3)throw Error("At least three playable published songs are required.");
 counts=readCounts();restore();finishOnce();render();
}).catch(err=>{
 say("Unable to start: "+err.message+". Reconnect and reload.");
 $("game-hand").textContent="The published radio rotation is not available.";
 $("game-plays").textContent="No game hand has been dealt.";
});
})();
