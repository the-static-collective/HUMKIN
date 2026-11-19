import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const script = new vm.Script(
  readFileSync(new URL("../fm/live-station.js", import.meta.url), "utf8"),
  { filename: "fm/live-station.js" }
);
const BASE = "https://humkin-long-wave.joyvolcanomusic.workers.dev";

function fixture(initialOnline = true) {
  const elements = new Map();
  function element(id) {
    return {
      id, handlers: {}, hidden: id === "live-retry", paused: true,
      value: "", textContent: "", src: "", pressed: "",
      classList: { toggle() {} },
      addEventListener(event, fn) { (this.handlers[event] ??= []).push(fn); },
      dispatch(event) { for (const fn of this.handlers[event] || []) fn(); },
      setAttribute(key, value) { this[key] = value; },
      removeAttribute(name) { if (name === "src") this.src = ""; },
      load() {},
      pause() { this.paused = true; this.dispatch("pause"); },
      play() {
        this.paused = false;
        this.dispatch("play");
        this.dispatch("playing");
        return Promise.resolve();
      },
      canPlayType() { return ""; }
    };
  }
  for (const id of [
    "air","live-air","live-listen","live-backup","live-retry","live-status",
    "live-signal","live-source",
    "listen","spotlight","catch-up","next-song","mode-clock","mode-shuffle"
  ]) elements.set(id, element(id));
  const oldAudio = elements.get("air");
  const audio = elements.get("live-air");
  let online = initialOnline, requests = [], watchdog, hlsPlayer;
  class FakeHls {
    static isSupported() { return true; }
    static Events = { ERROR: "error" };
    constructor() { hlsPlayer = this; }
    loadSource(url) { this.source = url; }
    attachMedia(media) { this.media = media; }
    on(event, handler) { if (event === "error") this.fail = handler; }
    destroy() { this.destroyed = true; }
  }
  let holdFetch = null;
  const context = {
    document: { getElementById: id => elements.get(id) || null, title: "HUMKIN RADIO" },
    window: { Hls: FakeHls },
    fetch: async url => {
      requests.push(url);
      if (holdFetch) await holdFetch;
      return {
        ok: online,
        json: async () => ({
          on_air: online, mode: "shared_live_hls", age_seconds: 2
        })
      };
    },
    AbortController, Promise,
    setTimeout: () => 1, clearTimeout() {},
    setInterval: fn => { watchdog = fn; return 2; }
  };
  script.runInNewContext(context, { timeout: 1000 });
  const click = id => elements.get(id).dispatch("click");
  const flush = async () => {
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));
  };
  return {
    elements, oldAudio, audio, click, flush,
    setOnline: value => { online = value; },
    getRequests: () => requests,
    monitor: () => watchdog(),
    getHls: () => hlsPlayer,
    deferFetch: promise => { holdFetch = promise; }
  };
}

test("initial load probes status but neither player autoplays", async () => {
  const f = fixture();
  await f.flush();
  assert.equal(f.audio.paused, true);
  assert.equal(f.oldAudio.paused, true);
  assert.match(f.elements.get("live-status").textContent, /Station One is on air/);
  assert.equal(f.getRequests()[0], BASE + "/hls/status");
});

test("live button joins the verified HLS signal and pauses classic dial", async () => {
  const f = fixture();
  await f.flush();
  await f.oldAudio.play();
  f.click("live-listen");
  await f.flush();
  assert.equal(f.getHls().source, BASE + "/hls/live.m3u8");
  assert.equal(f.audio.paused, false);
  assert.equal(f.oldAudio.paused, true);
  assert.equal(f.elements.get("live-listen")["aria-pressed"], "true");
});

test("offline live request plays Long Wave, not a broken HLS URL", async () => {
  const f = fixture(false);
  await f.flush();
  f.click("live-listen");
  await f.flush();
  assert.equal(f.audio.src, BASE + "/live.mp3");
  assert.equal(f.audio.paused, false);
  assert.match(f.elements.get("live-status").textContent, /Long Wave/);
  assert.equal(f.getHls(), undefined);
});

test("two status failures rescue already playing live audio", async () => {
  const f = fixture();
  await f.flush();
  f.click("live-listen");
  await f.flush();
  f.setOnline(false);
  await f.monitor();
  assert.notEqual(f.audio.src, BASE + "/live.mp3");
  await f.monitor();
  await f.flush();
  assert.equal(f.audio.src, BASE + "/live.mp3");
  assert.equal(f.audio.paused, false);
});

test("fatal HLS error rescues and never requires user to reenter URL", async () => {
  const f = fixture();
  await f.flush();
  f.click("live-listen"); await f.flush();
  const player = f.getHls();
  player.fail("error", { fatal: true });
  await f.flush();
  assert.equal(player.destroyed, true);
  assert.equal(f.audio.src, BASE + "/live.mp3");
  assert.equal(f.audio.paused, false);
});

test("classic play stops HLS before a second receiver can play", async () => {
  const f = fixture();
  await f.flush();
  f.click("live-listen"); await f.flush();
  const player = f.getHls();
  await f.oldAudio.play();
  assert.equal(f.audio.paused, true);
  assert.equal(player.destroyed, true);
});

test("classic selection invalidates an in-flight live check", async () => {
  const f = fixture();
  await f.flush();
  let release;
  f.deferFetch(new Promise(resolve => { release = resolve; }));
  f.click("live-listen");
  f.click("mode-shuffle");
  release();
  await f.flush();
  assert.equal(f.audio.paused, true);
  assert.equal(f.getHls(), undefined);
});

test("listener can manually retry live after an offline backup", async () => {
  const f = fixture(false);
  await f.flush();
  f.click("live-listen"); await f.flush();
  f.setOnline(true);
  f.click("live-retry"); await f.flush();
  assert.equal(f.getHls().source, BASE + "/hls/live.m3u8");
  assert.equal(f.elements.get("live-retry").hidden, true);
});

test("the page displays verified transmitter age without inventing a song title", async () => {
  const f = fixture();
  await f.flush();
  assert.match(f.elements.get("live-signal").textContent, /TRANSMITTER ON AIR/);
  assert.match(f.elements.get("live-signal").textContent, /Updated 2s ago/);
  f.click("live-listen"); await f.flush();
  assert.equal(f.elements.get("live-source").textContent,
    "SOURCE · STATION ONE / SHARED LIVE HLS");
  assert.match(f.elements.get("live-listen").textContent, /PAUSE STATION ONE/);
  assert.doesNotMatch(f.elements.get("live-source").textContent, /Song/);
});

test("fallback distinctly labels unsynchronized personal radio", async () => {
  const f = fixture(false);
  await f.flush();
  assert.match(f.elements.get("live-signal").textContent, /NO FRESH/);
  f.click("live-listen"); await f.flush();
  assert.equal(f.elements.get("live-source").textContent,
    "SOURCE · LONG WAVE / PERSONAL MP3 ROTATION");
  assert.equal(f.audio.src, BASE + "/live.mp3");
});

test("switching to legacy radio labels the source separately", async () => {
  const f = fixture();
  await f.flush();
  f.click("live-listen"); await f.flush();
  f.click("mode-shuffle");
  assert.match(f.elements.get("live-source").textContent, /BROWSER DIAL/);
  assert.equal(f.audio.paused, true);
});
