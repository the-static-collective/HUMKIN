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
  const a=params.get("art")||"";
  return {song:n,art:a};
}
function permalink(song,artId){
  const url=new URL("surprise.html",root);
  url.searchParams.set("song",pad(song));
  url.searchParams.set("art",artId);
  return url.href;
}
function makeChoice(song,artId){
  const chosen=tracks.find(t=>t.number===song) || tracks[randomIndex(tracks.length)];
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
  byId("gift-title");
}
})();