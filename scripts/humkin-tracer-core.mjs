/* HUMKIN TRACER 001 — read-only evidence bridge.
 * A playlist cue is NOT proof a person heard it. Aggregate Compost responses are
 * NOT identities or verified audience size. A proposal is NOT broadcast authority.
 */
import {createHash} from "node:crypto";

export const TRACER_SCHEMA = "humkin.tracer.receipt/v1";
const ID = /^[A-Za-z0-9-]{3,90}$/;
const MAX_BYTES = 1_000_000;

function digest(value) {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}
function safeCount(value) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 ? n : 0;
}
function iso(value) {
  const time = new Date(value);
  if (!Number.isFinite(time.getTime())) throw Error("Invalid timestamp in evidence.");
  return time.toISOString();
}
function text(value, length) {
  return typeof value === "string" ? value.slice(0, length) : "";
}

export function hlsCues(playlist) {
  if (typeof playlist !== "string" || playlist.length > MAX_BYTES ||
      !playlist.startsWith("#EXTM3U") || !playlist.includes("#EXT-X-MEDIA-SEQUENCE:"))
    throw Error("HLS evidence must be a bounded, valid media playlist.");
  const cues = [];
  for (const line of playlist.split(/\r?\n/)) {
    if (!line.startsWith("#EXT-X-DATERANGE:") ||
        !line.includes('CLASS="org.abundent.humkin.track"')) continue;
    const encoded = /(?:^|,)X-HUMKIN="([A-Za-z0-9_-]+)"/.exec(line)?.[1];
    const date = /(?:^|,)START-DATE="([^"]+)"/.exec(line)?.[1];
    if (!encoded || !date || encoded.length > 2048) continue;
    try {
      const decoded = Buffer.from(encoded, "base64url").toString("utf8");
      if (Buffer.from(decoded, "utf8").toString("base64url") !== encoded) continue;
      const track = JSON.parse(decoded);
      if (track && typeof track === "object" && !Array.isArray(track) && ID.test(track.id || "")) {
        cues.push({track_id: track.id, at: iso(date),
          title: text(track.title, 240), artist: text(track.artist, 160)});
      }
    } catch { /* A broken cue cannot establish a broadcast claim. */ }
  }
  return cues;
}
function proposalForTrack(input, id) {
  if (!input) return null;
  const candidates = Array.isArray(input) ? input
    : input.schema === "humkin.signal-relay.export/v1" ? input.proposals : [input];
  if (!Array.isArray(candidates)) throw Error("Invalid proposal export.");
  const matching = candidates.filter(x => x && x.track_id === id);
  if (!matching.length) return null;
  for (const x of matching) {
    if (x.schema !== "humkin.signal-relay.proposal/v1" ||
        x.broadcast_status !== "not_published_by_relay" ||
        !["saved_proposal", "opened_paused_editor"].includes(x.action))
      throw Error("A proposal has an unsupported claim or status.");
  }
  const last = matching.at(-1);
  return {action: last.action, at: iso(last.at), suggested_lane: text(last.suggested_lane, 80)};
}
/** Combine operator-supplied snapshots; do not query, publish or mutate any station. */
export function makeTracerReceipt({trackId, catalog, playlist = null, proposals = null,
                                  acquiredAt = new Date().toISOString(),
                                  source = "operator_files", frequency = "station-one"}) {
  if (typeof trackId !== "string" || !ID.test(trackId))
    throw Error("Specify an exact public catalog recording ID.");
  if (!["operator_files", "live_public_fetch"].includes(source))
    throw Error("Unsupported evidence source.");
  if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(frequency))
    throw Error("Invalid station frequency.");
  if (!catalog || !Array.isArray(catalog.tracks) || !Array.isArray(catalog.scores))
    throw Error("A complete public Compost catalog and scores snapshot is required.");
  const found = catalog.tracks.filter(t => t && t.id === trackId);
  if (found.length !== 1) throw Error("Recording is missing or ambiguous in the public catalog.");
  const track = found[0];
  if (typeof track.src !== "string" || !track.src.startsWith("https://") ||
      !Number.isFinite(Number(track.duration)) || Number(track.duration) <= 0)
    throw Error("Public catalog record is incomplete.");
  const tally = catalog.scores.filter(s => s && s.id === trackId);
  if (tally.length > 1) throw Error("Conflicting aggregate rows for recording.");
  const score = tally[0] || {};
  const fromPlaylist = playlist === null ? [] : hlsCues(playlist);
  const foundCues = fromPlaylist.filter(c => c.track_id === trackId);
  const cue = foundCues.at(-1) || null;
  const proposal = proposalForTrack(proposals, trackId);
  const events = [
    {type: "catalog.listing_observed", status: "listed_in_public_snapshot",
      evidence_sha256: digest(catalog), track_id: trackId,
      detail: {kind: text(track.kind, 40), title: text(track.title, 240),
        artist: text(track.artist, 160)}},
    {type: "transmitter.cue_observed",
      status: cue ? "present_in_hls_window" : playlist === null ? "not_supplied" : "not_in_hls_window",
      evidence_sha256: playlist === null ? null : digest(playlist),
      detail: cue ? {frequency, at: cue.at, title: cue.title, artist: cue.artist} : {frequency}},
    {type: "listener.aggregate_observed", status: "pseudonymous_aggregate_only",
      evidence_sha256: digest(catalog), detail: {plays: safeCount(score.plays),
        ratings: safeCount(score.ratings), dance: safeCount(score.dance)}},
    {type: "editorial.proposal_observed", status: proposal ? "operator_local_unverified" : "not_supplied",
      evidence_sha256: proposals === null ? null : digest(proposals), detail: proposal},
    {type: "release.handoff", status: "not_authorized_or_executed", detail: null}
  ];
  return {
    schema: TRACER_SCHEMA, recording_id: trackId, acquired_at: iso(acquiredAt),
    source, frequency, events,
    claims: {
      transmitted_audio_verified: false, // the manifest alone cannot prove playback at the receiver
      human_listener_verified: false,     // Compost aggregates are not unique verified people
      owner_approval_verified: false,     // an exported browser receipt is not an authorization
      rights_reverified: false,
      station_programming_changed: false, release_or_print_created: false
    },
    next_gate: cue ? "verify playback on a second device; owner reviews paused proposal" :
      "verify real Acer HLS playout and a matching cue on a second device"
  };
}
