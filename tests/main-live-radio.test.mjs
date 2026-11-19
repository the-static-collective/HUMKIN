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
  let clock = Date.now();
  class FakeDate extends Date {static now() {return clock;}}
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
    URL, Date: FakeDate, Number, String, Promise, AbortController, TextDecoder, atob,
    fetch: async url => {
      fetchRequests.push(url);
      if (url.endsWith("/hls/status")) {
        stationStatusChecks++;
        if (statusGate) await statusGate;
        return {ok: statusOnline, json: async () =>
          ({on_air: statusOnline, mode: "shared_live_hls", age_seconds: 2})};
      }
      if (url.endsWith("/hls/live.m3u8")) {
        return {ok: Boolean(metadata), text: async () => metadata};
      }
      throw Error("Unexpected network URL: " + url);
    },
    setTimeout: () => 1, clearTimeout() {},
    setInterval: (fn, ms) => {
      if (ms === 20000) monitor = fn;
      if (ms === 5000) pollMetadata = fn;
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
    advance: ms => {clock += ms;},
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

test("receiver uses the buffered media playhead for titles and artwork, then clears on fallback", async () => {
  const art = "https://humkin.abundent.org/releases/everywhere-near-you/cover.jpg";
  function cue(id, at, track) {
    const encoded = Buffer.from(JSON.stringify(track)).toString("base64url");
    return '#EXT-X-DATERANGE:ID="' + id + '",CLASS="org.abundent.humkin.track",START-DATE="' + at + '",X-HUMKIN="' + encoded + '"';
  }
  const origin = "2026-11-18T23:01:";
  const manifest = ["#EXTM3U",
    cue("1", origin + "00.000Z", {title: "Écho", artist: "Fixture", album: "A", artwork: art}),
    cue("2", origin + "15.250Z", {title: "Second", artist: "Fixture"}),
    cue("gap", origin + "22.000Z", null),
    "#EXT-X-PROGRAM-DATE-TIME:" + origin + "00.000Z",
    ...[0, 1, 2].flatMap(number => ["#EXTINF:10,", "segment-" + number + ".ts"])
  ].join("\n");
  const f = fixture();
  f.setMetadata(manifest);
  await f.flush();
  f.click("listen");
  await f.flush();
  function movePlayhead(seconds) {
    f.getHls().playingDate = new Date(Date.parse(origin + "00.000Z") + seconds * 1000);
    f.audio.dispatch("timeupdate");
  }
  const status = f.elements.get("current-title");
  const cover = f.elements.get("current-art");
  movePlayhead(15.2);
  assert.equal(status.textContent, "Écho");
  assert.equal(cover.src, art);
  assert.match(f.elements.get("current-artist").textContent, /Fixture/);
  movePlayhead(15.3);
  assert.equal(status.textContent, "Second");
  assert.equal(cover.src, "https://humkin.abundent.org/cover.jpg");
  movePlayhead(22);
  assert.equal(status.textContent, "HUMKIN RADIO · LIVE");
  movePlayhead(14);
  assert.equal(status.textContent, "Écho");
  f.getHls().fail(null, {fatal: true});
  assert.equal(status.textContent, "HUMKIN RADIO · LIVE");
  assert.equal(cover.src, "https://humkin.abundent.org/cover.jpg");
});


test("a connected but stalled Long Wave source eventually falls to Same-Time", async () => {
  const f = fixture(false);
  await f.flush();
  f.click("listen"); await f.flush();
  assert.equal(f.audio.src, BASE + "/live.mp3");
  f.advance(51000);
  await f.monitor(); await f.flush();
  assert.equal(f.playing.clock, 1);
  assert.equal(f.oldAudio.paused, false);
  assert.equal(f.audio.paused, true);
});

