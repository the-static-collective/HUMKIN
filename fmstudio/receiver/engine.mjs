/* Native, single-audio-element HUMKIN receiver. Station ID selects sound; skins never do. */
import {parseHlsCues, safeArt, streamForStation, trackAt} from "./core.mjs";

export function createReceiver(audio, onUpdate = () => {}) {
  let token = 0, hls = null, interval = null, cueSheet = null, lastProgress = 0;
  let wanted = false, deferredError = false, metadataBusy = false;
  const state = {stationId: null, mode: "idle", playing: false, status: "Ready to tune", track: null};
  const emit = patch => { Object.assign(state, patch); onUpdate({...state}); };
  const active = n => n === token && state.mode !== "idle";
  function clearTransport() {
    clearInterval(interval); interval = null;
    cueSheet = null; deferredError = false; metadataBusy = false;
    if (hls) { hls.destroy(); hls = null; }
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }
  function stop() {
    ++token; wanted = false;
    emit({mode: "idle", playing: false, stationId: null, track: null, status: "Ready to tune"});
    clearTransport();
  }
  function attemptPlay(n) {
    if (!wanted || !active(n)) return;
    try {
      const started = audio.play();
      if (started?.catch) started.catch(() => {
        if (active(n) && wanted) emit({status: "Tap Play or the audio controls to start."});
      });
    } catch {
      if (active(n) && wanted) emit({status: "Tap Play or the audio controls to start."});
    }
  }
  function unavailable(message) {
    wanted = false;
    clearTransport();
    emit({mode: "unavailable", playing: false, track: null, status: message});
  }
  function fallback(n) {
    if (!active(n) || state.mode !== "hls") return;
    const urls = streamForStation(state.stationId);
    clearTransport();
    if (!urls.longwave) {
      unavailable("This frequency is not broadcasting audio. Try again when it returns.");
      return;
    }
    emit({mode: "longwave", playing: false, track: null,
      status: "Switching to the station's Long Wave backup…"});
    lastProgress = Date.now();
    audio.src = urls.longwave;
    audio.load();
    attemptPlay(n);
  }
  function syncMetadata() {
    if (state.mode !== "hls" || !wanted) return;
    const time = hls ? hls.playingDate?.getTime() :
      audio.getStartDate?.()?.getTime() + audio.currentTime * 1000;
    const track = trackAt(cueSheet, time);
    if (JSON.stringify(track) !== JSON.stringify(state.track)) emit({track});
  }
  async function refreshCues(n) {
    if (!active(n) || state.mode !== "hls" || metadataBusy || !wanted) return;
    metadataBusy = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const result = await fetch(streamForStation(state.stationId).hls,
        {cache: "no-store", signal: controller.signal});
      if (!result.ok) return;
      const text = await result.text();
      if (active(n) && state.mode === "hls") {
        cueSheet = parseHlsCues(text);
        syncMetadata();
      }
    } catch { /* Metadata is non-authoritative if unavailable; audio continues. */ }
    finally { clearTimeout(timeout); metadataBusy = false; }
  }
  async function checkSignal(n) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const result = await fetch(streamForStation(state.stationId).status,
        {cache: "no-store", signal: controller.signal});
      if (!result.ok) return;
      const data = await result.json();
      if (active(n) && state.mode === "hls" && data?.on_air === false) fallback(n);
    } catch { /* A failed status check cannot prove the transmitter is down. */ }
    finally { clearTimeout(timeout); }
  }
  function monitor(n) {
    if (!active(n) || !wanted || state.mode !== "hls") return;
    if (!document.hidden && !audio.paused && Date.now() - lastProgress > 30000)
      fallback(n);
    else if (!document.hidden) void refreshCues(n);
  }
  function tune(stationId) {
    const urls = streamForStation(stationId);
    ++token; const n = token;
    wanted = true;
    emit({mode: "idle", playing: false, stationId, track: null, status: "Tuning…"});
    clearTransport();
    emit({mode: "hls", status: "Connecting to the live transmitter…"});
    lastProgress = Date.now();
    interval = setInterval(() => monitor(n), 10000);
    void checkSignal(n);
    if (audio.canPlayType("application/vnd.apple.mpegurl")) {
      audio.src = urls.hls;
      audio.load();
      attemptPlay(n);
    } else if (globalThis.Hls?.isSupported?.()) {
      const Hls = globalThis.Hls;
      hls = new Hls({liveSyncDurationCount: 3, enableWorker: true});
      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        if (!active(n) || state.mode !== "hls") return;
        hls.loadSource(urls.hls);
        attemptPlay(n);
      });
      hls.on(Hls.Events.ERROR, (_event, detail) => {
        if (!active(n) || state.mode !== "hls" || !detail.fatal) return;
        if (document.hidden) { deferredError = true; return; }
        fallback(n);
      });
      hls.attachMedia(audio);
      // This attempt is made in the original click gesture on platforms that require it.
      attemptPlay(n);
    } else fallback(n);
    void refreshCues(n);
  }
  function pause() {
    wanted = false;
    audio.pause();
    if (state.mode !== "idle") emit({playing: false, status: "Paused · rejoin live anytime."});
  }
  function resume() {
    if (!state.stationId) return;
    if (state.mode === "unavailable") return tune(state.stationId);
    wanted = true;
    attemptPlay(token);
    if (state.mode === "hls") void refreshCues(token);
  }
  function toggle() {
    if (!state.stationId) return;
    if (state.playing) pause();
    else resume();
  }
  audio.addEventListener("playing", () => {
    if (!wanted || state.mode === "idle") return;
    lastProgress = Date.now();
    emit({playing: true, status: state.mode === "longwave"
      ? "Listening · Long Wave backup" : "Listening live · shared broadcast"});
  });
  audio.addEventListener("timeupdate", () => {
    if (!audio.paused && wanted) {
      lastProgress = Date.now();
      if (state.mode === "hls") syncMetadata();
    }
  });
  audio.addEventListener("pause", () => {
    if (state.mode !== "idle" && state.playing) emit({playing: false,
      status: wanted ? "Buffering…" : "Paused · rejoin live anytime."});
  });
  audio.addEventListener("waiting", () => {
    if (wanted && state.mode !== "idle") emit({playing: false, status: "Buffering the signal…"});
  });
  audio.addEventListener("error", () => {
    if (state.mode === "hls") {
      if (document.hidden) deferredError = true;
      else fallback(token);
    } else if (state.mode === "longwave")
      unavailable("No live signal available. Retry or open the classic receiver.");
  });
  audio.addEventListener("ended", () => {
    if (state.mode === "hls" && !document.hidden) fallback(token);
    else if (state.mode === "longwave")
      unavailable("The backup stream ended. Retry to reconnect.");
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden || !wanted || state.mode !== "hls") return;
    if (deferredError || (!audio.paused && Date.now() - lastProgress > 30000)) fallback(token);
    else void refreshCues(token);
  });
  return Object.freeze({
    tune, stop, pause, resume, toggle,
    get state() { return {...state}; }
  });
}
