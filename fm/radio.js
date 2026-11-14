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
let active=false,seekToken=0,failureCount=0,switching=false;
let remoteStream=null,programs=[],stationSettings={bumper_every:0,station_label:"HUMKIN RADIO"};
// Only explicit TUNE IN / CATCH UP seeks into the shared clock. Track-to-track
// changes always begin at zero; re-tuning at every song end previously skipped
// openings (often ~18 seconds) whenever loading or buffering ran behind.
let clockBoundaryMs=0;
// Preload one bounded MP3 over HTTP during the current song, not at its end.
// Prefetch failure is harmless: the native <audio> element uses its URL.
let prepared=null, activeBlobUrl=null, preloadGeneration=0;
const PRELOAD_LIMIT=18*1024*1024;
const timezone="America/Chicago";
const EPOCH_FALLBACK="2026-11-13T00:00:00Z";
const CRATE_API="https://kbhqacsdvjsstzyplqij.supabase.co";
const CRATE_KEY="sb_publishable_Bv9JuOctSQTmnE3O1dP8RA_MKRNSD-o"; // RLS-protected public key.
async function fetchExtras(table,columns,filter=""){
  try{
    const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),4500);
    try{
      const response=await fetch(CRATE_API+"/rest/v1/"+table+"?select="+columns+filter,
        {headers:{apikey:CRATE_KEY},cache:"no-cache",signal:abort.signal});
      if(!response.ok)throw Error("HTTP "+response.status);
      const result=await response.json();
      return Array.isArray(result)?result:[];
    }finally{clearTimeout(timer)}
  }catch(error){
    console.warn("Optional HUMKIN station settings unavailable",error);
    return [];
  }
}
async function getPublishedCrate(){
  try{
    // Published rows only; anonymous reads are constrained by Postgres RLS.
    const abort=new AbortController();
    const timer=setTimeout(()=>abort.abort(),4500);
    let rows;
    try{
      const response=await fetch(CRATE_API+"/rest/v1/humkin_radio_tracks?select=id,title,artist,album,kind,enabled,duration_seconds,storage_path&published_at=not.is.null&enabled=eq.true&order=published_at.asc&limit=1000",
        {headers:{apikey:CRATE_KEY},cache:"no-cache",signal:abort.signal});
      if(!response.ok)throw Error("HTTP "+response.status);
      rows=await response.json();
    }finally{clearTimeout(timer)}
    if(!Array.isArray(rows))throw Error("Unexpected catalog response");
    return rows.map(row=>{
      if(row.enabled===false)return null;
      const storagePath=String(row.storage_path||"");
      if(!/^[0-9a-f-]{36}\/[0-9a-f]{64}\.mp3$/.test(storagePath))return null;
      const src=CRATE_API+"/storage/v1/object/public/humkin-radio-live/"+storagePath;
      const duration=Number(row.duration_seconds);
      if(!(duration>0&&duration<14400))return null;
      return {id:"crate-"+row.id,title:String(row.title||"").slice(0,240),
        artist:String(row.artist||"HUMKIN"),album:String(row.album||"HUMKIN RADIO"),
        duration,src,kind:row.kind==="bumper"?"bumper":"song",
        source:"cloud",artwork:fileUrl("cover.jpg",root)};
    }).filter(t=>t?.title);
  }catch(error){console.warn("HUMKIN additional crate unavailable; using original radio rotation.",error);return []}
}
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
function musicIndices(){
  return tracks.map((t,i)=>t.kind==="bumper"?-1:i).filter(i=>i!==-1);
}
function bumperIndices(){
  return tracks.map((t,i)=>t.kind==="bumper"?i:-1).filter(i=>i!==-1);
}
function withStationIds(music){
  return window.HUMKIN_AUTODJ?.insertBumpers(music,bumperIndices(),stationSettings.bumper_every)||music;
}
function tuneAt(ms){
  const program=window.HUMKIN_SCHEDULE?.currentProgram(programs,ms);
  const selected=window.HUMKIN_SCHEDULE?.scheduledAt(program,ms,tracks);
  if(selected)return selected;
  const eligible=musicIndices();
  // One fixed bumper order per cycle keeps every cycle exactly the same length.
  const totalOrder=withStationIds(eligible);
  const total=totalOrder.reduce((s,i)=>s+Math.round(tracks[i].duration*1000),0);
  if(!eligible.length||total<1)return null;
  const base=Number.isFinite(Date.parse(config?.synced_clock_epoch_utc))?Date.parse(config.synced_clock_epoch_utc):Date.parse(EPOCH_FALLBACK);
  const elapsed=Math.max(0,ms-base);
  const rotation=Math.floor(elapsed/total);
  const within=elapsed%total;
  const sequence=withStationIds(seededShuffle(eligible.length,rotation).map(i=>eligible[i]));
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
function updateOnDeck(){
  const target=$("on-deck");
  if(!target)return;
  const names=[];
  if(mode==="shuffle"&&order.length){
    for(let n=1;n<=3;n++){
      const next=order[(cursor+n)%order.length];
      if(tracks[next])names.push(tracks[next].title);
    }
  }else if(mode==="clock"&&!remoteStream&&tracks.length){
    let when=Date.now();
    let current=tuneAt(when);
    for(let n=0;n<3&&current;n++){
      const duration=tracks[current.index]?.duration||0;
      when+=Math.max(250,Math.ceil((duration-current.position)*1000)+350);
      const next=tuneAt(when);
      if(!next)break;
      if(tracks[next.index])names.push(tracks[next.index].title);
      current=next;
    }
  }
  target.textContent=names.length?"ON DECK · "+names.join("  ✳  "):
    "ON DECK · Tune in to hear the road ahead.";
}
function expectedNextIndex(){
  if(mode==="shuffle"&&order.length)return order[(cursor+1)%order.length];
  if(mode==="clock"&&!remoteStream&&clockBoundaryMs>0){
    return tuneAt(clockBoundaryMs+40)?.index??-1;
  }
  return -1;
}
function releaseObjectUrl(url){
  if(url&&typeof URL.revokeObjectURL==="function"){
    try{URL.revokeObjectURL(url)}catch{}
  }
}
function abandonPrepared(){
  preloadGeneration++;
  if(!prepared)return;
  if(prepared.controller)prepared.controller.abort();
  releaseObjectUrl(prepared.blobUrl);
  prepared=null;
}
async function preloadNext(){
  if(!active||remoteStream||audio.paused)return;
  const nextIndex=expectedNextIndex();
  if(nextIndex<0||nextIndex===index||!tracks[nextIndex])return;
  if(prepared?.index===nextIndex)return;
  abandonPrepared();
  const track=tracks[nextIndex],id=preloadGeneration;
  const controller=new AbortController();
  const loading={index:nextIndex,src:track.src,controller,blobUrl:null};
  prepared=loading;
  try{
    // Streaming audio can't be made gapless by metadata alone. Fetch the *next*
    // MP3 while the current song plays, so switching does not wait for the
    // network when the browser permits this request.
    const response=await fetch(track.src,{signal:controller.signal,cache:"force-cache"});
    if(!response.ok)throw Error("HTTP "+response.status);
    const size=Number(response.headers?.get?.("content-length")||0);
    if(size>PRELOAD_LIMIT)throw Error("Song exceeds mobile preload limit");
    let blob;
    if(response.body&&typeof response.body.getReader==="function"){
      const reader=response.body.getReader(),parts=[];
      let total=0;
      try{
        while(true){
          const {done,value}=await reader.read();
          if(done)break;
          total+=value.byteLength;
          if(total>PRELOAD_LIMIT)throw Error("Song exceeds mobile preload limit");
          parts.push(value);
        }
      }finally{reader.releaseLock?.()}
      blob=new Blob(parts,{type:"audio/mpeg"});
    }else{
      blob=await response.blob();
      if(blob.size>PRELOAD_LIMIT)throw Error("Song exceeds mobile preload limit");
    }
    if(prepared!==loading||id!==preloadGeneration||!active)return;
    if(typeof URL.createObjectURL!=="function")return;
    loading.blobUrl=URL.createObjectURL(blob);
  }catch(error){
    // CORS, data saver, storage/network errors and aborted preloads are normal
    // fallbacks. Never block the radio because preloading was denied.
    if(prepared===loading){prepared=null}
    if(error.name!=="AbortError")console.debug("Next-track preload unavailable",error.message);
  }
}
function setTrackSource(i,offset,shouldPlay){
  const old=activeBlobUrl;
  let src=tracks[i]?.src;
  if(prepared?.index===i&&prepared.blobUrl){
    src=prepared.blobUrl;
    activeBlobUrl=src;
    // Take ownership of this Blob URL before cancelling the old request.
    prepared=null;
    preloadGeneration++;
  }else{
    activeBlobUrl=null;
    abandonPrepared();
  }
  setSource(src,offset,shouldPlay);
  if(old&&old!==activeBlobUrl)releaseObjectUrl(old);
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
  updateOnDeck();
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
  const seek=()=>{
    if(token!==seekToken||!(offset>0))return;
    const target=Number.isFinite(audio.duration)?Math.min(offset,Math.max(0,audio.duration-.5)):offset;
    try{audio.currentTime=target}catch{}
  };
  // Install metadata-seeking handler BEFORE changing src so mobile browsers
  // cannot lose the event or mistakenly seek with the previous song's metadata.
  if(offset>0)audio.addEventListener("loadedmetadata",seek,{once:true});
  if(changed)audio.src=src;
  else if(offset===0){try{audio.currentTime=0}catch{}}
  if(!shouldPlay)audio.load();
  if(offset>0&&audio.readyState>=1)seek();
  if(shouldPlay){
    // Play immediately: no awaits/timers before play(), even for song changes.
    audio.play().then(()=>{
      if(token!==seekToken)return;
      switching=false;failureCount=0;
      setPlaybackState("playing");updateListen();
      preloadNext();
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
  const now=Date.now();
  const selection=tuneAt(now);
  if(!selection)return;
  cycle=selection.cycle;cursor=selection.slot;
  clockBoundaryMs=now-selection.position*1000+tracks[selection.index].duration*1000;
  showTrack(selection.index,selection.position);
  setTrackSource(selection.index,selection.position,shouldPlay);
  setMessage(selection.program?"NOW AIRING · "+selection.program+" · Central Time":
    "Tuned to the approximate shared clock. Song changes play from the beginning.");
}
function nextClock(shouldPlay){
  if(remoteStream)return startClock(shouldPlay);
  if(!tracks.length||clockBoundaryMs<=0)return startClock(shouldPlay);
  // Select the next *scheduled* record from the theoretical boundary, not the
  // wall-clock time AFTER audio/network buffering. Never skip its introduction.
  const expected=tuneAt(clockBoundaryMs+40);
  if(!expected)return;
  const nextStart=clockBoundaryMs+40-expected.position*1000;
  cycle=expected.cycle;cursor=expected.slot;
  clockBoundaryMs=nextStart+tracks[expected.index].duration*1000;
  showTrack(expected.index,0);
  setTrackSource(expected.index,0,shouldPlay);
  setMessage(expected.program?"NOW AIRING · "+expected.program+" · Central Time":
    "Next record. Full song, from the beginning.");
}
function buildShuffle(previous=-1){
  const songs=musicIndices();
  for(let i=songs.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[songs[i],songs[j]]=[songs[j],songs[i]]}
  if(songs.length>1&&songs[0]===previous)[songs[0],songs[1]]=[songs[1],songs[0]];
  order=withStationIds(songs); // Never repeat a song before the shuffle cycle ends.
  cursor=0;
}
function startShuffle(shouldPlay){
  if(!order.length)buildShuffle(index);
  if(!order.length)return;
  showTrack(order[cursor]);setTrackSource(order[cursor],0,shouldPlay);
  setMessage("Your road shuffle is ready. No song repeats until the rotation completes.");
}
function nextShuffle(shouldPlay){
  if(!order.length)return;
  const previous=order[cursor];
  cursor+=1;
  if(cursor>=order.length)buildShuffle(previous);
  showTrack(order[cursor]);
  setTrackSource(order[cursor],0,shouldPlay);
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
  setTrackSource(chosen,0,true);
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
  else nextClock(true);
});
audio.addEventListener("error",()=>{
  if(!tracks.length&&!remoteStream)return;
  failureCount++;
  if(failureCount>2){pause();setMessage("The station lost the audio feed. Check your connection and tune in again.");return}
  setMessage("Couldn't load that recording. Trying to continue…");
  if(mode==="shuffle")nextShuffle(true);
  else if(!remoteStream)setTimeout(()=>nextClock(true),1300);
});
document.addEventListener("visibilitychange",()=>{
  // Don't interrupt a song when the screen is unlocked after a background gap.
  // Android may pause JavaScript in a locked browser tab. Media Session and
  // prefetch are best-effort; they cannot guarantee an ended event will run.
  if(document.visibilityState==="visible"&&active&&!audio.paused)preloadNext();
});
audio.addEventListener("timeupdate",()=>{
  if(!active||audio.paused||switching)return;
  // Switch during the last fraction of a second if a background timeupdate
  // arrives. The ended event remains the fallback if it doesn't.
  const remaining=audio.duration-audio.currentTime;
  // If the next MP3 is completely cached, hand off near the natural end. If
  // not, allow native 'ended' to fire rather than cutting off a song early.
  if(Number.isFinite(remaining)&&remaining>=0&&remaining<0.25&&
      prepared?.index===expectedNextIndex()&&prepared.blobUrl){
    if(mode==="shuffle"){nextShuffle(true);return}
    if(mode==="clock"&&!remoteStream){nextClock(true);return}
  }
  // The former periodic wall-clock correction force-jumped mid-track (9–20s)
  // after a slow network transition. The CATCH UP button now owns that action.
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
    const [cloud,overrides,schedule,settings]=await Promise.all([
      getPublishedCrate(),
      fetchExtras("humkin_radio_static_overrides","track_id,title,artist,album,enabled,kind","&limit=1000"),
      fetchExtras("humkin_radio_programs","id,name,days,start_minute,end_minute,track_ids,is_active,priority","&is_active=eq.true&limit=100"),
      fetchExtras("humkin_radio_settings","id,bumper_every,station_label","&id=eq.main&limit=1")
    ]);
    stationSettings={
      bumper_every:window.HUMKIN_AUTODJ?.cadenceValue(settings[0]?.bumper_every)||0,
      station_label:String(settings[0]?.station_label||"HUMKIN RADIO")
    };
    const mapped=new Map(overrides.map(o=>[o.track_id,o]));
    tracks=tracks.map(t=>{
      const o=mapped.get(t.id);
      return {...t,source:"static",kind:o?.kind==="bumper"?"bumper":"song",
        title:o?.title||t.title,artist:o?.artist||t.artist,album:o?.album||t.album,
        enabled:o?.enabled!==false};
    }).filter(t=>t.enabled);
    programs=schedule;
    const originalCount=tracks.length;
    const baseIds=new Set(tracks.map(t=>t.id));
    tracks.push(...cloud.filter(t=>!baseIds.has(t.id)));
    const stationIds=bumperIndices().length;
    $("playlist-note").textContent=(config.status_note||"Continuous music from the HUMKIN catalog.")+
      (tracks.length>originalCount?" PLUS "+(tracks.length-originalCount)+" new creator-loaded recordings on the dial.":"")+
      (stationIds&&stationSettings.bumper_every?" STATION IDs EVERY "+stationSettings.bumper_every+" SONGS.":"");
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
window.HUMKIN_RADIO=Object.freeze({tuneAt,seededShuffle,changeMode,
  get state(){return {mode,index,cycle,cursor,tracks:tracks.length,
    programs:programs.length,bumperEvery:stationSettings.bumper_every,
    bumperCount:bumperIndices().length,stream:remoteStream}}});
boot();
})();