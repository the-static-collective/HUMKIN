/* HUMKIN Station One — optional real shared live receiver on the main radio desk.
 * No autoplay. The existing #air Same-Time / Shuffle player remains independent.
 * Only the public Worker URL is embedded; there are NO R2 credentials in this file.
 */
(() => {
  "use strict";
  const byId = id => document.getElementById(id);
  const liveAudio = byId("live-air");
  if (!liveAudio) return;
  const oldAudio = byId("air");
  const listen = byId("live-listen");
  const backupButton = byId("live-backup");
  const retry = byId("live-retry");
  const status = byId("live-status");
  const BASE = "https://humkin-long-wave.joyvolcanomusic.workers.dev";
  const LIVE = BASE + "/hls/live.m3u8";
  const BACKUP = BASE + "/live.mp3";
  let mode = "idle", player = null, sequence = 0, failures = 0, checking = false;
  function show(message) { status.textContent = message; }
  function reset() {
    if (player) { player.destroy(); player = null; }
    liveAudio.pause();
    liveAudio.removeAttribute("src");
    liveAudio.load();
  }
  function pauseOldDial() {
    if (oldAudio && !oldAudio.paused) oldAudio.pause();
  }
  function playRequested() {
    pauseOldDial();
    Promise.resolve(liveAudio.play()).catch(() => {
      show("Signal selected. Press Play on the audio control to begin.");
    });
  }
  function setMode(value) {
    mode = value;
    listen.setAttribute("aria-pressed", String(value === "live"));
    backupButton.setAttribute("aria-pressed", String(value === "backup"));
    retry.hidden = value !== "backup";
  }
  function leaveForOldDial() {
    if (mode === "idle") return;
    ++sequence;
    reset();
    setMode("idle");
    show("Built-in HUMKIN dial selected. Live and Long Wave are still available.");
  }
  function useBackup(reason, resume) {
    ++sequence;
    reset();
    setMode("backup");
    liveAudio.src = BACKUP;
    liveAudio.load();
    show(reason + " Long Wave is a different, unsynchronized personal rotation.");
    if (resume) playRequested();
  }
  async function isOnAir() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    try {
      const response = await fetch(BASE + "/hls/status", {
        cache: "no-store", signal: controller.signal
      });
      if (!response.ok) return false;
      const data = await response.json();
      return data && data.on_air === true && data.mode === "shared_live_hls";
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
  async function tuneLive() {
    const request = ++sequence;
    show("Checking Station One's transmitter…");
    const online = await isOnAir();
    if (request !== sequence) return;
    if (!online) {
      useBackup("Station One is offline. Rescuing your listening session.", true);
      return;
    }
    reset();
    failures = 0;
    setMode("live");
    if (liveAudio.canPlayType("application/vnd.apple.mpegurl")) {
      liveAudio.src = LIVE;
    } else if (window.Hls && window.Hls.isSupported()) {
      player = new window.Hls({ liveSyncDurationCount: 3, enableWorker: true });
      player.loadSource(LIVE);
      player.attachMedia(liveAudio);
      player.on(window.Hls.Events.ERROR, (_, event) => {
        if (!event.fatal || mode !== "live") return;
        useBackup("Shared live playback was interrupted.", !liveAudio.paused);
      });
    } else {
      useBackup("This browser cannot decode HLS.", true);
      return;
    }
    show("Connected to the shared live station. If audio does not start, press Play.");
    playRequested();
  }
  listen.addEventListener("click", () => {
    if (mode === "live" && !liveAudio.paused) {
      liveAudio.pause();
      show("Live radio paused. Tap LISTEN LIVE to rejoin.");
    } else {
      tuneLive();
    }
  });
  backupButton.addEventListener("click", () => useBackup("Long Wave selected.", true));
  retry.addEventListener("click", () => tuneLive());
  liveAudio.addEventListener("play", pauseOldDial);
  liveAudio.addEventListener("playing", () => {
    show(mode === "live"
      ? "ON AIR — One shared Station One program, from the Acer."
      : "Playing Long Wave — independent backup rotation.");
  });
  liveAudio.addEventListener("waiting", () => {
    if (mode !== "idle") show("Buffering " + (mode === "live" ? "live radio" : "Long Wave") + "…");
  });
  liveAudio.addEventListener("error", () => {
    if (mode === "live") useBackup("The live player reported an audio error.", !liveAudio.paused);
    else if (mode === "backup") show("Long Wave playback failed. Try again or return to the classic dial.");
  });
  // The existing station controls remain usable. A selection on that dial
  // must not leave a second (possibly hidden) audio stream playing.
  if (oldAudio) oldAudio.addEventListener("play", leaveForOldDial);
  for (const id of ["listen","spotlight","catch-up","next-song","mode-clock","mode-shuffle"]) {
    const button = byId(id);
    if (button) button.addEventListener("click", leaveForOldDial);
  }
  async function monitor() {
    if (mode !== "live" || checking) return;
    checking = true;
    const request = sequence;
    try {
      const online = await isOnAir();
      if (request !== sequence || mode !== "live") return;
      failures = online ? 0 : failures + 1;
      if (failures >= 2) {
        useBackup("Station One stopped updating.", !liveAudio.paused);
      }
    } finally {
      checking = false;
    }
  }
  setInterval(monitor, 20000);
  // Check on page load, but NEVER autoplay or alter the existing radio.
  isOnAir().then(on => {
    if (mode === "idle") show(on
      ? "Station One is on air. Tap LISTEN LIVE to join the shared broadcast."
      : "Station One is offline. LISTEN LIVE will use Long Wave until it returns.");
  });
})();
