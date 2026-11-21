// HUMKIN Field Witness 001 — optional, local-only listener testimony.
// This module NEVER changes audio playback, publishes a program, or uploads a receipt.
import {FREQUENCY, STREAM_URL} from "./night-shift.js";
export const FIELD_SCHEMA = "humkin.field-witness/v1";
export const FIELD_STATION = FREQUENCY;
export const FIELD_STREAM = STREAM_URL;
const TYPES = new Set([
  "media.playing", "media.pause", "media.waiting", "media.stalled", "media.error", "media.ended",
  "human.heard_audio", "human.acer_off", "human.heard_track_change", "human.heard_interruption"
]);
const LIMIT = 200;
const clean = (value, max = 120) => typeof value === "string" ? value.trim().slice(0, max) : "";
const iso = value => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("INVALID_FIELD_TIME");
  return date.toISOString();
};

/** Portable evidence recorder. Time and id injection permit deterministic tests.
 *  All browser observations are local and UNAUTHENTICATED. */
export function createFieldWitness({now = () => new Date().toISOString(), id = "local-" + Date.now().toString(36)} = {}) {
  let begun = null;
  let dropped = 0;
  const events = [];
  function start() {
    if (begun) throw new Error("FIELD_CHECK_ALREADY_STARTED");
    begun = iso(now());
    return begun;
  }
  function record(kind, detail = "") {
    if (!begun) throw new Error("START_FIELD_CHECK_FIRST");
    if (!TYPES.has(kind)) throw new Error("UNRECOGNIZED_WITNESS_EVENT");
    const entry = {at: iso(now()), kind};
    if (clean(detail)) entry.note = clean(detail);
    if (events.length < LIMIT) events.push(entry);
    else dropped++;
    return {...entry};
  }
  function snapshot() {
    if (!begun) throw new Error("START_FIELD_CHECK_FIRST");
    const seen = type => events.some(e => e.kind === type);
    return {
      schema: FIELD_SCHEMA,
      issuer: "local_listener_browser",
      witness_authentication: "NONE",
      transport: "LOCAL_DOWNLOAD_ONLY; NO_UPLOAD",
      station: FIELD_STATION,
      stream_url: FIELD_STREAM,
      started_at: begun,
      exported_at: iso(now()),
      session_id: clean(id, 80),
      evidence_status: "UNVERIFIED_SELF_REPORT_WITH_LOCAL_MEDIA_EVENTS",
      claims: {
        user_reported_hearing_audio: seen("human.heard_audio"),
        user_reported_acer_off: seen("human.acer_off"),
        user_reported_track_change: seen("human.heard_track_change"),
        user_reported_interruption: seen("human.heard_interruption"),
        browser_reported_playing: seen("media.playing"),
        decoded_audio_verified: false,
        independent_http_aircheck_verified: false,
        physical_power_state_verified: false
      },
      events: events.map(e => ({...e})),
      dropped_events: dropped,
      authority: "NO_AUTOMATIC_BROADCAST_OR_LEDGER_ACTION"
    };
  }
  return {start, record, snapshot};
}

// The optional witness attaches passively to the existing Night Shift player.
// Nothing is recorded before the listener explicitly starts the field check.
if (typeof document !== "undefined") {
  const audio = document.getElementById("radio-audio");
  const byId = key => document.getElementById(key);
  const startButton = byId("field-start");
  const saveButton = byId("field-save");
  const status = byId("field-status");
  if (audio && startButton && saveButton && status) {
    let witness = null;
    const actions = {
      "field-heard": "human.heard_audio",
      "field-acer-off": "human.acer_off",
      "field-change": "human.heard_track_change",
      "field-glitch": "human.heard_interruption"
    };
    function note(value) { status.textContent = value; }
    startButton.addEventListener("click", () => {
      if (witness) return;
      witness = createFieldWitness({id: "local-" + (globalThis.crypto?.randomUUID?.() || Date.now().toString(36))});
      witness.start();
      startButton.disabled = true;
      saveButton.disabled = false;
      Object.keys(actions).forEach(key => { byId(key).disabled = false; });
      note("Field check running locally. Tune in and mark only events you personally witnessed.");
    });
    for (const [key, kind] of Object.entries(actions)) {
      byId(key).addEventListener("click", () => {
        if (!witness) return;
        // The label is published metadata, NOT an audio identification.
        const label = kind === "human.heard_track_change"
          ? "published schedule: " + clean(byId("track-title")?.textContent, 90) : "";
        witness.record(kind, label);
        note("Recorded your observation: " + kind.replaceAll("_", " ").replace("human.", "") + ".");
      });
    }
    for (const event of ["playing", "pause", "waiting", "stalled", "error", "ended"]) {
      audio.addEventListener(event, () => {
        if (witness) witness.record("media." + event);
      });
    }
    saveButton.addEventListener("click", () => {
      if (!witness) return;
      const receipt = witness.snapshot();
      const blob = new Blob([JSON.stringify(receipt, null, 2) + "\n"], {type: "application/json"});
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "humkin-field-witness-" + receipt.exported_at.slice(0, 10) + ".json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      note("Receipt saved to your device. This is self-reported field evidence, not independent corroboration.");
    });
  }
}
