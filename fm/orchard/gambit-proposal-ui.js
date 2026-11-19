/* Submit priority decks as review-only daily-program proposals.
 * Reuses the account-free Guild pass, but no Guild rewards or broadcast writes.
 */
(function(){
"use strict";
const P=window.HumkinDailyPrograms,G=window.HumkinGambits;
if(!P||!G)return;
const $=id=>document.getElementById(id);
const STORE=(()=>{try{return localStorage}catch{return null}})();
const API="https://kbhqacsdvjsstzyplqij.supabase.co/functions/v1/humkin-program-proposals";
const PASS="humkin-participation-pass-v1";
let listener="",sending=false;
try{
 listener=STORE?.getItem(PASS)||"";
 if(!/^[0-9a-f-]{36}$/i.test(listener)){
   listener=crypto.randomUUID();
   STORE?.setItem(PASS,listener);
 }
}catch{listener=crypto.randomUUID()}
const el=(tag,value)=>{
 const node=document.createElement(tag);
 if(value!==undefined)node.textContent=String(value);
 return node;
};
function message(value){$("program-submit-status").textContent=value}
function localDay(extraDays=0){
 const now=new Date(Date.now()+extraDays*86400000);
 const items=Object.fromEntries(new Intl.DateTimeFormat("en-US",{
   timeZone:"America/Chicago",month:"2-digit",day:"2-digit",year:"numeric"
 }).formatToParts(now).map(p=>[p.type,p.value]));
 return items.year+"-"+items.month+"-"+items.day;
}
$("program-day").value=localDay(1);
$("program-day").min=localDay(0);
function currentDeck(){
 try{
  const raw=JSON.parse(STORE?.getItem(G.KEY)||"null");
  if(raw?.schema===G.SCHEMA&&Array.isArray(raw.rules)&&raw.rules.length)
   return raw.rules;
 }catch{}
 return G.STARTER;
}
function renderDeck(){
 const rules=currentDeck();
 $("program-deck").textContent=rules.map((r,i)=>
  String(i+1)+". "+(r.enabled?"ON":"OFF")+" · "+r.when+" → "+r.action).join("\n");
}
async function api(method,params="",body){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),20000);
 try{
  const r=await fetch(API+params,{method,cache:"no-store",signal:ctrl.signal,
    headers:{"Accept":"application/json",...(body?{"Content-Type":"application/json"}:{})},
    ...(body?{body:JSON.stringify(body)}:{})});
  const payload=await r.json();
  if(!r.ok||payload.error)throw Error(payload.error||"Submission unavailable");
  return payload;
 }finally{clearTimeout(timer)}
}
async function receipts(){
 const board=$("program-receipts");
 try{
  const result=await api("GET","?mode=mine&listener="+encodeURIComponent(listener));
  board.replaceChildren();
  if(!result.items?.length){
    board.append(el("p","No programming proposals on this participation pass."));return;
  }
  for(const item of result.items){
    const article=el("article");
    article.className="gambit-row";
    const number=el("span",item.state.toUpperCase());number.className="gambit-num";
    const body=el("div");
    const title=el("strong",item.title);
    const desc=el("p",item.day+" at "+item.start_local+" Central · "+item.duration_minutes+
      " minutes · "+item.station_id);
    const state=el("small",item.review_note||(
      item.state==="approved"?"Editorially approved. Publication is a separate operator action.":
      "No airtime granted; awaiting editorial review."));
    body.append(title,desc,state);
    if(item.state==="pending_review"){
      const button=el("button","WITHDRAW");
      button.type="button";button.className="secondary";
      button.addEventListener("click",async()=>{
        if(!confirm("Withdraw this programming proposal?"))return;
        try{
          await api("POST","",{action:"withdraw",id:item.id,listener});
          message("Proposal withdrawn.");await receipts();
        }catch(e){message(e.message)}
      });
      body.append(button);
    }
    article.append(number,body);
    board.append(article);
  }
 }catch(e){board.textContent="Private programming receipts unavailable: "+e.message}
}
$("program-deck-refresh").addEventListener("click",renderDeck);
$("program-form").addEventListener("submit",async event=>{
 event.preventDefault();
 if(sending)return;
 try{
  renderDeck();
  const proposal=P.proposed({
    title:$("program-title-input").value,station_id:"station-one",
    day:$("program-day").value,time:$("program-time").value,
    minutes:Number($("program-length").value),
    rules:currentDeck(),note:$("program-note").value
  });
  if(!$("program-confirm").checked)throw Error("Confirm this is a programming proposal for review");
  sending=true;$("program-send").disabled=true;
  message("Sending a programming proposal to the private editorial queue…");
  const result=await api("POST","",{action:"submit",listener,proposal});
  message("Submitted. Receipt "+result.id+". Nothing was broadcast or awarded.");
  $("program-confirm").checked=false;
  await receipts();
 }catch(e){message(e.message||"Submission failed");}
 finally{sending=false;$("program-send").disabled=false;}
});
$("program-refresh").addEventListener("click",receipts);
renderDeck();
receipts();
})();
