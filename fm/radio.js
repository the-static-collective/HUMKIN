(()=>{"use strict";
const $=id=>document.getElementById(id);
// The iOS14 pocket receiver reuses this engine from /fm/iphone/; its
// content root is still the canonical /fm/, never the document subfolder.
const here=window.HUMKIN_RADIO_BASE?new URL(window.HUMKIN_RADIO_BASE,location.origin):new URL("./",document.baseURI);
const root=new URL("../",here);
const audio=$("air");
const status=$("station-status");
const title=$("current-title");
const artist=$("current-artist");
const message=$("playback-message");
const counter=$("counter");
const modeHelp=$("mode-help");
let tracks=[],config=null,mode="clock",index=-1,order=[],cursor=0,cycle=-1;
let active=false,seekToken=0,failureCount=0,switching=false;
let albumQueue=[],albumCursor=0; // Optional iOS14 receiver album mode; no extra audio element.
let remoteStream=null,hostedNowPlayingUrl=null,hostedPollTimer=null;
let programs=[],stationSettings={bumper_every:0,station_label:"HUMKIN RADIO"};
let cloudCatalogHealthy=false;
let chartAirIds=[],chartStationDay="";
const LEAGUE_API="https://kbhqacsdvjsstzyplqij.supabase.co/functions/v1/humkin-league";
async function fetchDailyChart(){
 try{
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),4800);
  try{
   const response=await fetch(LEAGUE_API,{cache:"no-store",signal:ctrl.signal});
   if(!response.ok)return null;
   const data=await response.json();
   if(data.schema!=="humkin.top42/v1"||!Array.isArray(data.airchart))return null;
   return {day:data.station_day,ids:data.airchart.filter(t=>t.plays>0).map(t=>t.id)};
  }finally{clearTimeout(timer)}
 }catch{return null}
}
// Keep VM/unit-test and older-browser clocks compatible.
const monotonicNow=()=>typeof performance!=="undefined"&&
  typeof performance.now==="function"?performance.now():Date.now();
let listened=0,lastListenTick=monotonicNow(),reported=false;
function listenerKey(){
 try{
  const old=localStorage.getItem("humkin-league-listener-v1")||"";
  if(/^[0-9a-f-]{36}$/i.test(old))return old;
  const key=typeof crypto.randomUUID==="function"?crypto.randomUUID():
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,c=>{
      const bytes=new Uint8Array(1);crypto.getRandomValues(bytes);
      const n=bytes[0]&15;return (c==="x"?n:(n&3|8)).toString(16);
    });
  localStorage.setItem("humkin-league-listener-v1",key);
  return key;
 }catch{return null}
}
function countQualifiedRadio(){
 const now=monotonicNow(),delta=Math.max(0,Math.min(5,(now-lastListenTick)/1000));
 lastListenTick=now;
 if(reported||!active||audio.paused||audio.readyState<2||index<0||
    !tracks[index]||tracks[index].kind==="bumper")return;
 listened+=delta;
 if(listened<30)return;
 reported=true;
 const listener=listenerKey();if(!listener)return;
 fetch(LEAGUE_API,{method:"POST",headers:{"Content-Type":"application/json"},
  body:JSON.stringify({action:"play",source:"radio",listener,track_id:tracks[index].id,seconds:Math.floor(listened)}),keepalive:true}).catch(()=>{});
}
async function refreshHostedMetadata(){
 if(!remoteStream||!hostedNowPlayingUrl)return;
 try{
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),7000);
  let response;
  try{
   response=await fetch(hostedNowPlayingUrl,{cache:"no-store",signal:controller.signal});
   if(!response.ok)throw Error("Station status unavailable");
  }finally{clearTimeout(timer)}
  const data=window.HUMKIN_HOSTED_NOWPLAYING?.parse(await response.json());
  if(!data||!remoteStream||mode!=="clock")return;
  title.textContent=data.title;
  artist.textContent=data.artist+" · LIVE STREAM";
  if(data.artwork){
   $("current-art").src=data.artwork;
   $("current-art").alt=data.title+" cover";
  }
  setMediaInfo({...data,album:"HUMKIN RADIO",artwork:data.artwork||fileUrl("cover.jpg",root)});
  counter.textContent=data.listeners===null?"ON THE AIR":
    "ON THE AIR · "+data.listeners+" LISTENING";
  $("on-deck").textContent=data.online?"✳ ONE TRANSMITTER · ONE SHARED SIGNAL":
    "✳ TRANSMITTER STATUS UNKNOWN · RETRYING";
 }catch{} // The stream itself never depends on an optional metadata endpoint.
}
function beginHostedMetadata(){
 if(hostedPollTimer!==null)clearInterval(hostedPollTimer);
 if(!remoteStream||!hostedNowPlayingUrl)return;
 refreshHostedMetadata();
 hostedPollTimer=setInterval(refreshHostedMetadata,17000);
}
let artAssets=new Map();
const shufflePolicy=window.HUMKIN_ROTATION_MEMORY;
const lastPlayed=shufflePolicy?.load(window.localStorage,Date.now())||new Map();
// Analogue static belongs ONLY to same-time radio (37.8%, down 4.2 points).
// Start within a listener gesture for Web Audio safety.
const warmSignal=new window.HUMKIN_WARM_SIGNAL.WarmSignal(audio,{window,intensity:37.8});
let warmStarting=false;
function startStationSound(){
  if(mode!=="clock"||warmSignal.enabled||warmStarting)return;
  warmStarting=true;
  // Never delay or interrupt the MP3 player, even if browser Web Audio fails.
  Promise.resolve(warmSignal.enable()).then(()=>{
    warmSignal.setPlayback(mode==="clock"&&active&&!audio.paused);
  }).catch(()=>{}).finally(()=>{warmStarting=false});
}
// Only explicit TUNE IN / CATCH UP seeks into the shared clock. Track-to-track
// changes always begin at zero; re-tuning at every song end previously skipped
// openings (often ~18 seconds) whenever loading or buffering ran behind.
let clockBoundaryMs=0,clockOffsetMs=0,clockCalibrated=false;
// A new listener may join mid-song; correct THAT initial join once playback
// actually begins, not each subsequent track. Natural transitions never seek.
let pendingClockJoin=null;
const stationNow=()=>Date.now()+clockOffsetMs;
function resetRate(){
  try{if(Math.abs((audio.playbackRate||1)-1)>.001)audio.playbackRate=1}catch{}
}
function finishClockJoin(){
  if(pendingClockJoin===null||remoteStream||mode!=="clock"||audio.paused)return;
  const chosen=pendingClockJoin;
  pendingClockJoin=null;
  if(index!==chosen)return;
  const expected=tuneAt(stationNow());
  if(!expected||expected.index!==index)return;
  // This is explicitly tuned-in audio. Delayed MP3 decoding and network
  // buffering have elapsed since the user pressed TUNE IN, so use NOW here.
  // Do not do this at ordinary automatic song boundaries.
  const duration=Number.isFinite(audio.duration)?audio.duration:tracks[index]?.duration;
  const target=Math.max(0,Math.min(expected.position,Math.max(0,(duration||0)-.5)));
  if(Number.isFinite(target)&&Math.abs((audio.currentTime||0)-target)>.15){
    try{audio.currentTime=target}catch{}
  }
}
function gentlyAlignClock(){
  if(mode!=="clock"||remoteStream||!active||audio.paused||switching||
      pendingClockJoin!==null||index<0)return resetRate();
  const expected=tuneAt(stationNow());
  if(!expected||expected.index!==index)return resetRate();
  // ±1.8% is almost imperceptible. Drift >2.4 sec is left alone rather than
  // skipping introductions: CATCH UP is the explicit action for large errors.
  const rate=window.HUMKIN_CLOCK_SYNC?.rateForDrift(
    expected.position-Number(audio.currentTime))||1;
  try{if(Math.abs((audio.playbackRate||1)-rate)>.002)audio.playbackRate=rate}catch{}
}
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
/* Recorded carts approved for repeatable music breaks live in the same public
 * repository as the source studio edits. This is an explicit allowlist, not
 * automatic publication of every audition or hold-labeled recording. */
async function getOnAirFieldCarts(){
 try{
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),4500);
  let data;
  try{
   const response=await fetch(fileUrl("air-carts.json",here),{cache:"no-store",signal:ctrl.signal});
   if(!response.ok)return [];
   data=await response.json();
  }finally{clearTimeout(timer)}
  if(data?.schema_version!=="humkin.radio.air-carts/v1"||
    !Array.isArray(data.carts)||data.carts.length>16)return [];
  const seen=new Set(),base=new URL("./studio/recordings/",here);
  return data.carts.map(cart=>{
   if(!/^field-fm-[0-9]{3}$/.test(cart.id||"")||seen.has(cart.id)||
     !/^[0-9a-f]{64}$/.test(cart.sha256||""))return null;
   seen.add(cart.id);
   const src=validatedSrc(cart.src,here),url=src&&new URL(src);
   if(!url||url.origin!==here.origin||!url.pathname.startsWith(base.pathname)||
     !/^[a-z0-9-]+[.]mp3$/.test(url.pathname.slice(base.pathname.length)))return null;
   const duration=Number(cart.duration_seconds);
   if(!(duration>1&&duration<=120))return null;
   const title=String(cart.title||"").trim().slice(0,180);
   if(!title)return null;
   return {id:"air-"+cart.id,title,artist:"HUMKIN",
     album:"HUMKIN RADIO · STATION BUMPERS",kind:"bumper",duration,src,
     artwork:fileUrl("../cover.jpg",here)};
  }).filter(Boolean);
 }catch(error){
  console.warn("Optional recorded on-air carts unavailable; original radio continues.",error);
  return [];
 }
}
async function getPublishedCrate(){
  try{
    // Published rows only; anonymous reads are constrained by Postgres RLS.
    const abort=new AbortController();
    const timer=setTimeout(()=>abort.abort(),7000);
    let rows;
    try{
      const response=await fetch(CRATE_API+"/rest/v1/humkin_radio_tracks?select=id,title,artist,album,kind,is_single,enabled,art_asset_id,duration_seconds,storage_path&published_at=not.is.null&enabled=eq.true&order=published_at.asc&limit=1000",
        {headers:{apikey:CRATE_KEY},cache:"no-cache",signal:abort.signal});
      if(!response.ok)throw Error("HTTP "+response.status);
      rows=await response.json();
    }finally{clearTimeout(timer)}
    if(!Array.isArray(rows))throw Error("Unexpected catalog response");
    cloudCatalogHealthy=true;
    return rows.map(row=>{
      if(row.enabled===false)return null;
      const storagePath=String(row.storage_path||"");
      if(!/^[0-9a-f-]{36}\/[0-9a-f]{64}\.mp3$/.test(storagePath))return null;
      const src=CRATE_API+"/storage/v1/object/public/humkin-radio-live/"+storagePath;
      const duration=Number(row.duration_seconds);
      if(!(duration>0&&duration<14400))return null;
      return {id:"crate-"+row.id,title:String(row.title||"").slice(0,240),
        artist:String(row.artist||"HUMKIN"),
        album:row.kind==="bumper"?"HUMKIN RADIO · STATION BUMPERS":String(row.album||"HUMKIN RADIO"),
        duration,src,kind:row.kind==="bumper"?"bumper":"song",
        is_single:row.kind!=="bumper"&&row.is_single===true,
        source:"cloud",art_asset_id:row.art_asset_id||null,artwork:fileUrl("cover.jpg",root)};
    }).filter(t=>t?.title);
  }catch(error){console.warn("HUMKIN additional crate unavailable; using original radio rotation.",error);return []}
}
// Optional, owner-reviewed public R2 catalog. Merely uploading to R2
// does not put a recording on air.
async function getPublicR2Tracks(){
 try{
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),5000);
  try{
   const response=await fetch(fileUrl(config?.r2_catalog||"r2-tracks.json",here),
     {cache:"no-cache",signal:ctrl.signal});
   if(!response.ok)return [];
   return window.HUMKIN_R2_CATALOG?.parse(
     await response.json(),fileUrl("cover.jpg",root))||[];
  }finally{clearTimeout(timer)}
 }catch(error){
  console.warn("Optional R2 manifest unavailable; original station continues.",error);
  return [];
 }
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
// The official release list is explicit, not inferred from upload time.
// Cloud inbox songs remain in normal rotation until declared as a release.
function featuredPositions(eligible){
  const policy=config?.featured_rotation;
  if(policy?.multiplier!==2)return [];
  const albums=new Set(Array.isArray(policy.albums)?policy.albums:[]);
  const singles=new Set(Array.isArray(policy.singles)?policy.singles:[]);
  return eligible.map((trackIndex,position)=>{
    const song=tracks[trackIndex];
    return albums.has(song.album)||singles.has(song.id)||
      (song.source==="cloud"&&song.kind!=="bumper"&&song.is_single===true)?position:-1;
  }).filter(i=>i>=0);
}
function seasonalExtraPositions(eligible,featured){
 return window.HUMKIN_R2_CATALOG?.additionalPositions(
   eligible,tracks,featured,config?.seasonal_rotation)||[];
}
function chartBonus(music){
 return window.HUMKIN_TOP42_ROTATION?.bonusIds(music,tracks,chartAirIds,chartStationDay)||[];
}
function weightedMusic(eligible,rotation){
  const featured=featuredPositions(eligible);
  const seasonal=seasonalExtraPositions(eligible,featured);
  const slots=window.HUMKIN_FAIR_ROTATION?.weightedCycle(
    eligible.length,rotation,seededShuffle,featured,seasonal)
    ||window.HUMKIN_FAIR_ROTATION?.cycle(eligible.length,rotation,seededShuffle)
    ||seededShuffle(eligible.length,rotation);
  const standard=slots.map(i=>eligible[i]);
  const bonus=chartBonus([...eligible,...featured.map(i=>eligible[i]),
    ...seasonal.map(i=>eligible[i])]);
  return window.HUMKIN_TOP42_ROTATION?.weave(standard,bonus)||standard;
}
function withStationIds(music){
  const raw=window.HUMKIN_BUMPER_BRAIN?.plan(music,bumperIndices(),
    stationSettings.bumper_every,tracks,config?.bumper_brain);
  return raw?.sequence||window.HUMKIN_AUTODJ?.insertBumpers(
    music,bumperIndices(),stationSettings.bumper_every)||music;
}
function rememberShuffleTrack(){
  if(mode!=="shuffle"||index<0||tracks[index]?.kind==="bumper")return;
  lastPlayed.set(tracks[index].id,Date.now());
  shufflePolicy?.save(window.localStorage,lastPlayed,Date.now());
  // Move still-fresh tracks toward the back of this rotation's unplayed songs.
  prepareUpcomingShuffle();
}
function prepareUpcomingShuffle(){
  if(mode!=="shuffle"||!order.length||cursor+1>=order.length)return;
  const slot=cursor+1;
  if(tracks[order[slot]]?.kind==="bumper")return;
  const p=shufflePolicy?.chooseSlot(order,slot,tracks,lastPlayed,Date.now())??slot;
  if(p>=slot&&p!==slot)[order[slot],order[p]]=[order[p],order[slot]];
  updateOnDeck();
}
function chooseShuffleCandidate(){
  if(!order.length)return -1;
  const slot=cursor+1;
  if(slot<order.length){
    if(tracks[order[slot]]?.kind==="bumper")return order[slot];
    const p=shufflePolicy?.chooseSlot(order,slot,tracks,lastPlayed,Date.now())??slot;
    return order[p]??-1;
  }
  // New shuffle rotation is only constructed when the old one is consumed.
  return -1;
}
function tuneAt(ms){
  const program=window.HUMKIN_SCHEDULE?.currentProgram(programs,ms);
  const selected=window.HUMKIN_SCHEDULE?.scheduledAt(program,ms,tracks);
  if(selected)return selected;
  const eligible=musicIndices();
  // One fixed bumper order per cycle keeps every cycle exactly the same length.
  // The clock's total length must include the extra featured plays, while
  // remaining constant across cycles for every same-time listener.
  const featured=featuredPositions(eligible);
  const seasonal=seasonalExtraPositions(eligible,featured);
  const bonus=[...featured,...seasonal].map(i=>eligible[i]);
  const chart=chartBonus([...eligible,...bonus]);
  const totalOrder=withStationIds([...eligible,...bonus,...chart]);
  const total=totalOrder.reduce((s,i)=>s+Math.round(tracks[i].duration*1000),0);
  if(!eligible.length||total<1)return null;
  const base=Number.isFinite(Date.parse(config?.synced_clock_epoch_utc))?Date.parse(config.synced_clock_epoch_utc):Date.parse(EPOCH_FALLBACK);
  const elapsed=Math.max(0,ms-base);
  const rotation=Math.floor(elapsed/total);
  const within=elapsed%total;
  const sequence=withStationIds(weightedMusic(eligible,rotation));
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
  $("next-song").hidden=mode!=="shuffle"&&mode!=="album";
  modeHelp.textContent=mode==="album"
   ?"Playing a complete published album in its recorded order. Tap SAME-TIME or ROAD SHUFFLE to return to radio."
   :mode==="shuffle"
   ?"Your own shuffle blends old and new. Releases receive 2× airtime; seasonal recordings receive 3× total, with a one-hour repeat memory."
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
  if(mode==="album"&&albumQueue.length){
    for(let n=albumCursor+1;n<Math.min(albumQueue.length,albumCursor+4);n++){
      if(tracks[albumQueue[n]])names.push(tracks[albumQueue[n]].title);
    }
  }else if(mode==="shuffle"&&order.length){
    for(let n=1;n<=3;n++){
      const next=n===1?chooseShuffleCandidate():order[(cursor+n)%order.length];
      if(tracks[next])names.push(tracks[next].title);
    }
  }else if(mode==="clock"&&!remoteStream&&tracks.length){
    let when=stationNow();
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
  if(mode==="shuffle"&&order.length)return chooseShuffleCandidate();
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
  index=i;listened=0;reported=false;lastListenTick=monotonicNow();
  const t=tracks[i];
  const currentShow=mode==="clock"&&!remoteStream?
     window.HUMKIN_SCHEDULE?.currentProgram(programs,stationNow()):null;
  const cover=window.HUMKIN_ART?.effective(t,currentShow,artAssets)||t.artwork||fileUrl("cover.jpg",root);
  title.textContent=t.title;
  artist.textContent=(t.artist||"HUMKIN")+" · "+(t.album||config?.station_name||"HUMKIN RADIO");
  $("current-art").src=cover;
  $("current-art").alt=(currentShow?.art_asset_id&&artAssets.has(currentShow.art_asset_id)?
      currentShow.name+" program cover":t.title+" cover")+" — HUMKIN RADIO";
  setMediaInfo({...t,artwork:cover});
  counter.textContent=mode==="album"?("ALBUM "+pad(albumCursor+1)+" / "+pad(albumQueue.length)):
    mode==="clock"?(remoteStream?"LIVE STREAM":"ON THE SHARED CLOCK"):(pad(cursor+1)+" / "+pad(order.length));
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
  warmSignal.setPlayback(mode==="clock"&&playing);
}
function pause(){
  seekToken++;switching=false;active=false;
  pendingClockJoin=null;resetRate();
  audio.pause();setPlaybackState("paused");updateListen();
}
function setSource(src,offset,shouldPlay){
  const token=++seekToken;
  resetRate();
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
      rememberShuffleTrack();
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
    pendingClockJoin=null;
    index=-1;title.textContent="HUMKIN RADIO · LIVE";artist.textContent="THE ACTUAL STREAM";counter.textContent="LIVE STREAM";
    setMediaInfo({title:"HUMKIN RADIO LIVE",artist:"HUMKIN"});
    setSource(remoteStream,0,shouldPlay);return;
  }
  const now=stationNow();
  const selection=tuneAt(now);
  if(!selection)return;
  cycle=selection.cycle;cursor=selection.slot;
  clockBoundaryMs=now-selection.position*1000+tracks[selection.index].duration*1000;
  // Set before src/play(): some browsers dispatch their play event promptly.
  pendingClockJoin=shouldPlay?selection.index:null;
  showTrack(selection.index,selection.position);
  setTrackSource(selection.index,selection.position,shouldPlay);
  setMessage(selection.program?"NOW AIRING · "+selection.program+" · Central Time":
    "Tuned to the approximate shared clock. Song changes play from the beginning.");
}
function nextClock(shouldPlay){
  if(remoteStream)return startClock(shouldPlay);
  pendingClockJoin=null;
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
  // Catalog order is early-to-late station arrival; interleave its thirds
  // so each drive sounds like classic hits and today's cuts on one dial.
  const originals=musicIndices();
  const seed=(Math.random()*4294967296)>>>0;
  const songs=weightedMusic(originals,seed);
  // Keep the shuffle random while putting anything played in the last hour at
  // the back of the new cycle. The listener's history survives page refreshes.
  const sorted=shufflePolicy?.freshFirst(songs,tracks,lastPlayed,Date.now())||songs;
  if(sorted.length>1&&sorted[0]===previous){
    const alternative=sorted.findIndex((i,j)=>j>0&&i!==previous&&
      (shufflePolicy?.fresh(lastPlayed,tracks[i]?.id,Date.now())??true));
    // Only fall back to the next candidate when the entire catalog was recent.
    const swap=alternative>=0?alternative:1;
    [sorted[0],sorted[swap]]=[sorted[swap],sorted[0]];
  }
  order=withStationIds(sorted);
  cursor=0;
}
function startShuffle(shouldPlay){
  pendingClockJoin=null;resetRate();
  if(!order.length)buildShuffle(index);
  if(!order.length)return;
  showTrack(order[cursor]);setTrackSource(order[cursor],0,shouldPlay);
  setMessage("Road Shuffle: releases 2×; approved seasonal tracks 3×; 60-minute repeat memory.");
}
function nextShuffle(shouldPlay){
  if(!order.length)return;
  const previous=order[cursor];
  cursor+=1;
  if(cursor>=order.length)buildShuffle(previous);
  if(tracks[order[cursor]]?.kind!=="bumper"){
    let chosen=shufflePolicy?.chooseSlot(order,cursor,tracks,lastPlayed,Date.now())??cursor;
    if(chosen>=cursor&&chosen!==cursor)[order[cursor],order[chosen]]=[order[chosen],order[cursor]];
    // If every remaining slot was heard recently but an older song elsewhere
    // exists, prefer the hour rule over completing this rotation.
    const fresh=shufflePolicy?.fresh(lastPlayed,tracks[order[cursor]]?.id,Date.now())??true;
    if(!fresh&&shufflePolicy?.anyFresh(musicIndices(),tracks,lastPlayed,Date.now())){
      buildShuffle(previous);
    }
  }
  showTrack(order[cursor]);
  setTrackSource(order[cursor],0,shouldPlay);
}
// Optional in-page album library for the iOS14 PWA. The canonical radio player
// and one <audio> element remain in charge; starting the radio returns to its dial.
function albumCatalog(){
  return tracks.filter(t=>t.kind!=="bumper").map(t=>({
    id:t.id,title:t.title,artist:t.artist,album:t.album||"HUMKIN RADIO",
    artwork:t.artwork||fileUrl("cover.jpg",root)
  }));
}
function playAlbum(name,firstId){
  if(typeof name!=="string"||!name)return false;
  const options=tracks.map((t,i)=>t.kind!=="bumper"&&t.album===name?i:-1).filter(i=>i>=0);
  if(!options.length)return false;
  mode="album";order=[];pendingClockJoin=null;resetRate();warmSignal.setPlayback(false);
  albumQueue=options;
  const requested=firstId?options.findIndex(i=>tracks[i].id===firstId):0;
  albumCursor=Math.max(0,requested);
  updateModeUI();
  showTrack(albumQueue[albumCursor]);
  setTrackSource(albumQueue[albumCursor],0,true);
  setMessage("ALBUM · "+name+" · "+(albumCursor+1)+" / "+albumQueue.length);
  return true;
}
function nextAlbum(shouldPlay){
  if(albumCursor+1>=albumQueue.length){
    pause();setMessage("Album finished. Choose RADIO to tune in.");return;
  }
  albumCursor++;
  showTrack(albumQueue[albumCursor]);
  setTrackSource(albumQueue[albumCursor],0,shouldPlay);
  setMessage("ALBUM · "+(albumCursor+1)+" / "+albumQueue.length);
}
function spotlight(id){
  const chosen=tracks.findIndex(t=>t.id===id);
  if(chosen<0)return;
  mode="shuffle";pendingClockJoin=null;resetRate();
  warmSignal.setPlayback(false);
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
  mode=target;order=[];pendingClockJoin=null;resetRate();
  if(target==="shuffle")warmSignal.setPlayback(false);
  else if(wasPlaying)startStationSound();
  updateModeUI();
  if(target==="clock")startClock(wasPlaying);
  else startShuffle(wasPlaying);
}
async function startRadio(){
  if(!tracks.length&&!remoteStream)return;
  if(!audio.paused){pause();return}
  if(mode==="clock"){
    startStationSound();
    // A stale paused session must catch up to the shared air clock.
    startClock(true);
  }else if(index<0||!audio.src){
    startShuffle(true);
  }else{
    active=true;
    try{await audio.play();rememberShuffleTrack();preloadNext()}catch{active=false;setMessage("Your browser couldn't start playback. Tap the built-in player.");}
    updateListen();
  }
}
function downloadNativePlaylist(){
  if(!tracks.length){setMessage("No recordings to export yet.");return}
  // Native media apps own their background service and can continue to the next
  // URL when Android suspends the browser tab. This is a snapshot playlist, not
  // synchronized live radio or an offline download of all MP3s.
  const rows=mode==="shuffle"&&order.length?order:
    withStationIds(weightedMusic(musicIndices(),Math.floor((stationNow()-Date.parse(config?.synced_clock_epoch_utc||EPOCH_FALLBACK))/86400000)));
  const clean=value=>String(value||"").replace(/[\r\n,]+/g," ").trim();
  const lines=["#EXTM3U","#PLAYLIST:HUMKIN RADIO"];
  for(const i of rows){
    const t=tracks[i];
    if(!t?.src)continue;
    // No private files, Blob URLs, data: URLs, or secrets enter the playlist.
    if(!/^https:\/\//i.test(t.src))continue;
    lines.push("#EXTINF:"+Math.max(1,Math.round(t.duration))+","+
      clean(t.artist||"HUMKIN")+" - "+clean(t.title));
    lines.push(t.src);
  }
  if(lines.length<4){setMessage("No public songs are ready for the native player.");return}
  if(typeof URL.createObjectURL!=="function"){
    setMessage("This browser cannot export playlists; use a different browser.");return;
  }
  const blob=new Blob([lines.join("\n")+"\n"],{type:"audio/x-mpegurl;charset=utf-8"});
  const url=URL.createObjectURL(blob),link=document.createElement("a");
  link.href=url;link.download="HUMKIN-RADIO.m3u";
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>releaseObjectUrl(url),30000);
  setMessage("Playlist downloaded. Open HUMKIN-RADIO.m3u in VLC (or another music app) for native screen-off playback. This is a streamed playlist, not downloaded MP3s.");
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
$("next-song").addEventListener("click",()=>{if(mode==="shuffle")nextShuffle(!audio.paused);else if(mode==="album")nextAlbum(!audio.paused)});
$("mode-clock").addEventListener("click",()=>changeMode("clock"));
$("mode-shuffle").addEventListener("click",()=>changeMode("shuffle"));
$("share-station").addEventListener("click",share);
$("phone-playlist").addEventListener("click",downloadNativePlaylist);
audio.addEventListener("play",()=>{
  lastListenTick=monotonicNow();
  startStationSound();
  active=true;setPlaybackState("playing");updateListen();
  setMessage("Playing. Lock your screen if you like; your browser controls background playback.");
  preloadNext();
  rememberShuffleTrack();
});
audio.addEventListener("playing",()=>{
  active=true;setPlaybackState("playing");updateListen();
  finishClockJoin();
  gentlyAlignClock();
});
audio.addEventListener("pause",()=>{
  lastListenTick=monotonicNow();
  // A brief internal pause during a src swap is NOT a user stop.
  if(!switching){active=false;setPlaybackState("paused")}
  updateListen();
});
audio.addEventListener("ended",()=>{
  if(!tracks.length)return;
  if(mode==="shuffle")nextShuffle(true);
  else if(mode==="album")nextAlbum(true);
  else if(remoteStream){setMessage("Stream ended. Tune in again to reconnect.");pause();}
  else nextClock(true);
});
audio.addEventListener("error",()=>{
  if(!tracks.length&&!remoteStream)return;
  failureCount++;
  if(failureCount>2){pause();setMessage("The station lost the audio feed. Check your connection and tune in again.");return}
  setMessage("Couldn't load that recording. Trying to continue…");
  if(mode==="shuffle")nextShuffle(true);
  else if(mode==="album")nextAlbum(true);
  else if(!remoteStream)setTimeout(()=>nextClock(true),1300);
});
document.addEventListener("visibilitychange",()=>{
  // Don't interrupt a song when the screen is unlocked after a background gap.
  // Android may pause JavaScript in a locked browser tab. Media Session and
  // prefetch are best-effort; they cannot guarantee an ended event will run.
  if(document.visibilityState==="visible"&&active&&!audio.paused)preloadNext();
});
audio.addEventListener("timeupdate",()=>{
  countQualifiedRadio();
  if(!active||audio.paused||switching)return;
  gentlyAlignClock();
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
if(typeof setInterval==="function")setInterval(countQualifiedRadio,1000);
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
      if(url.protocol==="https:"&&!url.username&&!url.password)remoteStream=url.href;
    }
    if(remoteStream&&config.live_nowplaying_url)
      hostedNowPlayingUrl=window.HUMKIN_HOSTED_NOWPLAYING?.safeHttps(config.live_nowplaying_url)||null;
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
    const [cloud,r2,overrides,schedule,settings,artRows,clockSample,airCarts,leagueSnapshot]=await Promise.all([
      getPublishedCrate(),
      getPublicR2Tracks(),
      fetchExtras("humkin_radio_static_overrides","track_id,title,artist,album,enabled,kind,art_asset_id","&limit=1000"),
      fetchExtras("humkin_radio_programs","id,name,days,start_minute,end_minute,track_ids,is_active,priority,art_asset_id","&is_active=eq.true&limit=100"),
      fetchExtras("humkin_radio_settings","id,bumper_every,station_label","&id=eq.main&limit=1"),
      fetchExtras("humkin_radio_art_assets","id,storage_path","&limit=1000"),
      window.HUMKIN_CLOCK_SYNC?.calibrate(fetch,CRATE_API,CRATE_KEY,()=>Date.now())
        ||Promise.resolve({offsetMs:0,synced:false}),
      getOnAirFieldCarts(),
      fetchDailyChart()
    ]);
    clockOffsetMs=clockSample?.synced?clockSample.offsetMs:0;
    clockCalibrated=Boolean(clockSample?.synced);
    chartStationDay=String(leagueSnapshot?.day||"");
    chartAirIds=Array.isArray(leagueSnapshot?.ids)?leagueSnapshot.ids:[];
    stationSettings={
      bumper_every:window.HUMKIN_AUTODJ?.cadenceValue(settings[0]?.bumper_every)||0,
      station_label:String(settings[0]?.station_label||"HUMKIN RADIO")
    };
    artAssets=window.HUMKIN_ART?.libraryMap(artRows)||new Map();
    const mapped=new Map(overrides.map(o=>[o.track_id,o]));
    tracks=[...tracks,...airCarts].map(t=>{
      const o=mapped.get(t.id);
      return {...t,source:"static",kind:o?o.kind==="bumper"?"bumper":"song":t.kind==="bumper"?"bumper":"song",
        title:o?.title||t.title,artist:o?.artist||t.artist,album:o?.album||t.album,
        art_asset_id:o?.art_asset_id||null,enabled:o?.enabled!==false};
    }).filter(t=>t.enabled);
    programs=schedule;
    const originalCount=tracks.length;
    const baseIds=new Set(tracks.map(t=>t.id));
    const additional=[...cloud,...r2].filter(t=>{
      if(baseIds.has(t.id))return false;
      baseIds.add(t.id);return true;
    });
    tracks.push(...additional);
    const stationIds=bumperIndices().length;
    const songCount=musicIndices().length;
    const r2Count=tracks.filter(t=>t.source==="r2").length;
    const r2Label=r2Count?" · "+r2Count+" R2 record"+(r2Count===1?"":"s"):"";
    const catalogLabel=cloudCatalogHealthy
      ?"CURRENT DIAL · "+songCount+" songs · "+stationIds+" station carts"+r2Label+"."
      :"LIMITED DIAL · "+songCount+" available songs"+r2Label+". Supabase crate did not load; retry later.";
    $("playlist-note").textContent=catalogLabel+" "+
      (stationIds&&stationSettings.bumper_every?
        (config?.bumper_brain?.medium_target_seconds?
          "φ SHORT DROPS · LONGER BREAKS ~11 / ~22 MIN.":
          "STATION IDs EVERY "+stationSettings.bumper_every+" SONGS."):"");
    for(const id of ["listen","mode-clock","mode-shuffle","catch-up","next-song","spotlight","phone-playlist"])$(id).disabled=false;
    mode="clock";updateModeUI();startClock(false);
    beginHostedMetadata();
    setMessage("Press TUNE IN. No autoplay; you're in control.");
    status.textContent=cloudCatalogHealthy?"✳ THE DIAL IS READY":"✳ LIMITED CATALOG — RETRY";
  }catch(err){
    title.textContent="THE RADIO NEEDS A SIGNAL";
    $("playlist-note").textContent="Couldn't load the rotation right now. Try again online.";
    status.textContent="NO SIGNAL";
    setMessage("The radio could not load its songs. Check the connection and refresh.");
  }
}
window.HUMKIN_RADIO=Object.freeze({tuneAt,seededShuffle,changeMode,
  playAlbum,albumCatalog,
  get state(){return {mode,index,cycle,cursor,tracks:tracks.length,
    programs:programs.length,bumperEvery:stationSettings.bumper_every,
    hourWindowMs:shufflePolicy?.WINDOW_MS||3600000,warmSignal:warmSignal.status(),
    clockOffsetMs,clockCalibrated,playbackRate:Number(audio.playbackRate)||1,
    bumperCount:bumperIndices().length,stream:remoteStream,
    currentTrack:remoteStream?null:(tracks[index]?{id:tracks[index].id,title:tracks[index].title,kind:tracks[index].kind}:null)}}});
boot();
})();