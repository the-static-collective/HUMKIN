(()=>{"use strict";
const $=id=>document.getElementById(id);
const root=new URL("../",document.baseURI);
const here=new URL("./",document.baseURI);
const audio=$("air");
const status=$("station-status");
const title=$("current-title");
const artist=$("current-artist");
const message=$("playback-message");
const counter=$("counter");
const modeHelp=$("mode-help");
let tracks=[],config=null,mode="clock",index=-1,order=[],cursor=0,cycle=-1;
let active=false,seekToken=0,failureCount=0,lastLiveCheck=0,switching=false;
let remoteStream=null;
const EPOCH_FALLBACK="2026-11-13T00:00:00Z";
const safeText=s=>typeof s==="string"?s:"";
const fileUrl=(relative,base)=>new URL(relative,base).href;
const setMessage=s=>{message.textContent=s};
const pad=n=>String(n).padStart(2,"0");
function seededShuffle(n,seed){
  const list=Array.from({length:n},(_,i)=>i);
  let state=(seed^0x9e3779b9)>>>0;
  const random=()=>{state=(state+0x6d2b79f5)>>>0;let x=state;x=Math.imul(x^(x>>>15),x|1);x^=x+Math.imul(x^(x>>>7),x|61);return ((x^(x>>>14))>>>0)/4294967296};
  for(let i=n-1;i>0;i--){const j=Math.floor(random()*(i+1));[list[i],list[j]]=[list[j],list[i]]}
  return list;
}
function tuneAt(ms){
  const total=tracks.reduce((s,t)=>s+Math.round(t.duration*1000),0);
  if(!tracks.length||total<1)return null;
  const base=Number.isFinite(Date.parse(config?.synced_clock_epoch_utc))?Date.parse(config.synced_clock_epoch_utc):Date.parse(EPOCH_FALLBACK);
  const elapsed=Math.max(0,ms-base);
  const rotation=Math.floor(elapsed/total);
  const within=elapsed%total;
  const sequence=seededShuffle(tracks.length,rotation);
  let soFar=0;
  for(let i=0;i<sequence.length;i++){
    const track=tracks[sequence[i]];
    const duration=Math.round(track.duration*1000);
    if(within<soFar+duration) return {index:sequence[i],position:(within-soFar)/1000,cycle:rotation,slot:i};
    soFar+=duration;
  }
  return {index:sequence[0],position:0,cycle:rotation,slot:0};
}
function updateModeUI(){
  $("mode-clock").setAttribute("aria-pressed",String(mode==="clock"));
  $("mode-shuffle").setAttribute("aria-pressed",String(mode==="shuffle"));
  $("catch-up").hidden=mode!=="clock"||Boolean(remoteStream);
  $("next-song").hidden=mode!=="shuffle";
  modeHelp.textContent=mode==="shuffle"
   ?"Your own continuous, no-repeat shuffle. Next Song works here; audio continues through the entire crate."
   :remoteStream
   ?"Tuning an independent continuous broadcast stream. Everyone connected to that stream receives the same live program."
   :"Same-time radio approximates a shared broadcast clock using official MP3s. It isn't a real server broadcast; playback may drift with buffering.";
}
function setMediaInfo(track){
  if(!track)return;
  document.title="HUMKIN RADIO · "+track.title;
  if("mediaSession" in navigator&&typeof MediaMetadata!=="undefined"){
    try{
      navigator.mediaSession.metadata=new MediaMetadata({
        title:track.title,artist:track.artist||"HUMKIN",album:track.album||"HUMKIN RADIO",
        artwork:[{src:track.artwork||fileUrl("cover.jpg",root),sizes:"512x512",type:"image/jpeg"}]
      });
    }catch{}
  }
}
function showTrack(i,position=0){
  if(!tracks[i])return;
  index=i;
  const t=tracks[i];
  title.textContent=t.title;
  artist.textContent=(t.artist||"HUMKIN")+" · "+(t.album||config?.station_name||"HUMKIN RADIO");
  $("current-art").src=t.artwork||fileUrl("cover.jpg",root);
  $("current-art").alt=t.title+" — HUMKIN radio artwork";
  setMediaInfo(t);
  counter.textContent=mode==="clock"?(remoteStream?"LIVE STREAM":"ON THE SHARED CLOCK"):(pad(cursor+1)+" / "+pad(order.length));
}
// An explicit playing state keeps Android's media notification attached while
// the same <audio> element switches MP3s. It cannot override OS tab suspension.
function setPlaybackState(state){
  if("mediaSession" in navigator){
    try{navigator.mediaSession.playbackState=state}catch{}
  }
}
function updateListen(){
  const playing=active&&(!audio.paused||switching);
  $("listen").textContent=playing?"Ⅱ PAUSE RADIO":"▶ TUNE IN";
  status.textContent=playing?"✳ TUNED IN":"READY TO TUNE IN";
  status.classList.toggle("playing",playing);
}
function pause(){
  seekToken++;switching=false;active=false;
  audio.pause();setPlaybackState("paused");updateListen();
}
function setSource(src,offset,shouldPlay){
  const token=++seekToken;
  // The old code called pause() and load() on every song change, releasing the
  // active media session exactly when a locked phone needed the next song.
  // Assigning a changed src automatically starts resource selection; don't
  // explicitly tear down the player during a background transition.
  switching=shouldPlay;
  active=shouldPlay;
  setPlaybackState(shouldPlay?"playing":"paused");
  if(!shouldPlay&&!audio.paused)audio.pause();
  const changed=audio.src!==src;
  if(changed)audio.src=src;
  if(!shouldPlay)audio.load();
  const seek=()=>{
    if(token!==seekToken||!(offset>0))return;
    const target=Number.isFinite(audio.duration)?Math.min(offset,Math.max(0,audio.duration-.5)):offset;
    try{audio.currentTime=target}catch{}
  };
  if(offset>0&&audio.readyState<1)audio.addEventListener("loadedmetadata",seek,{once:true});
  else seek();
  if(shouldPlay){
    // Play immediately: no awaits/timers before play(), even for song changes.
    audio.play().then(()=>{
      if(token!==seekToken)return;
      switching=false;failureCount=0;
      setPlaybackState("playing");updateListen();
    }).catch(()=>{
      if(token!==seekToken)return; // A newer track superseded this attempt.
      switching=false;active=false;
      setPlaybackState("paused");
      setMessage("The browser blocked the next track. Tap TUNE IN to resume.");
      updateListen();
    });
  }else{switching=false;updateListen();}
}
function startClock(shouldPlay){
  if(remoteStream){
    index=-1;title.textContent="HUMKIN RADIO · LIVE";artist.textContent="THE ACTUAL STREAM";counter.textContent="LIVE STREAM";
    setMediaInfo({title:"HUMKIN RADIO LIVE",artist:"HUMKIN"});
    setSource(remoteStream,0,shouldPlay);return;
  }
  const selection=tuneAt(Date.now());
  if(!selection)return;
  cycle=selection.cycle;cursor=selection.slot;
  showTrack(selection.index,selection.position);
  setSource(tracks[selection.index].src,selection.position,shouldPlay);
  setMessage("On the shared station clock. Approximate sync; ordinary phone buffering can differ.");
}
function buildShuffle(previous=-1){
  order=Array.from({length:tracks.length},(_,i)=>i);
  for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]]}
  if(order.length>1&&order[0]===previous)[order[0],order[1]]=[order[1],order[0]];
  cursor=0;
}
function startShuffle(shouldPlay){
  if(!order.length)buildShuffle(index);
  showTrack(order[cursor]);setSource(tracks[order[cursor]].src,0,shouldPlay);
  setMessage("Your road shuffle is ready. No song repeats until the rotation completes.");
}
function nextShuffle(shouldPlay){
  if(!tracks.length)return;
  const previous=order[cursor];
  cursor+=1;
  if(cursor>=order.length)buildShuffle(previous);
  showTrack(order[cursor]);
  setSource(tracks[order[cursor]].src,0,shouldPlay);
}
function spotlight(id){
  const chosen=tracks.findIndex(t=>t.id===id);
  if(chosen<0)return;
  mode="shuffle";
  buildShuffle();
  const slot=order.indexOf(chosen);
  if(slot>0)[order[0],order[slot]]=[order[slot],order[0]];
  cursor=0;
  updateModeUI();
  showTrack(chosen);
  setSource(tracks[chosen].src,0,true);
  setMessage("New single: "+tracks[chosen].title+". Road Shuffle will keep playing afterward.");
}
function changeMode(target){
  if(target!=="clock"&&target!=="shuffle")return;
  const wasPlaying=!audio.paused&&active;
  mode=target;order=[];updateModeUI();
  if(target==="clock")startClock(wasPlaying);
  else startShuffle(wasPlaying);
}
async function startRadio(){
  if(!tracks.length&&!remoteStream)return;
  if(!audio.paused){pause();return}
  if(mode==="clock"){
    // A stale paused session must catch up to the shared air clock.
    startClock(true);
  }else if(index<0||!audio.src){
    startShuffle(true);
  }else{
    active=true;
    try{await audio.play()}catch{active=false;setMessage("Your browser couldn't start playback. Tap the built-in player.");}
    updateListen();
  }
}
async function share(){
  const link=new URL("./",here).href;
  const detail={title:"HUMKIN RADIO",text:"Music for the long way home.",url:link};
  if(navigator.share){try{await navigator.share(detail);setMessage("The station is ready to travel.");return}catch(err){if(err?.name==="AbortError")return}}
  if(navigator.clipboard&&window.isSecureContext){try{await navigator.clipboard.writeText(link);setMessage("Station link copied.");return}catch{}}
  setMessage("Share this address: "+link);
}
$("listen").addEventListener("click",startRadio);
$("spotlight").addEventListener("click",()=>spotlight("haileylu-bloom"));
$("catch-up").addEventListener("click",()=>{if(mode==="clock")startClock(!audio.paused)});
$("next-song").addEventListener("click",()=>{if(mode==="shuffle")nextShuffle(!audio.paused)});
$("mode-clock").addEventListener("click",()=>changeMode("clock"));
$("mode-shuffle").addEventListener("click",()=>changeMode("shuffle"));
$("share-station").addEventListener("click",share);
audio.addEventListener("play",()=>{
  active=true;setPlaybackState("playing");updateListen();
  setMessage("Playing. Lock your screen if you like; your browser controls background playback.");
});
audio.addEventListener("playing",()=>{active=true;setPlaybackState("playing");updateListen()});
audio.addEventListener("pause",()=>{
  // A brief internal pause during a src swap is NOT a user stop.
  if(!switching){active=false;setPlaybackState("paused")}
  updateListen();
});
audio.addEventListener("ended",()=>{
  if(!tracks.length)return;
  if(mode==="shuffle")nextShuffle(true);
  else if(remoteStream){setMessage("Stream ended. Tune in again to reconnect.");pause();}
  else startClock(true);
});
audio.addEventListener("error",()=>{
  if(!tracks.length&&!remoteStream)return;
  failureCount++;
  if(failureCount>2){pause();setMessage("The station lost the audio feed. Check your connection and tune in again.");return}
  setMessage("Couldn't load that recording. Trying to continue…");
  if(mode==="shuffle")nextShuffle(true);
  else if(!remoteStream)setTimeout(()=>startClock(true),1300);
});
document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible"&&mode==="clock"&&!remoteStream&&active&&!audio.paused){
    const expected=tuneAt(Date.now());
    if(expected&&(expected.index!==index||Math.abs((audio.currentTime||0)-expected.position)>8))startClock(true);
  }
});
audio.addEventListener("timeupdate",()=>{
  if(!active||audio.paused||switching)return;
  // Switch during the last fraction of a second if a background timeupdate
  // arrives. The ended event remains the fallback if it doesn't.
  const remaining=audio.duration-audio.currentTime;
  if(Number.isFinite(remaining)&&remaining>=0&&remaining<0.35){
    if(mode==="shuffle"){nextShuffle(true);return}
    if(mode==="clock"&&!remoteStream){
      const upcoming=tuneAt(Date.now()+650);
      if(upcoming&&upcoming.index!==index){startClock(true);return}
    }
  }
  // Don't tear down a healthy foreground media session just to resync the
  // shared clock while the display is locked. Catch up on the next song end
  // or on returning to the visible page.
  if(document.visibilityState!=="visible"||mode!=="clock"||remoteStream)return;
  if(Date.now()-lastLiveCheck<12000)return;lastLiveCheck=Date.now();
  const expected=tuneAt(Date.now());
  if(expected&&(expected.index!==index||Math.abs((audio.currentTime||0)-expected.position)>9))startClock(true);
});
if("mediaSession" in navigator){
  try{
    navigator.mediaSession.setActionHandler("play",()=>{if(audio.paused)startRadio()});
    navigator.mediaSession.setActionHandler("pause",pause);
    navigator.mediaSession.setActionHandler("stop",pause);
    navigator.mediaSession.setActionHandler("nexttrack",()=>{if(mode==="shuffle")nextShuffle(true)});
    navigator.mediaSession.setActionHandler("previoustrack",()=>{if(mode==="clock")startClock(true);else if(tracks.length)startShuffle(true)});
  }catch{}
}
function validatedSrc(value,base){
  if(typeof value!=="string"||!value.trim())return null;
  const u=new URL(value,base);
  if(u.protocol!=="https:"&&u.protocol!=="http:")return null;
  if(u.protocol!=="https:"&&location.protocol==="https:")return null;
  // Avoid serving a disguised non-audio endpoint as music.
  if(!/\.(?:mp3|m4a|aac|ogg|opus)(?:$|[?#])/i.test(u.href))return null;
  return u.href;
}
async function boot(){
  try{
    const response=await fetch(fileUrl("rotation.json",here),{cache:"no-cache"});
    if(!response.ok)throw Error("No station configuration");
    config=await response.json();
    const epoch=Date.parse(config.synced_clock_epoch_utc);
    if(!Number.isFinite(epoch))throw Error("Invalid clock");
    if(config.live_stream_url){
      const url=new URL(config.live_stream_url);
      if(url.protocol==="https:")remoteStream=url.href;
    }
    if(config.source_type==="existing_catalog"){
      const res=await fetch(fileUrl(config.catalog||"../tracks.json",here),{cache:"no-cache"});
      if(!res.ok)throw Error("Album data unavailable");
      const album=await res.json();
      if(!Array.isArray(album.tracks))throw Error("No songs in album");
      const ids=Array.isArray(config.catalog_numbers)?config.catalog_numbers:[];
      tracks=ids.map(id=>album.tracks.find(t=>t.number===id)).filter(Boolean).map(t=>({
        id:String(t.number),title:t.title,artist:album.artist||"HUMKIN",duration:t.duration,
        src:validatedSrc(t.url,root),artwork:fileUrl("cover.jpg",root)
      }));
    }else if(config.source_type==="track_list"){
      if(!Array.isArray(config.tracks))throw Error("No provided tracks");
      tracks=config.tracks.map(t=>({
        id:safeText(t.id),title:safeText(t.title),artist:safeText(t.artist)||"HUMKIN",album:safeText(t.album),
        duration:Number(t.duration),src:validatedSrc(t.src,here),
        artwork:t.artwork?fileUrl(t.artwork,here):fileUrl("../cover.jpg",here)
      }));
    }
    if(!tracks.length||tracks.some(t=>!t.src||!t.title||!(t.duration>0&&t.duration<14400)))throw Error("Incomplete playable playlist");
    $("playlist-note").textContent=config.status_note||"Continuous music from the HUMKIN catalog.";
    for(const id of ["listen","mode-clock","mode-shuffle","catch-up","next-song","spotlight"])$(id).disabled=false;
    mode="clock";updateModeUI();startClock(false);
    setMessage("Press TUNE IN. No autoplay; you're in control.");
    status.textContent="✳ THE DIAL IS READY";
  }catch(err){
    title.textContent="THE RADIO NEEDS A SIGNAL";
    $("playlist-note").textContent="Couldn't load the rotation right now. Try again online.";
    status.textContent="NO SIGNAL";
    setMessage("The radio could not load its songs. Check the connection and refresh.");
  }
}
window.HUMKIN_RADIO=Object.freeze({tuneAt,seededShuffle,changeMode,get state(){return {mode,index,cycle,cursor,tracks:tracks.length,stream:remoteStream}}});
boot();
})();