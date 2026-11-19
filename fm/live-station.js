/* HUMKIN /fm/ unified receiver.
 * One original art-first interface; two visible choices; three behind-the-scenes
 * playback layers: real HLS -> per-listener Long Wave -> browser Same-Time.
 * No station credentials or browser-based guesses about Acer track selection.
 */
(() => {
  "use strict";
  const byId = id => document.getElementById(id);
  const liveAudio = byId("live-air");
  const browserAudio = byId("air");
  const listen = byId("listen");
  const shuffle = byId("mode-shuffle");
  if (!liveAudio || !browserAudio || !listen || !shuffle) return;
  const radio = window.HUMKIN_RADIO;
  const BASE = "https://humkin-long-wave.joyvolcanomusic.workers.dev";
  const HLS = BASE + "/hls/live.m3u8";
  const LONG_WAVE = BASE + "/live.mp3";
  // Reserved public now-playing contract for a future Acer metadata publisher.
  // Missing endpoint is expected until that part is deployed.
  const NOW = BASE + "/hls/now-playing";
  const stationCover = new URL("../cover.jpg", document.baseURI).href;
  const status = byId("station-status");
  const detail = byId("live-status");
  const signal = byId("live-signal");
  const sourceLabel = byId("live-source");
  const title = byId("current-title");
  const artist = byId("current-artist");
  const artwork = byId("current-art");
  const onDeck = byId("on-deck");
  const counter = byId("counter");
  const modeHelp = byId("mode-help");
  const playlist = byId("phone-playlist");
  let source = "idle"; // idle, hls, longwave, clock, shuffle
  let hls = null, operation = 0, statusFailures = 0, checking = false;
  let wantsAudio = false, metadataGeneration = 0;
  let longWaveLastProgress = 0;

  function isLiveLayer() {
    return source === "hls" || source === "longwave" || source === "clock";
  }
  function paused() {
    return source === "clock" || source === "shuffle"
      ? browserAudio.paused : liveAudio.paused;
  }
  function setStatus(message, badge) {
    if (detail) detail.textContent = message;
    if (status) {
      status.textContent = badge || (isLiveLayer() ? "ON THE AIR" : "READY TO TUNE IN");
      status.classList.toggle("playing", isLiveLayer() && !paused());
    }
  }
  function genericArt() {
    if (artwork) {
      artwork.src = stationCover;
      artwork.alt = "HUMKIN Radio station artwork";
    }
    if (title) title.textContent = "HUMKIN RADIO · LIVE";
    if (artist) artist.textContent = "MUSIC FOR THE LONG WAY HOME";
    if (onDeck) onDeck.textContent = "ON DECK · Programmed at Station One";
    if (counter) counter.textContent = "ON AIR";
    document.title = "HUMKIN RADIO · LIVE";
    if ("mediaSession" in navigator && typeof MediaMetadata !== "undefined") {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: "HUMKIN RADIO · LIVE", artist: "HUMKIN RADIO",
          album: "Station One", artwork: [{src: stationCover, sizes: "512x512", type: "image/jpeg"}]
        });
      } catch {}
    }
  }
  function setSource(name) {
    source = name;
    const browser = name === "clock" || name === "shuffle";
    liveAudio.hidden = browser;
    browserAudio.hidden = !browser;
    listen.setAttribute("aria-pressed", String(isLiveLayer()));
    shuffle.setAttribute("aria-pressed", String(name === "shuffle"));
    if (playlist) playlist.hidden = name !== "shuffle";
    if (sourceLabel) sourceLabel.textContent = name;
    if (modeHelp) modeHelp.textContent = name === "shuffle"
      ? "Your own shuffle mixes the published music, release features and station carts."
      : "One live station. If the signal drops, the music keeps playing automatically.";
    if (name === "shuffle") {
      listen.textContent = "▶ LISTEN LIVE";
    } else {
      listen.textContent = "▶ LISTEN LIVE";
    }
  }
  function stopHls() {
    if (hls) { hls.destroy(); hls = null; }
  }
  function clearLiveAudio() {
    stopHls();
    liveAudio.pause();
    liveAudio.removeAttribute("src");
    liveAudio.load();
  }
  function updateButton() {
    listen.textContent = isLiveLayer() && !paused()
      ? "Ⅱ PAUSE RADIO" : "▶ LISTEN LIVE";
    if (source === "shuffle") {
      shuffle.textContent = browserAudio.paused ? "⤨ ROAD SHUFFLE · PLAY" : "Ⅱ PAUSE ROAD SHUFFLE";
    } else {
      shuffle.textContent = "⤨ ROAD SHUFFLE";
    }
  }
  function leaveForBrowser(name) {
    ++operation;
    wantsAudio = false;
    ++metadataGeneration;
    clearLiveAudio();
    setSource(name);
    updateButton();
  }
  function switchToShuffle() {
    if (source === "shuffle") {
      const changed = radio?.startRoadShuffleFromLive?.();
      if (!changed) setStatus("Loading the music catalog…", "LOADING");
      updateButton();
      return;
    }
    if (!radio?.ready) {
      setStatus("The music catalog is still loading. Try Road Shuffle again.", "LOADING");
      return;
    }
    leaveForBrowser("shuffle");
    radio.startRoadShuffleFromLive();
    updateButton();
  }
  function fallbackToClock(reason, token = operation) {
    if (token !== operation || source === "shuffle") return;
    ++metadataGeneration;
    clearLiveAudio();
    setSource("clock");
    const run = () => {
      if (token !== operation || source !== "clock") return;
      if (!radio?.ready) {
        setStatus("Getting the next recording ready…", "BUFFERING");
        setTimeout(run, 1200);
        return;
      }
      if (!radio.startSameTimeFallback()) {
        setStatus("The station needs a connection. Press Listen Live to retry.", "NO SIGNAL");
        return;
      }
      setStatus("Playing HUMKIN Radio.", "PLAYING");
      updateButton();
    };
    run();
  }
  function playRequested() {
    // The sound starts only after the listener has expressly pressed Play.
    if (!wantsAudio) return;
    const result = liveAudio.play();
    if (result?.catch) result.catch(() =>
      setStatus("Press Play in the audio controls to start listening.", "READY TO PLAY"));
  }
  function fallbackToLongWave(reason, token = operation) {
    if (token !== operation || source === "shuffle") return;
    ++metadataGeneration;
    clearLiveAudio();
    radio?.stopBrowserAudio?.();
    setSource("longwave");
    genericArt();
    longWaveLastProgress = Date.now();
    liveAudio.src = LONG_WAVE;
    liveAudio.load();
    setStatus("Connecting to HUMKIN Radio…", "CONNECTING");
    playRequested();
  }
  async function checkSignal() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    try {
      const response = await fetch(BASE + "/hls/status",
        {cache: "no-store", signal: controller.signal});
      if (!response.ok) return false;
      const data = await response.json();
      const on = data?.on_air === true && data?.mode === "shared_live_hls";
      if (signal) signal.textContent = on ? "fresh" : "offline";
      return on;
    } catch { return false; }
    finally { clearTimeout(timer); }
  }
  function trustedArt(raw) {
    if (typeof raw !== "string" || !raw) return stationCover;
    try {
      const url = new URL(raw);
      if (url.protocol === "https:" &&
          ["humkin.abundent.org", "media.abundent.org"].includes(url.hostname))
        return url.href;
    } catch {}
    return stationCover;
  }
  function showVerifiedMetadata(data) {
    if (source !== "hls" || data?.schema !== "humkin.station-one.now-playing/v1")
      return;
    const updated = Date.parse(data.updated_at);
    if (!Number.isFinite(updated) || Math.abs(Date.now() - updated) > 90000) return;
    const track = data.track;
    if (!track || typeof track.title !== "string" ||
        typeof track.artist !== "string" || !track.title.trim() ||
        !track.artist.trim()) return;
    const name = track.title.trim().slice(0, 160);
    const performer = track.artist.trim().slice(0, 160);
    const album = typeof track.album === "string" ? track.album.slice(0, 180) : "";
    const cover = trustedArt(track.artwork_url);
    if (title) title.textContent = name;
    if (artist) artist.textContent = performer + (album ? " · " + album : "");
    if (artwork) { artwork.src = cover; artwork.alt = name + " artwork"; }
    if (onDeck) onDeck.textContent = "ON THE ACER · Live program";
    document.title = "HUMKIN RADIO · " + name;
    if ("mediaSession" in navigator && typeof MediaMetadata !== "undefined") {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: name, artist: performer, album: album || "HUMKIN RADIO",
          artwork: [{src: cover, sizes: "512x512", type: "image/jpeg"}]
        });
      } catch {}
    }
  }
  async function checkMetadata() {
    if (source !== "hls" || !wantsAudio) return;
    const token = metadataGeneration;
    try {
      const response = await fetch(NOW, {cache: "no-store"});
      if (!response.ok) return;
      const data = await response.json();
      if (token !== metadataGeneration || source !== "hls") return;
      showVerifiedMetadata(data);
    } catch { /* No metadata feed yet; station cover remains truthful. */ }
  }
  async function tuneLive() {
    const token = ++operation;
    wantsAudio = true;
    ++metadataGeneration;
    radio?.stopBrowserAudio?.();
    clearLiveAudio();
    setSource("hls");
    genericArt();
    setStatus("Tuning the shared station…", "CONNECTING");
    const on = await checkSignal();
    if (token !== operation || source !== "hls") return;
    if (!on) { fallbackToLongWave("transmitter_offline", token); return; }
    statusFailures = 0;
    if (liveAudio.canPlayType("application/vnd.apple.mpegurl")) {
      liveAudio.src = HLS;
    } else if (window.Hls?.isSupported?.()) {
      hls = new window.Hls({liveSyncDurationCount: 3, enableWorker: true});
      hls.loadSource(HLS);
      hls.attachMedia(liveAudio);
      hls.on(window.Hls.Events.ERROR, (_evt, event) => {
        if (token === operation && source === "hls" && event.fatal)
          fallbackToLongWave("hls_decoder", token);
      });
    } else {
      fallbackToLongWave("hls_unsupported", token);
      return;
    }
    setStatus("Playing the shared broadcast.", "ON THE AIR");
    playRequested();
    checkMetadata();
  }

  listen.addEventListener("click", () => {
    if (isLiveLayer() && !paused()) {
      wantsAudio = false;
      if (source === "clock") radio?.stopBrowserAudio?.();
      else liveAudio.pause();
      setStatus("Radio paused. Press Listen Live to rejoin.", "PAUSED");
      updateButton();
      return;
    }
    tuneLive();
  });
  shuffle.addEventListener("click", switchToShuffle);
  const spotlight = byId("spotlight");
  if (spotlight) spotlight.addEventListener("click", () => {
    // radio.js owns the specific single selection; this only prevents overlap.
    if (source !== "shuffle") leaveForBrowser("shuffle");
  }, true);
  browserAudio.addEventListener("play", () => {
    if (source === "hls" || source === "longwave" || source === "idle") {
      leaveForBrowser("shuffle");
    }
    updateButton();
  });
  browserAudio.addEventListener("pause", updateButton);
  liveAudio.addEventListener("playing", () => {
    if (!isLiveLayer() || source === "clock") return;
    if (source === "longwave") longWaveLastProgress = Date.now();
    wantsAudio = true;
    setStatus("Playing HUMKIN Radio.", "ON THE AIR");
    updateButton();
  });
  liveAudio.addEventListener("pause", updateButton);
  liveAudio.addEventListener("timeupdate", () => {
    if (source === "longwave" && !liveAudio.paused) longWaveLastProgress = Date.now();
  });
  liveAudio.addEventListener("waiting", () => {
    if (source === "hls" || source === "longwave")
      setStatus("Buffering the radio signal…", "BUFFERING");
  });
  liveAudio.addEventListener("error", () => {
    if (source === "hls") fallbackToLongWave("hls_media_error");
    else if (source === "longwave") fallbackToClock("longwave_media_error");
  });
  liveAudio.addEventListener("ended", () => {
    if (source === "hls") fallbackToLongWave("hls_ended");
    else if (source === "longwave") fallbackToClock("longwave_ended");
  });
  if ("mediaSession" in navigator) {
    try {
      navigator.mediaSession.setActionHandler("play", () => {
        if (source === "shuffle") {
          if (browserAudio.paused) switchToShuffle();
        } else if (paused()) tuneLive();
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        if (source === "shuffle" || source === "clock")
          radio?.stopBrowserAudio?.();
        else { wantsAudio = false; liveAudio.pause(); }
      });
      navigator.mediaSession.setActionHandler("stop", () => {
        if (source === "shuffle" || source === "clock")
          radio?.stopBrowserAudio?.();
        else { wantsAudio = false; liveAudio.pause(); }
      });
    } catch {}
  }
  async function monitor() {
    // A continuous MP3 connection can silently stop producing audio without
    // firing an error/ended event. Use real decoded playback progress as proof.
    if (source === "longwave") {
      if (wantsAudio && !liveAudio.paused &&
          Date.now() - longWaveLastProgress > 50000)
        fallbackToClock("longwave_stalled");
      return;
    }
    if (source !== "hls" || checking || !wantsAudio) return;
    checking = true;
    const token = operation;
    try {
      const on = await checkSignal();
      if (token !== operation || source !== "hls") return;
      statusFailures = on ? 0 : statusFailures + 1;
      if (statusFailures >= 2) fallbackToLongWave("transmitter_stale", token);
    } finally { checking = false; }
  }
  setInterval(monitor, 20000);
  setInterval(checkMetadata, 15000);
  setSource("idle");
  genericArt();
  setStatus("Press Listen Live to join the station.", "READY TO TUNE IN");
  updateButton();
  // Passive status detection does not start audio or change the selection.
  checkSignal().then(on => {
    if (source === "idle")
      setStatus(on ? "Station One is ready. Press Listen Live." :
        "Press Listen Live. Music will continue if the transmitter is offline.",
        "READY TO TUNE IN");
  });
})();
