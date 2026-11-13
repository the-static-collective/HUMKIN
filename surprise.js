(()=>{"use strict";
const byId=id=>document.getElementById(id);
const root=new URL("./",document.baseURI);
const audio=byId("gift-audio");
const messages=[
  "Maybe this one found you at just the right time.",
  "A little room in the day for something good.",
  "This song was waiting around the corner.",
  "Take it along. Or give it to somebody else.",
  "No special occasion needed for a little music."
];
const fallbackArt={id:"mutant-pop",src:"cover.jpg",alt:"MUTANT POP manga album art"};
let tracks=[],art=[fallbackArt],current=null;
const pad=n=>String(n).padStart(2,"0");
const validSong=n=>Number.isInteger(n)&&n>=1&&n<=12;
const report=t=>{byId("gift-status").textContent=t};
function randomIndex(limit,except=-1){
  if(limit<2)return 0;
  const r=Math.floor(Math.random()*(limit-1));
  return r>=except?r+1:r;
}
function parseShare(search){
  const params=new URLSearchParams(search);
  const input=params.get("song")||"";
  const n=/^(?:0?[1-9]|1[0-2])$/.test(input)?Number(input):0;
  return {song:n,art:params.get("art")||""};
}
function permalink(song,artId){
  const url=new URL("surprise.html",root);
  url.searchParams.set("song",pad(song));
  url.searchParams.set("art",artId);
  return url.href;
}
function makeChoice(song,artId){
  const chosen=tracks.find(t=>t.number===song)||tracks[randomIndex(tracks.length)];
  const chosenArt=art.find(a=>a.id===artId)||art[randomIndex(art.length)];
  return {song:chosen.number,artId:chosenArt.id};
}
function newChoice(){
  const previousIndex=current?tracks.findIndex(t=>t.number===current.song):-1;
  const previousArt=current?art.findIndex(a=>a.id===current.artId):-1;
  return {song:tracks[randomIndex(tracks.length,previousIndex)].number,artId:art[randomIndex(art.length,previousArt)].id};
}
function showGift(choice,action="replace"){
  current=choice;
  const song=tracks[choice.song-1];
  const artwork=art.find(a=>a.id===choice.artId)||fallbackArt;
  audio.pause();
  audio.src=new URL(song.url,root).href;
  audio.load();
  const image=byId("gift-art");
  image.src=new URL(artwork.src,root).href;
  image.alt=artwork.alt||"Illustrated HUMKIN music postcard";
  byId("song-title").textContent=song.title;
  byId("song-number").textContent="✳ "+pad(song.number)+" / 12";
  byId("gift-note").textContent=messages[(song.number-1)%messages.length];
  byId("gift-keep").href=audio.src;
  byId("gift-keep").download="HUMKIN - "+song.title+".mp3";
  byId("gift-keep").setAttribute("aria-disabled","false");
  byId("gift-link").value=permalink(choice.song,choice.artId);
  byId("gift-play").textContent="▶ PLAY MY SONG";
  byId("gift-play").setAttribute("aria-label","Play "+song.title);
  report("This one is yours to hear, keep, or share.");
  const url=permalink(choice.song,choice.artId);
  if(action==="push")history.pushState({humkinGift:true},"",url);
  else if(action==="replace")history.replaceState({humkinGift:true},"",url);
}
function nextGift(){
  if(!tracks.length)return;
  showGift(newChoice(),"push");
}
async function togglePlay(){
  if(audio.paused){
    try{await audio.play()}
    catch{report("Can't start this recording here. Try the full record link below.");}
  }else audio.pause();
}
async function shareGift(){
  if(!current)return;
  const url=permalink(current.song,current.artId);
  const title="HUMKIN — "+tracks[current.song-1].title;
  if(navigator.share){
    try{
      await navigator.share({title,text:"A little song found you. ✳",url});
      report("Your song is ready to travel.");return;
    }catch(error){if(error?.name==="AbortError")return;}
  }
  try{
    if(navigator.clipboard&&window.isSecureContext){
      await navigator.clipboard.writeText(url);
      report("The song link is copied. Send it along.");return;
    }
  }catch{}
  const input=byId("gift-link");
  input.focus();input.select();
  try{
    if(document.execCommand("copy")){
      report("The song link is copied. Send it along.");return;
    }
  }catch{}
  report("Select and copy the permanent song link below.");
}
byId("gift-play").addEventListener("click",togglePlay);
byId("gift-send").addEventListener("click",shareGift);
byId("gift-next").addEventListener("click",nextGift);
audio.addEventListener("play",()=>{byId("gift-play").textContent="Ⅱ PAUSE";report("Playing "+tracks[current.song-1].title+".")});
audio.addEventListener("pause",()=>{byId("gift-play").textContent="▶ PLAY MY SONG"});
audio.addEventListener("ended",()=>{byId("gift-play").textContent="▶ PLAY AGAIN";report("The song is finished. Keep it, send it, or find another.")});
audio.addEventListener("error",()=>{if(current)report("This recording could not load. Try the full album page.")});
window.addEventListener("popstate",()=>{
  if(!tracks.length)return;
  const parsed=parseShare(location.search);
  showGift(makeChoice(parsed.song,parsed.art),"replace");
});
window.HUMKIN_RELAY=Object.freeze({parseShare,permalink,validSong,get current(){return current}});
(async()=>{
  try{
    const responses=await Promise.all([
      fetch(new URL("tracks.json",root),{cache:"no-store"}),
      fetch(new URL("postcards.json",root),{cache:"no-store"}).catch(()=>null)
    ]);
    if(!responses[0].ok)throw Error("Track catalog not available");
    const album=await responses[0].json();
    if(!Array.isArray(album.tracks)||album.tracks.length!==12||
      !album.tracks.every((t,i)=>t.number===i+1&&typeof t.title==="string"&&
        /^audio\/[a-zA-Z0-9_.-]+\.mp3$/.test(t.url)))throw Error("Unexpected track catalog");
    tracks=album.tracks;
    if(responses[1]?.ok){
      const gallery=await responses[1].json();
      if(Array.isArray(gallery.published)){
        const safe=gallery.published.filter(a=>a&&/^[a-z0-9-]+$/.test(a.id||"")&&
          /^(?:cover\.jpg|postcards\/[a-z0-9-]+\.(?:jpg|png|webp))$/.test(a.src||""));
        if(safe.length)art=safe;
      }
    }
    for(const id of ["gift-play","gift-send","gift-next"])byId(id).disabled=false;
    const parsed=parseShare(location.search);
    showGift(makeChoice(parsed.song,parsed.art),"replace");
  }catch{
    byId("song-title").textContent="THE MUSIC IS HIDING";
    byId("gift-note").textContent="The little relay needs a connection to find its songs.";
    report("Couldn't load a song. Please try again online or open the full record.");
  }
})();
})();