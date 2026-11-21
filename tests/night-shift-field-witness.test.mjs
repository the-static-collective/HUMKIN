import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createFieldWitness, FIELD_SCHEMA, FIELD_STATION, FIELD_STREAM} from "../fm/night-shift/field-witness.mjs";
import {STREAM_URL} from "../fm/night-shift/night-shift.js";
const instant = "2026-11-21T15:00:00Z";
const recorder = () => createFieldWitness({now: () => instant, id:"test-device"});

test("requires an opt-in start and refuses unrecognized events", () => {
  const w = recorder();
  assert.throws(() => w.record("media.playing"), /START_FIELD_CHECK_FIRST/);
  assert.throws(() => w.snapshot(), /START_FIELD_CHECK_FIRST/);
  w.start();
  assert.throws(() => w.start(), /ALREADY_STARTED/);
  assert.throws(() => w.record("human.proved_radio"), /UNRECOGNIZED/);
});

test("manual testimony cannot promote media events into physical or audio proof", () => {
  const w = recorder();
  w.start();
  w.record("media.playing");
  const before = w.snapshot();
  assert.equal(before.claims.browser_reported_playing, true);
  assert.equal(before.claims.user_reported_hearing_audio, false);
  assert.equal(before.claims.physical_power_state_verified, false);
  assert.equal(before.claims.independent_http_aircheck_verified, false);
  w.record("human.heard_audio");
  w.record("human.acer_off");
  w.record("human.heard_track_change", "published schedule: Example");
  const after = w.snapshot();
  assert.equal(after.schema, FIELD_SCHEMA);
  assert.equal(after.station, FIELD_STATION);
  assert.equal(after.stream_url, FIELD_STREAM);
  assert.equal(FIELD_STREAM, STREAM_URL);
  assert.equal(after.claims.user_reported_hearing_audio, true);
  assert.equal(after.claims.user_reported_acer_off, true);
  assert.equal(after.claims.user_reported_track_change, true);
  assert.equal(after.claims.decoded_audio_verified, false);
  assert.equal(after.claims.physical_power_state_verified, false);
  assert.equal(after.witness_authentication, "NONE");
  assert.equal(after.transport.includes("NO_UPLOAD"), true);
});

test("returned snapshots cannot rewrite recorded event history", () => {
  const w = recorder(); w.start(); w.record("media.playing");
  const first = w.snapshot();
  first.events[0].kind = "human.acer_off";
  assert.equal(w.snapshot().events[0].kind, "media.playing");
});

test("event sizes are bounded and invalid timestamps fail closed", () => {
  const w = recorder(); w.start();
  for (let n=0; n<220; n++) w.record("media.waiting", "x".repeat(500));
  const snap = w.snapshot();
  assert.equal(snap.events.length, 200);
  assert.equal(snap.dropped_events, 20);
  assert.equal(snap.events[0].note.length, 120);
  const wrong = createFieldWitness({now:()=>"not-a-date"});
  assert.throws(() => wrong.start(), /INVALID_FIELD_TIME/);
});

test("the receiver has an optional witness panel without changing its player code", () => {
  const html = readFileSync(new URL("../fm/night-shift/index.html", import.meta.url), "utf8");
  assert.match(html, /src="\.\/field-witness\.mjs"/);
  for (const id of ["field-start", "field-heard", "field-acer-off", "field-change", "field-glitch", "field-save", "field-status"])
    assert.match(html, new RegExp('id="' + id + '"'));
  assert.match(html, /LOCAL.*NO UPLOAD/i);
});
