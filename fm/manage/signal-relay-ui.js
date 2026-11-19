/* Owner-facing Compost -> editable paused show bridge.
 * Reads only the existing public Compost API. All editorial effects stay
 * behind Station Manager's established owner auth and show-save controls.
 */
import {rankCandidates,compostLink,proposalReceipt} from "./signal-relay-model.mjs";

const ENDPOINT="https://kbhqacsdvjsstzyplqij.supabase.co/functions/v1/humkin-compost";
const KEY="humkin.signal-relay.proposals/v1";
const $=id=>document.getElementById(id);
let cache=null,cacheAt=0,sequence=0;

function item(tag,text,cls){
  const element=document.createElement(tag);
  if(text!==undefined)element.textContent=String(text);
  if(cls)element.className=cls;
  return element;
}
function button(label,action,cls="secondary"){
  const element=item("button",label,cls);
  element.type="button";element.addEventListener("click",action);
  return element;
}
function readReceipts(){
  try{
    const data=JSON.parse(localStorage.getItem(KEY)||"[]");
    return Array.isArray(data)?data.filter(x=>x?.schema==="humkin.signal-relay.proposal/v1").slice(-200):[];
  }catch{return [];}
}
function remember(receipt){
  try{
    const next=[...readReceipts(),receipt].slice(-200);
    localStorage.setItem(KEY,JSON.stringify(next));
    return true;
  }catch{return false;}
}
function exportReceipts(){
  const receipts=readReceipts();
  if(!receipts.length){$("signal-relay-status").textContent="No local editorial receipts to export yet.";return;}
  const blob=new Blob([JSON.stringify({schema:"humkin.signal-relay.export/v1",proposals:receipts},null,2)+"\n"],
    {type:"application/json"});
  const url=URL.createObjectURL(blob);
  const link=item("a");link.href=url;link.download="humkin-signal-relay-proposals.json";
  link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  $("signal-relay-status").textContent="Exported proposal history; this does not publish station programming.";
}
async function publicSignals(){
  if(cache&&Date.now()-cacheAt<60000)return cache;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  try{
    const response=await fetch(ENDPOINT,{signal:controller.signal,cache:"no-store"});
    if(!response.ok)throw Error("Compost service returned HTTP "+response.status);
    const data=await response.json();
    if(!Array.isArray(data.tracks)||!Array.isArray(data.scores))
      throw Error("Compost returned an incomplete public catalog.");
    cache=data;cacheAt=Date.now();
    return data;
  }finally{clearTimeout(timer);}
}
export async function mountSignalRelay({library,preparePausedShow}){
  const container=$("signal-relay-results"),status=$("signal-relay-status");
  if(!container||!status)return;
  const run=++sequence;
  status.textContent="Reading public Compost listener signals…";
  container.replaceChildren();
  try{
    const data=await publicSignals();
    if(run!==sequence)return;
    const rows=rankCandidates(data.tracks,data.scores,library,20);
    if(!rows.length){
      status.textContent="No matching, published and enabled songs were available in both catalogs. No proposal was made.";
      return;
    }
    status.textContent=rows.length+" candidates. About 70% of places prioritize the least heard; up to 30% are reserved for reaction-supported contenders. None are on air because of this screen.";
    for(const row of rows){
      const card=item("article",undefined,"show");
      card.append(item("h3",row.title+" · "+row.artist));
      card.append(item("small",row.album+" · "+row.lane+" · "+row.plays+" recorded listens · "+row.ratings+
        " ratings · "+row.dance+" dance responses"));
      card.append(item("p",row.reason+" Ratings are pseudonymous and can be manipulated; these are proposals, not verified popularity."));
      const actions=item("div",undefined,"row");
      const link=item("a","LISTEN / SHARE EXACT RECORDING ↗","button secondary");
      link.href=compostLink(location.href,row.id);
      link.target="_blank";link.rel="noopener noreferrer";
      actions.append(link);
      actions.append(button("LOAD PAUSED SHOW DRAFT",()=>{
        preparePausedShow(row);
        const saved=remember(proposalReceipt(row,"opened_paused_editor"));
        status.textContent="Opened an inactive show draft for "+row.title+". Review its times and track list, then explicitly SAVE. "+
          (saved?"A browser-local proposal receipt was recorded.":"Local receipt storage is unavailable.");
      },"primary"));
      actions.append(button("SAVE PROPOSAL NOTE",()=>{
        const saved=remember(proposalReceipt(row,"saved_proposal"));
        status.textContent=saved?"Saved a local proposal note; station programming has not changed.":
          "Local storage is unavailable. Station programming has not changed.";
      }));
      card.append(actions);container.append(card);
    }
  }catch(error){
    if(run!==sequence)return;
    status.textContent="Compost signals are unavailable: "+(error.name==="AbortError"?"request timed out.":error.message);
  }
}
export function installSignalRelayActions(){
  $("signal-relay-export")?.addEventListener("click",exportReceipts);
  $("signal-relay-reload")?.addEventListener("click",()=>{cache=null;cacheAt=0;$("refresh").click();});
}
