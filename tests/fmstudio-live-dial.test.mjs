import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createReceiver} from "../fmstudio/receiver/engine.mjs";
import {decodeTrackCue, parseHlsCues, safeArt, skinFor, streamForStation, trackAt, validStationId} from "../fmstudio/receiver/core.mjs";

const dial = readFileSync("fmstudio/dial.js", "utf8");
const html = readFileSync("fmstudio/index.html", "utf8");
const skinCSS = readFileSync("fmstudio/receiver/receiver.css", "utf8");
const skins = JSON.parse(readFileSync("fmstudio/receiver/skins.json", "utf8"));
const BASE = "https://humkin.abundent.org/fmstudio/receiver/skins.json";

test("FM Studio has a native receiver, no iframe, and retains Compost + classic fallback link", () => {
  for (const id of ["stations","station-tune","station-detail","station-registry-status",
    "refresh-stations","listening-room","receiver-mount","close-receiver","compost-audio",
    "compost-rating","monitor","motion"])
    assert.ok(html.includes('id="' + id + '"'), id);
  assert.match(html, /<script type="module" src="\.\/dial\.js"><\/script>/);
  assert.match(html, /receiver\/receiver\.css/);
  assert.match(html, /<script src="\.\/compost\.js"><\/script>/);
  assert.match(dial, /createReceiver\(view\.audio, view\.render\)/);
  assert.match(dial, /document\.dispatchEvent\(new Event\("humkin:station-one"\)\)/);
  assert.match(dial, /humkin:compost-playing/);
  assert.match(dial, /states\.get\(frequency\)\?\.on_air !== true/);
  assert.doesNotMatch(dial + html, /createElement\(["']iframe|receiver-mount iframe|<iframe\b/);
});

test("only validated published frequency IDs reach the HLS endpoint", () => {
  assert.equal(validStationId("station-one"), true);
  assert.equal(validStationId("talk"), true);
  for (const id of ["../../secret", "talk/live.m3u8", "Bad Station", "", "é"])
    assert.equal(validStationId(id), false);
  assert.deepEqual(streamForStation("station-one"), {
    hls: "https://humkin-long-wave.joyvolcanomusic.workers.dev/hls/live.m3u8",
    status: "https://humkin-long-wave.joyvolcanomusic.workers.dev/hls/status",
    longwave: "https://humkin-long-wave.joyvolcanomusic.workers.dev/live.mp3"
  });
  assert.equal(streamForStation("talk").hls,
    "https://humkin-long-wave.joyvolcanomusic.workers.dev/hls/talk/live.m3u8");
  assert.equal(streamForStation("talk").longwave, null,
    "A missing secondary stream must never silently play Station One");
  assert.throws(() => streamForStation("../../steal"), TypeError);
});

test("HLS track titles come only from decodable transmitter DATERANGE cues", () => {
  const cue = {title:"The Actual Song",artist:"HUMKIN",album:"LIVE",artwork:"https://humkin.abundent.org/cover.jpg"};
  const encoded = Buffer.from(JSON.stringify(cue)).toString("base64url");
  const playlist = [
    "#EXTM3U", "#EXT-X-PROGRAM-DATE-TIME:2026-11-19T20:00:00.000Z",
    "#EXTINF:4.0,", "a.ts",
    '#EXT-X-DATERANGE:ID="c1",CLASS="org.abundent.humkin.track",START-DATE="2026-11-19T20:00:01.000Z",X-HUMKIN="' + encoded + '"',
    "#EXTINF:4.0,", "b.ts"
  ].join("\n");
  const parsed = parseHlsCues(playlist);
  assert.equal(decodeTrackCue(encoded).title, cue.title);
  assert.equal(trackAt(parsed, Date.parse("2026-11-19T20:00:02Z")).title, cue.title);
  assert.equal(trackAt(parsed, Date.parse("2026-11-19T19:59:59Z")), null);
  assert.equal(trackAt(parsed, Date.parse("2026-11-19T20:00:09Z")), null);
  assert.equal(parseHlsCues("not a live playlist"), null);
  assert.equal(decodeTrackCue("invalid%encoded"), null);
});

test("station skin files are replaceable art and color data, never playback URLs", () => {
  assert.equal(skins.schema, "humkin.fm.receiver-skins/v1");
  assert.equal(skinFor("night-drive", skins.stations, BASE).layout, "banner");
  assert.equal(skinFor("porch-field", skins.stations, BASE).layout, "portrait");
  assert.equal(skinFor("station-one", skins.stations, BASE).artwork,
    "https://humkin.abundent.org/cover.jpg");
  assert.equal(skinFor("new-frequency", skins.stations, BASE).layout, "console");
  const bad = skinFor("bad", {"bad": {
    accent:"url(javascript:alert(1))", layout:"arbitrary",
    artwork:"javascript:alert(1)", caption:"Z".repeat(150)}}, BASE);
  assert.equal(bad.accent, "#ffe080");
  assert.equal(bad.layout, "console");
  assert.equal(bad.caption.length, 120);
  assert.equal(safeArt("https://evil.example/track.jpg", BASE), safeArt("", BASE));
  for (const slot of ["backgroundArt", "overlayArt", "badgeArt", "artwork"])
    assert.match(readFileSync("fmstudio/receiver/view.mjs","utf8"), new RegExp(slot));
  for (const token of ["--receiver-accent", "--receiver-background", "--receiver-foreground",
    "--receiver-background-image"])
    assert.ok(skinCSS.includes(token), token);
});

class FakeAudio {
  constructor() { this.src = ""; this.paused = true; this.currentTime = 0; this.listeners = new Map(); }
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }
  dispatch(type) { for (const fn of this.listeners.get(type) || []) fn(); }
  canPlayType() { return "maybe"; }
  load() {}
  removeAttribute(name) { if (name === "src") this.src = ""; }
  pause() { this.paused = true; this.dispatch("pause"); }
  play() { this.paused = false; this.dispatch("playing"); return Promise.resolve(); }
}

test("single native audio element retunes, pauses, stops and never uses the iframe", async () => {
  const oldDoc = globalThis.document, oldFetch = globalThis.fetch;
  globalThis.document = {hidden:false, addEventListener() {}};
  globalThis.fetch = async url => ({
    ok:true, json: async () => ({on_air:true}),
    text: async () => "#EXTM3U"
  });
  let receiver;
  try {
    const audio = new FakeAudio(), states = [];
    receiver = createReceiver(audio, state => states.push(state));
    receiver.tune("talk");
    assert.equal(audio.src, streamForStation("talk").hls);
    assert.equal(receiver.state.playing, true);
    receiver.pause();
    assert.equal(receiver.state.playing, false);
    receiver.resume();
    assert.equal(receiver.state.playing, true);
    receiver.tune("station-one");
    assert.equal(audio.src, streamForStation("station-one").hls);
    audio.dispatch("error");
    assert.equal(audio.src, streamForStation("station-one").longwave);
    assert.equal(receiver.state.mode, "longwave");
    receiver.tune("talk");
    audio.dispatch("error");
    assert.equal(receiver.state.mode, "unavailable");
    assert.equal(audio.src, "", "No alternate station can masquerade as this one");
    assert.ok(states.length > 3);
  } finally {
    receiver?.stop();
    globalThis.document = oldDoc;
    globalThis.fetch = oldFetch;
  }
});
