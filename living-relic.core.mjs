// HUMKIN Living Relay 001: deterministic, no-network, proposal-only kernel.
// The public fixture below never supplies real-world confirmation authority.
export const SCHEMA = "humkin/living-relic-v0";
const IDENT = /^[a-z0-9][a-z0-9-]{1,63}$/;
const MIDI_SCALE = [0, 2, 4, 7, 9];
function fail(message) { throw new Error("Living Relic: " + message); }
function id(value, label) {
  if (typeof value !== "string" || !IDENT.test(value)) fail("invalid " + label);
  return value;
}
function isRecord(value) { return value && typeof value === "object" && !Array.isArray(value); }
function checkText(value, label, limit = 600) {
  if (typeof value !== "string" || value.length > limit) fail("invalid " + label);
}
export function validateRelic(doc) {
  if (!isRecord(doc) || doc.schema !== SCHEMA) fail("unexpected schema");
  id(doc.relic_id, "relic id");
  if (!Array.isArray(doc.revisions) || !doc.revisions.length || doc.revisions.length > 100) fail("missing revisions");
  const seen = new Set();
  for (let i = 0; i < doc.revisions.length; i++) {
    const r = doc.revisions[i];
    if (!isRecord(r)) fail("invalid revision");
    id(r.id, "revision id");
    if (seen.has(r.id)) fail("duplicate revision");
    if (i === 0 ? r.parent !== null : r.parent !== doc.revisions[i - 1].id) fail("broken revision lineage");
    seen.add(r.id);
    checkText(r.title, "revision title", 100);
    checkText(r.message, "revision message");
    if (!Array.isArray(r.songs) || r.songs.length > 5) fail("invalid songs");
    for (const song of r.songs) {
      if (!isRecord(song)) fail("invalid song");
      checkText(song.title, "song title", 120);
      if (typeof song.href !== "string" || !/^\.\/audio\/[a-zA-Z0-9_.-]+\.mp3$/.test(song.href)) fail("unsafe song path");
    }
  }
  if (!seen.has(doc.current_revision) || doc.current_revision !== doc.revisions[doc.revisions.length - 1].id) fail("invalid current revision");
  if (!Array.isArray(doc.events) || doc.events.length > 50) fail("invalid events");
  const events = new Map();
  for (const event of doc.events) {
    if (!isRecord(event)) fail("invalid event");
    id(event.id, "event id");
    if (events.has(event.id)) fail("duplicate event");
    if (!["gift.reported", "gift.confirmed"].includes(event.type)) fail("invalid event type");
    if (event.mode !== "synthetic") fail("only synthetic fixture events are supported in v0");
    events.set(event.id, event);
  }
  for (const event of events.values()) {
    if (event.type === "gift.confirmed") {
      const source = events.get(event.report_id);
      if (!source || source.type !== "gift.reported") fail("orphan confirmation");
    }
  }
  return doc;
}
export function getRevision(doc, revisionId) {
  validateRelic(doc);
  const selected = revisionId || doc.current_revision;
  return doc.revisions.find(r => r.id === selected) || fail("unknown revision");
}
function fingerprint(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
export function deriveConsequences(doc, confirmationId, { enableFixtureConfirmation = true } = {}) {
  validateRelic(doc);
  const event = doc.events.find(e => e.id === confirmationId);
  if (!enableFixtureConfirmation || !event || event.type !== "gift.confirmed" ||
      event.recipient_confirmed !== true || event.publisher_approved !== true) {
    return { accepted: false, reason: "HOLD: no explicitly admitted confirmation" };
  }
  const report = doc.events.find(e => e.id === event.report_id && e.type === "gift.reported");
  if (!report) return { accepted: false, reason: "HOLD: report unavailable" };
  const seed = fingerprint(doc.relic_id + "|" + event.id + "|" + report.id);
  const notes = Array.from({ length: 8 }, (_, i) =>
    60 + MIDI_SCALE[(seed >>> ((i % 6) * 5)) % MIDI_SCALE.length] + (i > 4 ? 12 : 0));
  const durations = [0.26, 0.27, 0.38, 0.3, 0.27, 0.36, 0.28, 0.8];
  const suffix = seed.toString(16).padStart(8, "0");
  return {
    accepted: true,
    mode: "SYNTHETIC_FIXTURE_ONLY",
    report_id: report.id,
    confirmation_id: event.id,
    game: {
      kind: "outpost.capacity-seed-proposal",
      id: "seed-" + suffix,
      status: "HELD_NOT_APPLIED",
      description: "A possible gift-born capacity; no game state was changed"
    },
    music: {
      kind: "original-motif-proposal",
      id: "motif-" + suffix,
      status: "HELD_NOT_ON_AIR",
      seed: suffix,
      midi_notes: notes,
      durations_seconds: durations,
      source_class: "proposal-not-a-recording",
      description: "Original algorithmic motif, not a Haunted Phonograph render or broadcast"
    }
  };
}
export function fixedRelicUrl(relicId, origin = "https://humkin.abundent.org/") {
  id(relicId, "relic id");
  return new URL("living-relic.html?id=" + relicId, origin).href;
}
