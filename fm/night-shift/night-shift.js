/* HUMKIN NIGHT SHIFT: direct Cloud Autopilot receiver. No write access.
 * Existing /fm/ and Long Wave station routes remain unchanged.
 */
export const CLOUD_ORIGIN = "https://humkin-long-wave.joyvolcanomusic.workers.dev";
export const FREQUENCY = "station-one";
export const CLOUD_ROOT = CLOUD_ORIGIN + "/autopilot/" + FREQUENCY + "/";
export const STREAM_URL = CLOUD_ROOT + "live.m3u8";

export function validCloudStream(url) {
  try {
    const parsed = new URL(url);
    return parsed.href === STREAM_URL && parsed.username === "" &&
      parsed.password === "" && parsed.search === "" && parsed.hash === "";
  } catch { return false; }
}
export function cloudState(status, value) {
  if (status === 200 && value?.on_air === true && value.mode === "cloud_autopilot_hls")
    return "CLOUD_ON_AIR";
  if (status === 503 && value?.mode === "cloud_autopilot_unpublished")
    return "PROGRAM_NOT_PUBLISHED";
  if (status === 503 && value?.error === "PROGRAM_MEDIA_INCOMPLETE")
    return "INCOMPLETE_MEDIA";
  if (status === 404) return "WORKER_ROUTE_UNAVAILABLE";
  return "SIGNAL_UNCONFIRMED";
}
function text(value, limit = 160) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}
export function scheduledTrack(value) {
  if (value?.on_air !== true || !value?.track || !text(value.track.id)) return null;
  const track = value.track;
  return {
    id:text(track.id,80),
    title:text(track.title) || "Untitled recording",
    artist:text(track.artist) || "HUMKIN",
    album:text(track.album)
  };
}
if (typeof document !== "undefined") {
  const byId = id => document.getElementById(id);
  const audio=byId("radio-audio"),tuneButton=byId("tune"),pauseButton=byId("pause");
  const signal=byId("signal-state");
  const title=byId("track-title"),artist=byId("track-artist"),album=byId("track-album");
  let hls=null, listening=false, deferredFailure=false, recoveries=0, token=0;
  let metadataBusy=false;
  const say=value=>{signal.textContent=value;};
  function stopTransport() {
    if(hls){hls.destroy();hls=null;}
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }
  function attemptPlay(version) {
    if (!listening || version!==token)return;
    try {
      const promise=audio.play();
      if(promise?.catch)promise.catch(()=>{
        if(listening && version===token)
          say("PRESS PLAY ON THE AUDIO CONTROL IF YOUR PHONE BLOCKS AUTOPLAY.");
      });
    }catch{say("PRESS PLAY ON THE AUDIO CONTROL TO BEGIN.");}
  }
  function changeSong(track) {
    title.textContent=track?.title||"—";
    artist.textContent=track?.artist||"HUMKIN RADIO";
    album.textContent=track?.album||"";
    if(track && navigator.mediaSession && typeof MediaMetadata!=="undefined"){
      try{navigator.mediaSession.metadata=new MediaMetadata({
        title:track.title,artist:track.artist,album:track.album});}catch{}
    }
  }
  async function readCloud(version=token) {
    if(metadataBusy || document.hidden)return;
    metadataBusy=true;
    const signalController=new AbortController();
    const timer=setTimeout(()=>signalController.abort(),7000);
    try {
      const res=await fetch(CLOUD_ROOT+"status",{signal:signalController.signal,cache:"no-store"});
      const data=await res.json().catch(()=>({}));
      if(version!==token)return;
      const status=cloudState(res.status,data);
      if(status!=="CLOUD_ON_AIR"){
        if(!listening || audio.paused)
          say(status==="PROGRAM_NOT_PUBLISHED"?"THE CLOUD PROGRAM HAS NOT BEEN PUBLISHED.":
            status==="INCOMPLETE_MEDIA"?"CLOUD PROGRAM MEDIA IS INCOMPLETE.":
            "CLOUD SIGNAL UNAVAILABLE. LONG WAVE IS STILL AN OPTION.");
        return;
      }
      if(!listening)say("CLOUD PROGRAM IS ON AIR. PRESS TUNE TO LISTEN.");
      const info=await fetch(CLOUD_ROOT+"now-playing",{cache:"no-store"});
      if(!info.ok)return;
      const now=await info.json();
      if(version===token)changeSong(scheduledTrack(now));
    }catch{
      if(!listening)say("CLOUD STATUS NOT REACHABLE. YOU MAY STILL TRY TUNING.");
    }finally{clearTimeout(timer);metadataBusy=false;}
  }
  function tune() {
    token++;
    const version=token;
    listening=true;deferredFailure=false;recoveries=0;
    stopTransport();
    tuneButton.textContent="REJOIN LIVE";
    pauseButton.disabled=false;
    say("CONNECTING TO THE SHARED CLOUD CLOCK…");
    if(!validCloudStream(STREAM_URL)){say("INVALID RADIO ADDRESS.");return;}
    if(audio.canPlayType("application/vnd.apple.mpegurl")){
      audio.src=STREAM_URL;
      audio.load();
      attemptPlay(version);
    }else if(globalThis.Hls?.isSupported?.()){
      const Hls=globalThis.Hls;
      hls=new Hls({liveSyncDurationCount:3,enableWorker:true});
      hls.on(Hls.Events.MEDIA_ATTACHED,()=>{
        if(version!==token)return;
        hls?.loadSource(STREAM_URL);
        attemptPlay(version);
      });
      hls.on(Hls.Events.ERROR,(_event,event)=>{
        if(version!==token || !event.fatal)return;
        if(document.hidden){deferredFailure=true;return;}
        if(recoveries++===0 && event.type===Hls.ErrorTypes.NETWORK_ERROR){
          say("RECONNECTING TO THE CLOUD…");hls?.startLoad();return;
        }
        if(recoveries===1 && event.type===Hls.ErrorTypes.MEDIA_ERROR){
          say("RECOVERING AUDIO…");hls?.recoverMediaError();return;
        }
        say("CLOUD AUDIO LOST. PRESS REJOIN LIVE OR TRY LONG WAVE.");
      });
      hls.attachMedia(audio);
      attemptPlay(version);
    }else{
      listening=false;
      pauseButton.disabled=true;
      say("THIS BROWSER CANNOT PLAY HLS. OPEN THE HLS PLAYLIST IN VLC OR USE LONG WAVE.");
    }
    void readCloud(version);
  }
  tuneButton.addEventListener("click",tune);
  pauseButton.addEventListener("click",()=>{
    listening=false;
    audio.pause();
    say("PAUSED. PRESS REJOIN LIVE TO RETURN TO THE CURRENT PROGRAM.");
  });
  audio.addEventListener("playing",()=>{
    if(listening)say("LISTENING TO THE SHARED CLOUD RADIO.");
  });
  audio.addEventListener("waiting",()=>{
    if(listening)say("BUFFERING THE CLOUD SIGNAL…");
  });
  audio.addEventListener("error",()=>{
    if(!listening)return;
    if(document.hidden){deferredFailure=true;return;}
    say("AUDIO CONNECTION LOST. PRESS REJOIN LIVE OR TRY LONG WAVE.");
  });
  document.addEventListener("visibilitychange",()=>{
    if(document.hidden)return;
    if(deferredFailure){
      deferredFailure=false;
      if(listening)say("PHONE BACKGROUND INTERRUPTED AUDIO. PRESS REJOIN LIVE IF NECESSARY.");
    }
    void readCloud();
  });
  setInterval(()=>{if(!document.hidden)void readCloud();},15000);
  void readCloud();
}
