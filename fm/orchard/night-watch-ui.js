/* Night Watch ticket: compact, local-only, and optional. */
(function(){
"use strict";
const N=window.HumkinNightWatch,mount=document.getElementById("nightwatch-mount");
if(!N||!mount)return;
const store=(()=>{try{return localStorage}catch{return null}})();
if(!store)return;
function el(tag,cls,label){
 const node=document.createElement(tag);
 if(cls)node.className=cls;
 if(label!==undefined)node.textContent=String(label);
 return node;
}
const section=el("section","night-watch-ticket");
const head=el("div","night-watch-head"),label=el("div","");
label.append(el("small","night-watch-eyebrow","DEPARTMENT OF THE NIGHT WATCH"));
const title=el("h3","","WHAT THE DIAL REMEMBERS.");
label.append(title);
const toggle=el("button","night-watch-toggle","NO REPORT YET");
toggle.type="button";toggle.disabled=true;toggle.setAttribute("aria-expanded","false");
head.append(label,toggle);section.append(head);
const hint=el("p","night-watch-hint","A report appears after 30 quiet minutes. Only observed playback counts.");
const content=el("div","night-watch-report");
content.hidden=true;
section.append(hint,content);mount.append(section);
let selected=null;
function drawReport(watch){
 content.replaceChildren();
 const s=N.stats(watch);
 const date=new Date(watch.startedAt).toLocaleString(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
 content.append(el("p","night-watch-date","WATCH BEGAN · "+date));
 const counts=el("div","night-watch-counts");
 for(const [num,name] of [[s.minutes,"ACTUAL MINUTES"],[s.songCount,"RECORDINGS HEARD"],[s.firstCount,"FIRST LOGGED HERE"]]){
  const box=el("div","");box.append(el("strong","",num),el("small","",name));counts.append(box);
 }
 content.append(counts);
 const lines=[];
 if(s.bumperCount)lines.push(s.bumperCount+" station drop"+(s.bumperCount===1?"":"s")+" heard.");
 if(s.levels.length)lines.push("Your Outpost reached level "+s.levels.join(", ")+".");
 if(s.finds.length)lines.push("Strange finds: "+s.finds.join(", ")+".");
 if(!lines.length)lines.push("Nothing peculiar reported. The records still played.");
 for(const line of lines)content.append(el("p","night-watch-detail",line));
 content.append(el("small","night-watch-note","Recorded on this device from actual audio progress. Not a record of anything Android may have suspended."));
}
function update(){
 const state=N.read(store),watch=N.latestCompleted(state,Date.now());
 if(!watch){
  toggle.disabled=true;toggle.textContent="REPORT NOT READY";
  hint.textContent="Leave the radio playing. A watch closes after 30 minutes without observed playback.";
  content.hidden=true;selected=null;toggle.setAttribute("aria-expanded","false");
  return;
 }
 toggle.disabled=false;
 const s=N.stats(watch),unread=state.readReportId!==watch.id;
 hint.textContent=s.minutes+" logged minutes · "+s.songCount+" recordings heard · "+(unread?"unopened watch":"last completed watch");
 toggle.textContent=unread?"✳ OPEN NEW REPORT":content.hidden?"VIEW LAST REPORT":"CLOSE REPORT";
 if(selected!==watch.id&&!content.hidden){content.hidden=true;toggle.setAttribute("aria-expanded","false")}
 selected=watch.id;
 if(!content.hidden)drawReport(watch);
}
toggle.addEventListener("click",function(){
 const watch=N.latestCompleted(N.read(store),Date.now());
 if(!watch)return;
 if(content.hidden){drawReport(watch);content.hidden=false;N.acknowledge(store,watch.id);toggle.setAttribute("aria-expanded","true")}
 else{content.hidden=true;toggle.setAttribute("aria-expanded","false")}
 update();
});
window.addEventListener("storage",update);
window.addEventListener("pageshow",update);
document.addEventListener("visibilitychange",function(){if(!document.hidden)update()});
setInterval(update,60000);update();
})();
