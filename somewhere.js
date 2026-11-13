(()=>{"use strict";
const $=id=>document.getElementById(id);
const home=new URL("./",document.baseURI);
const rooms=Object.freeze({
  coffee:{title:"COFFEE / SLOW MORNING",songs:[2,1,10]},
  work:{title:"MAKING / WORKING",songs:[4,8,7]},
  gym:{title:"MOVING / ENERGY",songs:[3,6,12]},
  table:{title:"TABLE / COMPANY",songs:[5,7,9]},
  night:{title:"QUIET / LATE NIGHT",songs:[11,6,10]}
});
const validId=n=>Number.isInteger(n)&&n>=1&&n<=12;
const pad=n=>String(n).padStart(2,"0");
const getRoom=k=>Object.prototype.hasOwnProperty.call(rooms,k)?k:"coffee";
const pickMix=()=>Array.from({length:12},(_,i)=>i+1).sort(()=>Math.random()-.5).slice(0,3);
let tracks=[],roomKey=getRoom(new URL(location.href).searchParams.get("room")),roomCursor=0,mode="mix",seedLink="",artCatalog=[{id:"mutant-pop",src:"cover.jpg"}];
const roomAudio=$("room-audio");
const roomStatus=s=>{$("room-status").textContent=s};
function roomSongs(){return rooms[roomKey].songs}
function track(n){return tracks[n-1]}
function mp3(n){return new URL(track(n).url,home).href}
function songLabel(n){return track(n)?.title||"Song "+pad(n)}
function makeTextButton(text,fn){const b=document.createElement("button");b.type="button";b.textContent=text;b.addEventListener("click",fn);return b}
function selectRoom(key){
  roomKey=getRoom(key);roomCursor=0;
  roomAudio.pause();
  $("room-name").textContent=rooms[roomKey].title;
  document.querySelectorAll("[data-room]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.room===roomKey)));
  const ol=$("room-tracks");ol.replaceChildren();
  roomSongs().forEach((n,i)=>{
    const li=document.createElement("li");
    const button=makeTextButton(songLabel(n),()=>selectSong(i,true));
    li.append(button);ol.append(li);
  });
  if(tracks.length){selectSong(0,false);$("room-play").disabled=false;$("room-copy").disabled=false;$("room-next").disabled=false;roomStatus("Ready. Choose play to hear this room.");}
  else roomStatus("Loading the record…");
  refreshEmbed();
  refreshCreatorMail();
}
function selectSong(i,play){
  roomCursor=i;const n=roomSongs()[i];if(!track(n))return;
  roomAudio.src=mp3(n);roomAudio.load();
  $("room-save").href=mp3(n);$("room-save").download="HUMKIN - "+songLabel(n)+".mp3";$("room-save").hidden=false;
  Array.from($("room-tracks").children).forEach((li,j)=>li.classList.toggle("is-current",i===j));
  if(play)roomAudio.play().then(()=>roomStatus("Playing "+songLabel(n)+".")).catch(()=>roomStatus("Could not start playback. Try the individual song on the main record."));
}
function nextSong(){
  const i=roomCursor+1;
  if(i>=roomSongs().length){roomAudio.pause();roomStatus("That's the whole little room. Choose play to hear it again.");return}
  selectSong(i,true);
}
async function copyText(value,field){
  try{
    if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(value);return true}
  }catch{}
  if(field){field.focus();field.select();try{if(document.execCommand("copy"))return true}catch{}}
  return false;
}
function roomLink(){
  const link=new URL("somewhere.html",home);link.searchParams.set("room",roomKey);return link.href;
}
function embedURL(){
  const url=new URL("embed.html",home);
  if(mode==="mix")url.searchParams.set("mix",roomSongs().map(pad).join("."));
  if(mode==="one")url.searchParams.set("track",pad(roomSongs()[roomCursor]));
  if(mode==="all")url.searchParams.set("all","1");
  return url;
}
function refreshEmbed(){
  const src=embedURL().href;
  $("embed-code").value='<iframe title="Listen to HUMKIN" src="'+src+'" width="100%" height="315" loading="lazy" referrerpolicy="no-referrer" style="border:0;border-radius:12px" ></iframe>';
  if($("embed-preview").src!==src)$("embed-preview").src=src;
  $("embed-direct").href=src;
}
function refreshCreatorMail(){
  const body="Hello HUMKIN!\n\nMy project is:\n\nWhere it will appear:\n\nNonprofit / personal / commercial:\n\nTracks I'm interested in: "+roomSongs().map(songLabel).join(", ")+"\n\nAnything else:\n";
  $("creator-mail").href="mailto:us@abundent.org?subject="+encodeURIComponent("HUMKIN music use request")+"&body="+encodeURIComponent(body);
}
function randomArt(){
  return artCatalog[Math.floor(Math.random()*artCatalog.length)]||artCatalog[0];
}
function makeSeed(){
  if(tracks.length!==12){$("seed-status").textContent="The track catalog isn't loaded. Try again after refreshing.";return}
  const ids=pickMix(),art=randomArt();
  const url=new URL("./",home);
  url.searchParams.set("mix",ids.map(pad).join("."));
  url.searchParams.set("card",["sun","rose","sky"][Math.floor(Math.random()*3)]);
  url.searchParams.set("art",art.id);
  seedLink=url.href;$("seed-link").value=seedLink;$("seed-share").disabled=false;
  $("seed-art").src=new URL(art.src,home).href;
  const ol=$("seed-tracks");ol.replaceChildren();
  ids.forEach(n=>{const li=document.createElement("li");li.textContent=songLabel(n);ol.append(li)});
  $("seed-status").textContent="A new postcard is ready. Send it as-is or make another.";
}
async function shareSeed(){
  if(!seedLink)return;
  if(navigator.share){
    try{await navigator.share({title:"A little HUMKIN postcard",text:"Three whole songs, for you.",url:seedLink});$("seed-status").textContent="The postcard is ready to travel.";return}
    catch(e){if(e?.name==="AbortError")return}
  }
  const copied=await copyText(seedLink,$("seed-link"));
  $("seed-status").textContent=copied?"Postcard link copied. Send it along.":"Select and copy the link above to send it.";
}
document.querySelectorAll("[data-room]").forEach(b=>b.addEventListener("click",()=>selectRoom(b.dataset.room)));
document.querySelectorAll("[data-embed]").forEach(b=>b.addEventListener("click",()=>{
  mode=b.dataset.embed;
  document.querySelectorAll("[data-embed]").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));
  refreshEmbed();
}));
$("room-play").addEventListener("click",()=>selectSong(0,true));
$("room-next").addEventListener("click",nextSong);
roomAudio.addEventListener("ended",nextSong);
roomAudio.addEventListener("error",()=>{if(tracks.length)roomStatus("Audio unavailable. Please try another song or the main album page.")});
$("room-copy").addEventListener("click",async()=>{
  const link=roomLink();
  const ok=await copyText(link,null);
  roomStatus(ok?"Listening-room link copied.":"Copy and share this room's URL: "+link);
});
$("embed-copy").addEventListener("click",async()=>{
  const ok=await copyText($("embed-code").value,$("embed-code"));
  $("embed-status").textContent=ok?"Player HTML copied. Paste it into your site's embed / custom HTML block.":"Select and copy the player HTML above.";
});
$("seed-make").addEventListener("click",makeSeed);
$("seed-share").addEventListener("click",shareSeed);
window.HUMKIN_STATION=Object.freeze({getRoom,rooms,roomLink,pickMix,embedURL,makeSeed});
(async()=>{
  try{
    const [music,art]=await Promise.all([
      fetch(new URL("tracks.json",home)).then(r=>{if(!r.ok)throw Error("Music list unavailable");return r.json()}),
      fetch(new URL("postcards.json",home)).then(r=>r.ok?r.json():null).catch(()=>null)
    ]);
    if(!Array.isArray(music.tracks)||music.tracks.length!==12||!music.tracks.every((t,i)=>t.number===i+1&&/^[a-zA-Z0-9_./-]+\.mp3$/.test(t.url)))throw Error("Music list invalid");
    tracks=music.tracks;
    if(Array.isArray(art?.published)){
      const safe=art.published.filter(a=>/^[a-z0-9-]+$/.test(a.id||"")&&/^(cover\.jpg|postcards\/[a-z0-9-]+\.(?:jpg|png|webp))$/.test(a.src||""));
      if(safe.length)artCatalog=safe;
    }
    selectRoom(roomKey);
    $("seed-status").textContent="The postcards are ready when you are.";
  }catch(e){roomStatus("Couldn't load the tracks. Check your connection and try again.");$("seed-status").textContent="The postcard tool needs the track list. Try again online.";}
})();
refreshEmbed();
refreshCreatorMail();
})();