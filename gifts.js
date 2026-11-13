(()=>{"use strict";
const player=window.HUMKIN_PLAYER;
if(!player)return;
const tracks=player.tracks;
const byId=id=>document.getElementById(id);
const selects=["mix-one","mix-two","mix-three"].map(byId);
const note=byId("mix-message"),palette=byId("mix-palette"),artPicker=byId("mix-art");
const feedback=byId("mix-status");
const preview=byId("mix-preview");

const colors=["sun","rose","sky"];
const defaults=[1,5,9];
let publishedArt=[{id:"mutant-pop",title:"Mutant Pop · The First Room",src:"cover.jpg",alt:"MUTANT POP manga couple album cover."}];
function selectArt(id){return publishedArt.find(a=>a.id===id)||publishedArt[0]}
function drawArt(targetPrefix,id){
  const wrap=byId(targetPrefix+"-art-wrap"),img=byId(targetPrefix+"-art");
  if(id==="none"){wrap.hidden=true;return}
  const chosen=selectArt(id);
  wrap.hidden=false;
  img.src=new URL(chosen.src,document.baseURI).href;
  img.alt=chosen.alt||chosen.title;
}
function fillArtPicker(){
  const selected=artPicker.value;
  artPicker.replaceChildren();
  for(const art of publishedArt){const option=document.createElement("option");option.value=art.id;option.textContent=art.title.toUpperCase();artPicker.append(option)}
  const noArt=document.createElement("option");noArt.value="none";noArt.textContent="PAPER ONLY";artPicker.append(noArt);
  artPicker.value=publishedArt.some(a=>a.id===selected)||selected==="none"?selected:"mutant-pop";
  update();
}
async function loadArtLibrary(){
  try{
    const response=await fetch("./postcards.json",{cache:"no-store"});
    if(!response.ok)throw Error("Art catalog unavailable");
    const data=await response.json();
    if(!Array.isArray(data.published)||!data.published.length)throw Error("No published art");
    const safe=data.published.filter(a=>a&&/^[a-z0-9-]+$/.test(a.id)&&typeof a.title==="string"&&typeof a.src==="string"&&/^(?:cover\.jpg|postcards\/[a-z0-9-]+\.(?:jpg|png|webp))$/.test(a.src)).map(a=>({id:a.id,title:a.title,src:a.src,alt:typeof a.alt==="string"?a.alt:"HUMKIN manga postcard art"}));
    if(!safe.find(a=>a.id==="mutant-pop"))safe.unshift(publishedArt[0]);
    publishedArt=safe;
    fillArtPicker();
    if(giftIds)drawArt("received",params.get("art")||"mutant-pop");
  }catch{fillArtPicker()}
}

const trackByNumber=n=>tracks.find(t=>t.number===n);
const label=n=>trackByNumber(n)?.title||"Unknown song";
function parseMix(value){
  if(typeof value!=="string"||!/^(?:0?[1-9]|1[0-2])(?:[.,-](?:0?[1-9]|1[0-2])){2}$/.test(value))return null;
  const numbers=value.split(/[.,-]/).map(Number);
  return new Set(numbers).size===3?numbers:null;
}
function chosen(){
  const ids=selects.map(s=>Number(s.value));
  if(ids.some(n=>!Number.isInteger(n)||n<1||n>12)||new Set(ids).size!==3)return null;
  return ids;
}
function paint(element,theme){colors.forEach(c=>element.classList.toggle("color-"+c,c===theme))}
function renderSongs(target,ids){
  target.replaceChildren();
  ids.forEach((n,i)=>{const item=document.createElement("li");const number=document.createElement("span");number.textContent=String(i+1).padStart(2,"0");const title=document.createElement("strong");title.textContent=label(n);item.append(number,title);target.append(item)});
}
function report(message,error=false){feedback.textContent=message;feedback.dataset.kind=error?"error":"success"}
function update(){
  const ids=chosen();const theme=palette.value;
  paint(preview,colors.includes(theme)?theme:"sun");
  drawArt("mix-preview",artPicker.value||"mutant-pop");
  byId("mix-preview-message").textContent=note.value.trim()||"Three songs. One little something, just for you.";
  if(ids){renderSongs(byId("mix-preview-tracks"),ids);feedback.textContent=""}else{feedback.textContent="Choose three different songs to make your postcard.";feedback.dataset.kind="error"}
}
function postcardLink(){
  const ids=chosen();
  if(!ids){report("Choose three different songs first.",true);return null}
  const url=new URL(location.pathname,location.origin);
  url.searchParams.set("mix",ids.join("."));
  if(note.value.trim())url.searchParams.set("note",note.value.trim().slice(0,160));
  url.searchParams.set("card",colors.includes(palette.value)?palette.value:"sun");
  if(artPicker.value&&artPicker.value!=="mutant-pop")url.searchParams.set("art",artPicker.value);
  return url.href;
}
async function copyLink(link){
  try{
    if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(link);report("Postcard link copied. Send it to someone. ✳");return}
  }catch{}
  const field=byId("mix-link-fallback");field.value=link;field.hidden=false;field.focus();field.select();
  try{if(document.execCommand("copy")){report("Postcard link copied. Send it to someone. ✳");return}}catch{}
  report("Copy the selected link below and send it to someone.");
}
selects.forEach((select,i)=>{
  tracks.forEach(t=>{const opt=document.createElement("option");opt.value=String(t.number);opt.textContent=String(t.number).padStart(2,"0")+" · "+t.title;select.append(opt)});
  select.value=String(defaults[i]);
  select.addEventListener("change",update);
});
note.addEventListener("input",update);palette.addEventListener("change",update);artPicker.addEventListener("change",update);
byId("mix-play").addEventListener("click",()=>{const ids=chosen();if(ids){player.playMixtape(ids);report("Your three-song mixtape is playing.")}else report("Choose three different songs first.",true)});
byId("mix-copy").addEventListener("click",()=>{const url=postcardLink();if(url)copyLink(url)});
byId("mix-share").addEventListener("click",async()=>{
  const url=postcardLink();if(!url)return;
  if(navigator.share){
    try{await navigator.share({title:"A little HUMKIN postcard",text:"Three songs, selected just for you. ✳",url});report("Postcard ready to send.");return}
    catch(err){if(err?.name==="AbortError")return}
  }
  copyLink(url);
});
// Twelve emoji buttons correspond exactly to the album's track list.
const jukeButtons=Array.from(document.querySelectorAll("[data-juke]"));
function markJukebox(number){
  for(const button of jukeButtons){
    const selected=Number(button.dataset.juke)===number;
    button.classList.toggle("is-selected",selected);
    button.setAttribute("aria-pressed",String(selected));
  }
}
for(const button of jukeButtons){
  const number=Number(button.dataset.juke);
  button.addEventListener("click",()=>{
    player.playTrack(number);
    markJukebox(number);
  });
}
window.addEventListener("humkin:trackchange",event=>markJukebox(event.detail?.number));
markJukebox(player.currentTrack||1);
const params=new URL(location.href).searchParams;
const giftIds=parseMix(params.get("mix"));
if(giftIds){
  const receiver=byId("received-postcard"),theme=colors.includes(params.get("card"))?params.get("card"):"sun";
  paint(receiver,theme);
  drawArt("received",params.get("art")||"mutant-pop");
  const message=(params.get("note")||"").trim().slice(0,160);
  byId("received-message").textContent=message||"Someone picked three songs and thought you might like them.";
  renderSongs(byId("received-tracks"),giftIds);
  receiver.hidden=false;
  byId("received-play").addEventListener("click",()=>{player.playMixtape(giftIds);byId("received-status").textContent="Playing your three songs. ✳"});
  byId("received-remix").addEventListener("click",()=>{
    selects.forEach((s,i)=>s.value=String(giftIds[i]));
    note.value=message;palette.value=theme;artPicker.value=params.get("art")||"mutant-pop";update();byId("mix-one").focus();
  });
  // A received postcard is never allowed to autoplay.
}
update();
loadArtLibrary();
})();