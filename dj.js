(()=>{"use strict";
const $=id=>document.getElementById(id);
const base=new URL("./",document.baseURI);
const album=$("track-grid");
const audio=$("preview-audio");
let songs=[];
const pad=n=>String(n).padStart(2,"0");
const say=s=>{$("preview-status").textContent=s};
function absolute(url){return new URL(url,base).href}
function make(tag,cls,txt){
  const element=document.createElement(tag);
  if(cls)element.className=cls;
  if(txt!==undefined)element.textContent=txt;
  return element;
}
function listen(t,button){
  const src=absolute(t.url);
  audio.pause();
  if(audio.src!==src)audio.src=src;
  audio.load();
  $("playing-title").textContent=t.title;
  $("stem-mail").href="mailto:us@abundent.org?subject="+encodeURIComponent("HUMKIN DJ stems / WAV: "+t.title)+"&body="+encodeURIComponent("Hey HUMKIN!\n\nI'd like to try the stems or a WAV master for "+t.title+".\n\nI use [DJ software] for [kind of set / project].\n\nThe format or individual stems I need are:\n");
  document.querySelectorAll(".track").forEach(row=>row.classList.toggle("active",row.dataset.number===String(t.number)));
  say("Selected "+t.title+". Playback only starts when you press a control.");
  audio.play().then(()=>say("Now auditioning "+t.title+".")).catch(()=>say("The browser couldn't start audio automatically. Use the player controls."));
}
function trackRow(t){
  const article=make("article","track");article.dataset.number=String(t.number);
  const number=make("span","num",pad(t.number));
  const label=make("div","label");
  const title=make("h3",null,t.title);
  const mins=Math.floor(t.duration/60),secs=String(t.duration%60).padStart(2,"0");
  const meta=make("div","meta",mins+":"+secs+" · MP3 · DJ format notes pending");
  label.append(title,meta);
  const tools=make("div","tools");
  const preview=make("button",null,"▶ HEAR");
  preview.type="button";
  preview.setAttribute("aria-label","Preview "+t.title);
  preview.addEventListener("click",()=>listen(t,preview));
  const download=make("a",null,"↓ MP3");
  download.href=absolute(t.url);
  download.download=t.filename;
  download.setAttribute("aria-label","Download "+t.title+" as MP3");
  tools.append(preview,download);
  article.append(number,label,tools);
  return article;
}
audio.addEventListener("error",()=>{if(songs.length)say("Playback failed here. Try a direct MP3 download.")});
audio.addEventListener("ended",()=>say("Audition finished. Take the recording into your DJ library if you like."));
(async()=>{
  try{
    const response=await fetch(new URL("tracks.json",base));
    if(!response.ok)throw Error("Song catalog unavailable");
    const data=await response.json();
    if(!Array.isArray(data.tracks)||data.tracks.length!==12||!
      data.tracks.every((t,i)=>t.number===i+1&&typeof t.title==="string"&&
        Number.isFinite(t.duration)&&t.duration>0&&
        /^audio\/[a-zA-Z0-9_.-]+\.mp3$/.test(t.url)&&
        /^[a-zA-Z0-9_.-]+\.mp3$/.test(t.filename)))throw Error("Unexpected music catalog");
    songs=data.tracks;
    album.replaceChildren(...songs.map(trackRow));
    say("Choose a track to audition, or take the entire MP3 crate.");
  }catch{
    album.replaceChildren(make("p",null,"The track list couldn't load. The entire DJ crate is still linked above, or try again online."));
    say("Unable to load the songs.");
  }
})();
})();