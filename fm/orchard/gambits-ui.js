/* Orchard Gambits user interface: local presets, level-gated editing and a
 * portable real three-song Signal. No authenticated station actions.
 */
(function(){
"use strict";
const G=window.HumkinGambits,M=window.HumkinOrchard,S=window.HumkinSignal;
if(!G||!M||!S)return;
const $=id=>document.getElementById(id);
const store=(()=>{try{return localStorage}catch{return null}})();
const level=M.level(M.read(store).xp);
const maxSlots=G.slotsForLevel(level);
const base=new URL("../rotation.json",location.href);
let catalog=[],rules=G.normalizeRules(null,level);
try{
  const draft=JSON.parse(store?.getItem(G.KEY)||"null");
  if(draft?.schema===G.SCHEMA)rules=G.normalizeRules(draft.rules,level);
}catch{}
function node(tag,content,cls){
  const e=document.createElement(tag);
  if(typeof content==="string")e.textContent=content;
  if(cls)e.className=cls;
  return e;
}
function status(message){$("gambit-status").textContent=message}
function save(){
  if(!maxSlots||!store)return;
  try{store.setItem(G.KEY,JSON.stringify({schema:G.SCHEMA,rules}));}
  catch{status("This browser cannot save Gambits; your changes will last until the page closes.")}
}
function setRules(next){rules=G.normalizeRules(next,level);save();renderRules();}
function renderRules(){
  const host=$("gambit-rules");host.replaceChildren();
  rules.forEach((rule,index)=>{
    const wrapper=node("div",undefined,"gambit-row");
    const num=node("span",String(index+1).padStart(2,"0"),"gambit-num");
    const controls=node("div",undefined,"gambit-controls");
    const conditional=node("label","WHEN (TARGET / CONDITION)");
    const when=node("select");
    when.setAttribute("aria-label","Condition for Gambit "+(index+1));
    for(const [value,text] of G.CONDITIONS){
      const option=node("option",text);option.value=value;when.append(option);
    }
    when.value=rule.when;
    when.disabled=!maxSlots;
    when.addEventListener("change",()=>{rules[index].when=when.value;save();});
    conditional.append(when);
    const directive=node("label","THEN (ACTION)");
    const action=node("select");
    action.setAttribute("aria-label","Action for Gambit "+(index+1));
    for(const [value,text] of G.ACTIONS){
      const option=node("option",text);option.value=value;action.append(option);
    }
    action.value=rule.action;
    action.disabled=!maxSlots;
    action.addEventListener("change",()=>{rules[index].action=action.value;save();});
    directive.append(action);
    const buttons=node("div",undefined,"gambit-row-buttons");
    const up=node("button","↑ PRIORITY"),down=node("button","↓ PRIORITY");
    up.type="button";down.type="button";
    up.disabled=!maxSlots||index===0;
    down.disabled=!maxSlots||index===rules.length-1;
    up.setAttribute("aria-label","Move Gambit "+(index+1)+" up");
    down.setAttribute("aria-label","Move Gambit "+(index+1)+" down");
    up.addEventListener("click",()=>{
      const array=rules.slice();[array[index-1],array[index]]=[array[index],array[index-1]];
      setRules(array);
    });
    down.addEventListener("click",()=>{
      const array=rules.slice();[array[index],array[index+1]]=[array[index+1],array[index]];
      setRules(array);
    });
    const enabled=node("label","ENABLED");
    const checkbox=node("input");
    checkbox.type="checkbox";checkbox.checked=rule.enabled;
    checkbox.disabled=!maxSlots;
    checkbox.addEventListener("change",()=>{rules[index].enabled=checkbox.checked;save();});
    enabled.prepend(checkbox);
    buttons.append(up,down,enabled);
    if(maxSlots){
      const remove=node("button","REMOVE");remove.type="button";
      remove.setAttribute("aria-label","Remove Gambit "+(index+1));
      remove.addEventListener("click",()=>setRules(rules.filter((_,i)=>i!==index)));
      buttons.append(remove);
    }
    controls.append(conditional,directive,buttons);
    wrapper.append(num,controls);host.append(wrapper);
  });
  $("gambit-add").disabled=!maxSlots||rules.length>=maxSlots;
  $("gambit-reset").disabled=!maxSlots;
  $("gambit-level").textContent=level<3
    ?"Orchard Level "+level+" · learning mode. Your personal rule editor opens at Level 3."
    :"Orchard Level "+level+" · "+rules.length+" / "+maxSlots+
      " editable Gambit slots. Local preview; no public broadcasting power.";
}
function renderStages(){
  const host=$("gambit-stages");host.replaceChildren();
  for(const stage of G.STAGES){
    const locallyUnlocked=stage.kind==="local"&&stage.level!==null&&level>=stage.level;
    const reviewStage=stage.kind==="local-and-reviewed"&&stage.level!==null&&level>=stage.level;
    const state=locallyUnlocked?"ready":reviewStage?"preview":"future";
    const card=node("li");card.dataset.state=state;
    const label=node("span",stage.kind==="server-authorized"?"REQUIRES STATION AUTHORIZATION":
      stage.kind==="server-verified"?"REQUIRES VERIFIED CONTRIBUTION":
      "LOCAL LEVEL "+stage.level,"meta");
    const heading=node("h3",stage.name);
    const body=node("p",stage.ability);
    card.append(label,heading,body);host.append(card);
  }
}
function availableRows(raw){
  const rows=G.safeCatalog(raw);
  return rows.filter(track=>{
    try{
      const url=new URL(track.src,base),original=raw.find(row=>row.id===track.id);
      const art=new URL(original?.artwork||"../cover.jpg",base);
      return url.origin===location.origin&&url.pathname.endsWith(".mp3")&&
        art.origin===location.origin;
    }catch{return false;}
  });
}
function makeSignal(result){
  const ids=result.tracks.map(t=>t.id);
  if(ids.length!==3||level<3)return null;
  return S.toUrl(new URL("../signal/",location.href),{
    version:1,name:"My Gambit Station",intro:"Three songs selected by my Orchard Gambit priorities.",
    mode:"across",tracks:ids
  },catalog);
}
function simulate(){
  $("gambit-signal").hidden=true;
  const host=$("gambit-program");host.replaceChildren();
  if(catalog.length<3){status("Three approved songs are needed to build a personal Signal.");return;}
  const result=G.propose(catalog,rules,{level,hour:new Date().getHours(),length:3,
    reads:{}});
  for(const [i,track] of result.tracks.entries()){
    const receipt=result.receipts[i];
    const item=node("li");
    const heading=node("strong",String(i+1).padStart(2,"0")+
      " · "+track.title);
    const subtitle=node("span",track.artist+" · "+(track.album||"HUMKIN RADIO"));
    const proof=node("small",receipt.ruleIndex<0?"SAFE CATALOG FALLBACK":
      "GAMBIT "+(receipt.ruleIndex+1)+" · "+receipt.detail);
    item.append(heading,subtitle,proof);host.append(item);
  }
  const link=makeSignal(result);
  if(link){$("gambit-signal").href=link;$("gambit-signal").hidden=false;}
  status(link?"Program ready. Your local Gambits produced a shareable personal Signal.":
    "Preview complete. Editable Gambits and a Signal link open at Orchard Level 3.");
}
$("gambit-add").addEventListener("click",()=>{
  if(!maxSlots||rules.length>=maxSlots)return;
  setRules(rules.concat({when:"always",action:"surprise",enabled:true}));
});
$("gambit-reset").addEventListener("click",()=>{
  if(!maxSlots)return;
  setRules(G.STARTER);
});
$("gambit-run").addEventListener("click",simulate);
renderRules();renderStages();
fetch(base,{cache:"no-store"}).then(response=>{
  if(!response.ok)throw Error("Catalog unavailable");
  return response.json();
}).then(data=>{
  catalog=availableRows(data.tracks);
  if(catalog.length<3)throw Error("Published rotation has fewer than three playable tracks.");
  status(catalog.length+" published recordings available. Press Build to run your Gambits.");
}).catch(()=>status("The published catalog isn't reachable. Reconnect and reload to try the workbench."));
})();
