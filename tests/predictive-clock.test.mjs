import test from "node:test";
import assert from "node:assert/strict";
import {clockSample, serverNow, prefetchPlan, offlinePosition,
  shouldResyncLive, MAX_PREFETCH_BYTES} from "../fm/predictive-clock.mjs";

const t = 1800000000000;
const item = (id, offset, size=2_000_000) => ({
  id, start_ms: t + offset * 1000, duration_ms: 120000, size_bytes: size,
  status: "committed", offline_license: true,
  url: "https://media.abundent.org/audio/" + id + ".mp3",
  sha256: "a".repeat(64),
});
const schedule = () => ({epoch: "station-one-run-42", revision: 7,
  valid_until_ms: t + 3600000,
  entries: [item("a", 0), item("b", 120), item("c", 240), item("d", 360)]});

test("clock midpoint estimation rejects uncertain or impossible samples", () => {
  const sample = clockSample(t, t+500, t+1000);
  assert.equal(sample.offset_ms, 0);
  assert.equal(sample.uncertainty_ms, 500);
  assert.equal(clockSample(t, t+500, t+3000), null);
  assert.equal(clockSample(t+2, t, t), null);
  assert.equal(serverNow(t+600000, sample), t+600000);
});

test("only 3 license-cleared committed and budgeted tracks are preloaded", () => {
  const clock = clockSample(t-20, t, t+20);
  const planned = prefetchPlan(schedule(), clock, t+20, {allowDownloads:true});
  assert.deepEqual(planned.map(p=>p.id), ["a", "b", "c"]);
  assert.equal(prefetchPlan(schedule(), clock, t+20, {allowDownloads:false}).length, 0);
  const modified = schedule();
  modified.entries[1].offline_license = false;
  modified.entries[2].url = "https://attacker.invalid/x.mp3";
  assert.deepEqual(prefetchPlan(modified, clock, t+20, {allowDownloads:true}).map(p=>p.id), ["a", "d"]);
  const huge = schedule();
  huge.entries[0].size_bytes = MAX_PREFETCH_BYTES+1;
  assert.deepEqual(prefetchPlan(huge, clock, t+20, {allowDownloads:true}).map(p=>p.id), ["b", "c", "d"]);
});

test("offline scheduled playback seeks into cached track and is never labeled live", () => {
  const clock = clockSample(t-20, t, t+20);
  const cached = new Set(["a","b","c"]);
  const offline = offlinePosition(schedule(), cached, clock, t+190000);
  assert.equal(offline.id, "b");
  assert.equal(offline.offset_seconds, 70);
  assert.equal(offline.mode, "offline-scheduled");
  assert.match(offline.label, /not verified live/);
  assert.equal(offlinePosition(schedule(), new Set(["a"]), clock, t+190000), null);
  assert.equal(offlinePosition(schedule(), cached, clock, t+400000), null);
});

test("when programming changes, never pretend cached recording matches current air", () => {
  const saved = {epoch:"station-one-run-42", revision:7};
  assert.equal(shouldResyncLive(saved, {epoch:saved.epoch,revision:7,source:"cached",ready:true}), false);
  assert.equal(shouldResyncLive(saved, {epoch:saved.epoch,revision:8,source:"cached",ready:true}), true);
  assert.equal(shouldResyncLive(saved, {epoch:"new-transmitter",revision:7,source:"cached",ready:true}), true);
  assert.equal(shouldResyncLive(saved, {epoch:saved.epoch,revision:7,source:"live",ready:true}), true);
});
