import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const script = new vm.Script(
  readFileSync(new URL("../fm/live-station.js", import.meta.url), "utf8"),
  {filename: "fm/live-station.js"}
);
const BASE = "https://humkin-long-wave.joyvolcanomusic.workers.dev";

function fixture(initialOnline = true, search = "") {
  const elements = new Map();
  let actualPlayCalls = 0, statusOnline = initialOnline, statusGate = null;
  let clock = Date.now();
  class FakeDate extends Date {static now() {return clock;}}
  let stationStatusChecks = 0, metadata = null, hlsPlayer, monitor, pollMetadata;
  let hidden = false, visibilityChanged = () => {};
  const playing = {clock: 0, shuffle: 0, pauses: 0, spotlight: 0};
  let introFinish = null;
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
    "next-song",
    "current-art", "on-deck", "counter", "mode-help", "phone-playlist", "spotlight"
  ]) elements.set(id, element(id));
  const audio = elements.get("live-air");
  const oldAudio = elements.get("air");
  class FakeHls {
    static Events = {ERROR: "error"};
    static isSupported() {return true;}
    constructor() {hlsPlayer = this;}
    loadSource(url) {this.source = url;}
    startLoad() {this.resumed = (this.resumed || 0) + 1;}
    recoverMediaError() {this.recovered = (this.recovered || 0) + 1;}
    attachMedia(media) {this.media = media;}
    on(event, callback) {if (event === "error") this.fail = callback;}
    destroy() {this.destroyed = true;}
  }
  const radio = {
    ready: true,
    stopBrowserAudio() {playing.pauses++; introFinish = null; oldAudio.pause();},
    playSpotlightToLive(onFinished) {
      playing.spotlight++;
      introFinish = onFinished;
      elements.get("current-title").textContent = "HaileyLu Bloom";
      elements.get("current-artist").textContent = "HUMKIN";
      oldAudio.play();
      return true;
    },
    startRoadShuffleFromLive() {
      playing.shuffle++;
      introFinish = null;
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
      get hidden() {return hidden;},
      addEventListener(event, fn) {if (event === "visibilitychange") visibilityChanged = fn;},
      getElementById: id => elements.get(id) || null
    },
    window: {HUMKIN_RADIO: radio, Hls: FakeHls},
    location: {search},
    navigator: {},
    URL, URLSearchParams, Date: FakeDate, Number, String, Promise, AbortController, TextDecoder, atob,
    fetch: async url => {
      fetchRequests.push(url);
      if (url.endsWith("/hls/status") || url.endsWith("/hls/delayed-status")) {
        stationStatusChecks++;
        if (statusGate) await statusGate;
        return {ok: statusOnline, json: async () =>
          ({on_air: statusOnline, mode: url.endsWith("/delayed-status")
            ? "delayed_reservoir_hls" : "shared_live_hls", age_seconds: 2})};
      }
      if (url.endsWith("/hls/live.m3u8") || url.endsWith("/hls/delayed.m3u8")) {
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
    finishSpotlight: () => {
      if (!introFinish) return false;
      const finish = introFinish;
      introFinish = null;
      oldAudio.pause();
      finish();
      return true;
    },
    setOnline: x => {statusOnline = x;},
    setHidden: x => {hidden = x; visibilityChanged();},
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
  f.advance(31000);
  await f.monitor(); await f.flush();
  assert.equal(f.audio.src, BASE + "/live.mp3");
});

test("background status failures do not replace live audio with browser fallback", async () => {
  const f = fixture();
  await f.flush();
  f.click("listen"); await f.flush();
  const player = f.getHls();
  f.setOnline(false);
  f.setHidden(true);
  f.advance(90000);
  await f.monitor(); await f.monitor();
  assert.equal(f.getHls(), player);
  assert.equal(f.audio.src, "");
  assert.equal(f.playing.clock, 0);
  player.fail("error", {fatal: true, type: "networkError"});
  assert.equal(player.destroyed, undefined);
  f.setOnline(true);
  f.setHidden(false);
  assert.equal(player.resumed, 1, "resume the HLS loader on returning to the tab");
  assert.equal(f.audio.src, "");
});

test("live audio progress outranks missing status responses", async () => {
  const f = fixture();
  await f.flush();
  f.click("listen"); await f.flush();
  f.setOnline(false);
  f.advance(19000);
  await f.monitor();
  f.audio.dispatch("timeupdate");
  f.advance(19000);
  await f.monitor();
  assert.equal(f.audio.src, "", "still playing HLS despite two failed probes");
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
    cue("2", origin + "15.250Z", {title: "Second"}),
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
  assert.equal(f.elements.get("current-artist").textContent, "");
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

test("HEAR THE NEW ONE plays its full single before joining Station One", async () => {
  const f = fixture();
  await f.flush();
  f.click("spotlight");
  await f.flush();
  assert.equal(f.playing.spotlight, 1);
  assert.equal(f.elements.get("current-title").textContent, "HaileyLu Bloom");
  assert.equal(f.oldAudio.paused, false);
  assert.equal(f.audio.paused, true);
  assert.equal(f.oldAudio.hidden, false);
  assert.equal(f.elements.get("next-song").hidden, true);
  assert.match(f.elements.get("on-deck").textContent, /STATION ONE LIVE/);
  assert.equal(f.getHls(), undefined, "A live stream must not start mid-song");
  assert.equal(f.finishSpotlight(), true);
  await f.flush();
  assert.equal(f.oldAudio.paused, true);
  assert.equal(f.audio.paused, false);
  assert.equal(f.getHls().source, BASE + "/hls/live.m3u8");
  assert.equal(f.finishSpotlight(), false, "Handoff only occurs once");
});

test("a featured single ends into automatic Long Wave when Acer is offline", async () => {
  const f = fixture(false);
  await f.flush();
  f.click("spotlight");
  assert.equal(f.getHls(), undefined);
  assert.equal(f.finishSpotlight(), true);
  await f.flush();
  assert.equal(f.audio.src, BASE + "/live.mp3");
  assert.equal(f.audio.paused, false);
  assert.equal(f.oldAudio.paused, true);
});

test("switching to Road Shuffle cancels the pending live handoff", async () => {
  const f = fixture();
  await f.flush();
  f.click("spotlight");
  f.click("mode-shuffle");
  await f.flush();
  assert.equal(f.playing.shuffle, 1);
  assert.equal(f.oldAudio.paused, false);
  assert.equal(f.audio.paused, true);
  assert.equal(f.oldAudio.hidden, false);
  assert.equal(f.elements.get("next-song").hidden, false);
  assert.equal(f.finishSpotlight(), false);
  assert.equal(f.getHls(), undefined);
});

test("a manual Listen Live request overrides the featured single immediately", async () => {
  const f = fixture();
  await f.flush();
  f.click("spotlight");
  f.click("listen");
  await f.flush();
  assert.equal(f.oldAudio.paused, true);
  assert.equal(f.audio.paused, false);
  assert.equal(f.getHls().source, BASE + "/hls/live.m3u8");
  assert.equal(f.finishSpotlight(), false);
});


test("reservoir lab explicit query selects delayed feed without altering regular listen live", async () => {
  const f = fixture(true, "?reservoir=lab");
  await f.flush();
  assert.equal(f.fetchRequests[0], BASE + "/hls/delayed-status");
  f.click("listen"); await f.flush();
  assert.equal(f.getHls().source, BASE + "/hls/delayed.m3u8");
  assert.match(f.elements.get("mode-help").textContent, /RESERVOIR LAB/);
  const normal = fixture();
  await normal.flush();
  normal.click("listen"); await normal.flush();
  assert.equal(normal.getHls().source, BASE + "/hls/live.m3u8");
});
