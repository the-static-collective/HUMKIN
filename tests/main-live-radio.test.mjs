import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const script = new vm.Script(
  readFileSync(new URL("../fm/live-station.js", import.meta.url), "utf8"),
  {filename: "fm/live-station.js"}
);
const BASE = "https://humkin-long-wave.joyvolcanomusic.workers.dev";

function fixture(initialOnline = true) {
  const elements = new Map();
  let actualPlayCalls = 0, statusOnline = initialOnline, statusGate = null;
  let stationStatusChecks = 0, metadata = null, hlsPlayer, monitor, pollMetadata;
  const playing = {clock: 0, shuffle: 0, pauses: 0};
  function element(id) {
    return {
      id, handlers: {}, hidden: id === "air" || id === "mode-clock",
      paused: true, disabled: false, textContent: "", src: "", alt: "",
      classList: {toggle() {}},
      addEventListener(event, fn) {(this.handlers[event] ??= []).push(fn);},
      dispatch(event, args) {for (const fn of this.handlers[event] || []) fn(args);},
      setAttribute(key, value) {this[key] = value;},
      removeAttribute(key) {if (key === "src") this.src = "";},
      load() {},
      pause() {this.paused = true; this.dispatch("pause");},
      play() {
        actualPlayCalls++;
        this.paused = false;
        this.dispatch("play");
        this.dispatch("playing");
        return Promise.resolve();
      },
      canPlayType() {return "";}
    };
  }
  for (const id of [
    "listen", "mode-shuffle", "live-air", "air", "station-status", "live-status",
    "live-signal", "live-source", "current-title", "current-artist",
    "current-art", "on-deck", "counter", "mode-help", "phone-playlist", "spotlight"
  ]) elements.set(id, element(id));
  const audio = elements.get("live-air");
  const oldAudio = elements.get("air");
  class FakeHls {
    static Events = {ERROR: "error"};
    static isSupported() {return true;}
    constructor() {hlsPlayer = this;}
    loadSource(url) {this.source = url;}
    attachMedia(media) {this.media = media;}
    on(event, callback) {if (event === "error") this.fail = callback;}
    destroy() {this.destroyed = true;}
  }
  const radio = {
    ready: true,
    stopBrowserAudio() {playing.pauses++; oldAudio.pause();},
    startRoadShuffleFromLive() {
      playing.shuffle++;
      oldAudio.play();
      return true;
    },
    startSameTimeFallback() {
      playing.clock++;
      oldAudio.play();
      return true;
    }
  };
  const fetchRequests = [];
  const ctx = {
    document: {
      baseURI: "https://humkin.abundent.org/fm/",
      title: "HUMKIN RADIO",
      getElementById: id => elements.get(id) || null
    },
    window: {HUMKIN_RADIO: radio, Hls: FakeHls},
    navigator: {},
    URL, Date, Number, String, Promise, AbortController,
    fetch: async url => {
      fetchRequests.push(url);
      if (url.endsWith("/hls/status")) {
        stationStatusChecks++;
        if (statusGate) await statusGate;
        return {ok: statusOnline, json: async () =>
          ({on_air: statusOnline, mode: "shared_live_hls", age_seconds: 2})};
      }
      if (url.endsWith("/hls/now-playing")) {
        return {ok: Boolean(metadata), json: async () => metadata};
      }
      throw Error("Unexpected network URL: " + url);
    },
    setTimeout: () => 1, clearTimeout() {},
    setInterval: (fn, ms) => {
      if (ms === 20000) monitor = fn;
      if (ms === 15000) pollMetadata = fn;
      return ms;
    }
  };
  script.runInNewContext(ctx, {timeout: 1000});
  const flush = async () => {
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));
  };
  return {
    elements, audio, oldAudio, radio, playing, flush, fetchRequests,
    click: id => elements.get(id).dispatch("click"),
    setOnline: x => {statusOnline = x;},
    getHls: () => hlsPlayer,
    getPlayCalls: () => actualPlayCalls,
    checks: () => stationStatusChecks,
    monitor: () => monitor(),
    pollMetadata: () => pollMetadata(),
    setMetadata: data => {metadata = data;},
    holdStatus: promise => {statusGate = promise;},
    get title() {return ctx.document.title;}
  };
}

test("page checks the transmitter without auto-playing any layer", async () => {
  const f = fixture();
  await f.flush();
  assert.equal(f.getPlayCalls(), 0);
  assert.equal(f.oldAudio.hidden, true);
  assert.equal(f.audio.hidden, false);
  assert.equal(f.elements.get("current-title").textContent, "HUMKIN RADIO · LIVE");
  assert.equal(f.elements.get("listen").textContent, "▶ LISTEN LIVE");
  assert.equal(f.elements.get("mode-shuffle").textContent, "⤨ ROAD SHUFFLE");
  assert.equal(f.fetchRequests[0], BASE + "/hls/status");
});

test("Listen Live connects HLS on one visible player while keeping old engine quiet", async () => {
  const f = fixture();
  await f.flush();
  f.click("listen"); await f.flush();
  assert.equal(f.getHls().source, BASE + "/hls/live.m3u8");
  assert.equal(f.oldAudio.paused, true);
  assert.equal(f.audio.paused, false);
  assert.equal(f.audio.hidden, false);
  assert.equal(f.oldAudio.hidden, true);
  assert.match(f.elements.get("listen").textContent, /PAUSE RADIO/);
});

test("transmitter offline uses invisible Long Wave backup", async () => {
  const f = fixture(false);
  await f.flush();
  f.click("listen"); await f.flush();
  assert.equal(f.audio.src, BASE + "/live.mp3");
  assert.equal(f.audio.paused, false);
  assert.equal(f.oldAudio.paused, true);
  assert.equal(f.getHls(), undefined);
  assert.doesNotMatch(f.elements.get("live-status").textContent, /Long Wave/i);
  assert.doesNotMatch(f.elements.get("listen").textContent, /Long Wave/i);
});

test("broken Long Wave falls through to browser Same-Time radio", async () => {
  const f = fixture(false);
  await f.flush();
  f.click("listen"); await f.flush();
  f.audio.dispatch("error");
  await f.flush();
  assert.equal(f.playing.clock, 1);
  assert.equal(f.oldAudio.paused, false);
  assert.equal(f.audio.paused, true);
  assert.equal(f.audio.hidden, true);
  assert.equal(f.oldAudio.hidden, false);
  assert.doesNotMatch(f.elements.get("live-status").textContent, /Same-Time|Long Wave/i);
});

test("fatal HLS player error silently switches to continuous MP3 backup", async () => {
  const f = fixture();
  await f.flush();
  f.click("listen"); await f.flush();
  const player = f.getHls();
  player.fail("error", {fatal: true});
  await f.flush();
  assert.equal(player.destroyed, true);
  assert.equal(f.audio.src, BASE + "/live.mp3");
  assert.equal(f.playing.clock, 0);
});

test("stale transmitter requires two checks before falling back", async () => {
  const f = fixture();
  await f.flush();
  f.click("listen"); await f.flush();
  f.setOnline(false);
  await f.monitor();
  assert.notEqual(f.audio.src, BASE + "/live.mp3");
  await f.monitor(); await f.flush();
  assert.equal(f.audio.src, BASE + "/live.mp3");
});

test("Road Shuffle stops the live decoder and keeps original browser player", async () => {
  const f = fixture();
  await f.flush();
  f.click("listen"); await f.flush();
  const player = f.getHls();
  f.click("mode-shuffle"); await f.flush();
  assert.equal(player.destroyed, true);
  assert.equal(f.audio.paused, true);
  assert.equal(f.oldAudio.paused, false);
  assert.equal(f.audio.hidden, true);
  assert.equal(f.oldAudio.hidden, false);
  assert.equal(f.playing.shuffle, 1);
  assert.equal(f.elements.get("listen").textContent, "▶ LISTEN LIVE");
});

test("Listen Live can rejoin the transmitter from Road Shuffle", async () => {
  const f = fixture();
  await f.flush();
  f.click("mode-shuffle"); await f.flush();
  assert.equal(f.oldAudio.paused, false);
  f.click("listen"); await f.flush();
  assert.equal(f.oldAudio.paused, true);
  assert.equal(f.audio.paused, false);
  assert.equal(f.getHls().source, BASE + "/hls/live.m3u8");
});

test("stale asynchronous HLS status cannot retune after Road Shuffle was selected", async () => {
  const f = fixture();
  await f.flush();
  let release;
  f.holdStatus(new Promise(resolve => {release = resolve;}));
  f.click("listen");
  f.click("mode-shuffle");
  release(); await f.flush();
  assert.equal(f.audio.paused, true);
  assert.equal(f.oldAudio.paused, false);
  assert.equal(f.getHls(), undefined);
});

test("verified Acer metadata updates live artist and cover; stale data cannot", async () => {
  const f = fixture();
  await f.flush();
  const meta = {
    schema: "humkin.station-one.now-playing/v1",
    updated_at: new Date().toISOString(),
    track: {
      title: "True Blue Garden", artist: "Eno Efia", album: "Unshackled Dreams",
      artwork_url: "https://humkin.abundent.org/cover.jpg"
    }
  };
  f.setMetadata(meta);
  f.click("listen"); await f.flush();
  assert.equal(f.elements.get("current-title").textContent, "True Blue Garden");
  assert.match(f.elements.get("current-artist").textContent, /Eno Efia/);
  f.setMetadata({...meta, updated_at: "2020-01-01T00:00:00Z",
    track: {...meta.track, title: "Stale Song"}});
  await f.pollMetadata(); await f.flush();
  assert.equal(f.elements.get("current-title").textContent, "True Blue Garden");
});
