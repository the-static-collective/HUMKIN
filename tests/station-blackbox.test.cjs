const assert = require("node:assert/strict");
const fs = require("node:fs");
const {createRecorder, safeDetail} = require("../fm/black-box.js");
const clock = () => "2026-11-17T20:00:00.000Z";
const recorder = createRecorder({maxEvents: 3, now: clock});
assert.equal(recorder.record("unknown_event", {message: "secrets"}), false);
assert.equal(recorder.record("boot_ready", {mode: "clock", song_count: 152, token: "BAD"}), true);
assert.equal(recorder.record("source_select", {
  track_id: "crate-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", mode: "clock",
  url: "https://example.org/?password=supersecret", reason: "automatic"
}), true);
recorder.record("audio_error", {
  audio_code: 4, track_id: "secret?password=example", error: "private payload"
});
recorder.record("report_signal", {reason: "manual"});
const result = recorder.report();
assert.equal(result.schema, "humkin.radio.blackbox/v1");
assert.equal(result.event_count, 3, "ring buffer is bounded");
assert.deepEqual(result.events.map(e => e.event),
  ["source_select", "audio_error", "report_signal"]);
const serialized = JSON.stringify(result);
assert(!serialized.includes("supersecret") && !serialized.includes("private payload"));
assert(!serialized.includes("secret?password"));
assert(!serialized.includes("token"));
assert.deepEqual(safeDetail({mode: "hacked", kind: "song", duration_s: -1,
  track_id: "safe-id", reason: "custom"}), {track_id: "safe-id", kind: "song"});
assert.equal(result.events[0].reason, "automatic");
const html = fs.readFileSync("fm/index.html", "utf8");
const script = fs.readFileSync("fm/radio.js", "utf8");
const sw = fs.readFileSync("sw.js", "utf8");
assert(html.includes('id="report-signal"'));
assert(html.indexOf('./black-box.js') < html.indexOf('./radio.js'));
assert(script.includes('HUMKIN_BLACK_BOX'));
assert(sw.includes('"./fm/black-box.js"'));
console.log("Station Black Box: bounded, no telemetry, opt-in export.");
