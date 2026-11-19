import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const html = readFileSync(new URL("../fm/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../fm/radio.css", import.meta.url), "utf8");
const js = readFileSync(new URL("../fm/live-station.js", import.meta.url), "utf8");

test("original HUMKIN artwork-first receiver is the primary and only audio deck", () => {
  assert(html.includes('<section class="desk unified-radio"'));
  assert(!html.includes('<details class="classic-dial"'));
  assert(!html.includes('id="live-backup"'));
  assert(!html.includes('id="live-retry"'));
  assert(!html.includes("CATCH UP TO AIR"));
  assert(!html.includes('id="catch-up"'));
  for (const id of ["current-art", "current-title", "current-artist",
     "mode-shuffle", "listen", "live-air", "air", "on-deck", "spotlight"]) {
    assert.equal([...html.matchAll(new RegExp('id="' + id + '"',"g"))].length, 1,
      "Missing or duplicate old-player element: " + id);
  }
  assert(html.includes('id="listen" class="listen">▶ LISTEN LIVE'));
  assert(html.includes('id="mode-shuffle"'));
  assert(html.includes('id="mode-clock" aria-pressed="true" hidden'));
  assert(html.includes('id="air" preload="auto" controls hidden'));
  assert(css.includes('.unified-radio audio[hidden]'));
});

test("Live is shared HLS and fallback order is silently managed", () => {
  assert(js.includes('const HLS = route + "live.m3u8"'));
  assert(js.includes('const LONG_WAVE = BASE + "/live.mp3"'));
  assert(js.indexOf('fallbackToLongWave("transmitter_offline"') > 0);
  assert(js.includes('fallbackToClock("longwave_media_error")'));
  assert(js.includes('startSameTimeFallback()'));
  assert(js.includes('startRoadShuffleFromLive()'));
  assert(js.includes('parseCues'));
  assert(!html.includes('LONG WAVE</button>'));
});

test("no autoplay and no invented live title or album art", () => {
  assert(!/<audio[^>]*\sautoplay(?:\s|>)/i.test(html));
  assert(html.includes('src="../cover.jpg"'));
  assert(html.includes("artist") && html.includes("current-title"));
  assert(html.includes("HEAR THE NEW ONE") && html.includes("current-artist"));
  assert(!html.includes("Now spinning 21 songs:"));
});

