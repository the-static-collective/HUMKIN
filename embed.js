(()=>{"use strict";
const $=id=>document.getElementById(id);
const base=new URL("./",document.baseURI);
const params=new URL(location.href).searchParams;
const valid=n=>Number.isInteger(n)&&n>=1&&n<=12;
function getList(){
  if(params.get("all")==="1")return Array.from({length:12},(_,i)=>i+1);
  const mix=params.get("mix")||"";
  if(/^(?:0?[1-9]|1[0-2])(?:\.(?:0?[1-9]|1[0-2])){2}$/.test(mix)){
    const ids=mix.split(".").map(Number);
    if(new Set(ids).size===3)return ids;
  }
  const one=Number(params.get("track"));
  if(valid(one))return [one];
  return [1,5,9];
}
const numbers=getList(),audio=$("mini-audio");
let tracks=[],index=0;
const status=s=>{$("mini-status").textContent=s};
function setIndex(i,play=false){
  if(i<0||i>=numbers.length||!tracks.length)return;
  index=i;const n=numbers[i],song=tracks[n-1];
  if(!song)return;
  audio.pause();audio.src=new URL(song.url,base).href;audio.load();
  $("mini-title").textContent=song.title;
  $("mini-count").textContent=(index+1)+" / "+numbers.length+" · MUTANT POP";
  $("mini-play").textContent="▶ PLAY";
  Array.from($("mini-list").children).forEach((li,j)=>li.firstElementChild?.setAttribute("aria-current",String(j===index)));
  if(play)audio.play().catch(()=>status("Playback unavailable; open the full record."));
}
function next(){if(index+1<numbers.length)setIndex(index+1,true);else{audio.pause();status("The little radio is finished. Play it again anytime.")}}
function previous(){if(audio.currentTime>3){audio.currentTime=0;return}if(index>0)setIndex(index-1,true)}
function playPause(){if(audio.paused)audio.play().catch(()=>status("Playback blocked; try the native audio controls."));else audio.pause()}
$("mini-play").addEventListener("click",playPause);
$("mini-next").addEventListener("click",next);
$("mini-prev").addEventListener("click",previous);
audio.addEventListener("ended",next);
audio.addEventListener("play",()=>{$("mini-play").textContent="Ⅱ PAUSE";status("Playing "+tracks[numbers[index]-1].title)});
audio.addEventListener("pause",()=>{$("mini-play").textContent="▶ PLAY"});
audio.addEventListener("error",()=>{if(tracks.length)status("Song unavailable here. Open HUMKIN to listen.")});
const u=new URL("./",base);
if(numbers.length===3)u.searchParams.set("mix",numbers.map(n=>String(n).padStart(2,"0")).join("."));
if(numbers.length===1)u.searchParams.set("track",String(numbers[0]).padStart(2,"0"));
$("mini-open").href=u.href;
(async()=>{
 try{
   const response=await fetch(new URL("tracks.json",base));
   if(!response.ok)throw Error("Catalog unavailable");
   const catalog=await response.json();
   if(!Array.isArray(catalog.tracks)||catalog.tracks.length!==12||!catalog.tracks.every((t,i)=>t.number===i+1&&/^[a-zA-Z0-9_./-]+\.mp3$/.test(t.url)))throw Error("Invalid catalog");
   tracks=catalog.tracks;
   const list=$("mini-list");list.replaceChildren();
   numbers.forEach((n,i)=>{
     const li=document.createElement("li"),button=document.createElement("button");
     button.type="button";button.textContent=tracks[n-1].title;
     button.addEventListener("click",()=>setIndex(i,true));li.append(button);list.append(li);
   });
   for(const id of ["mini-play","mini-prev","mini-next"])$(id).disabled=false;
   $("mini-next").disabled=numbers.length<2;
   $("mini-prev").disabled=numbers.length<2;
   setIndex(0,false);status("Ready · press play when you want to listen");
 }catch{status("Can't load the record. Open HUMKIN to listen.");$("mini-title").textContent="HUMKIN · MUTANT POP"}
})();
})();