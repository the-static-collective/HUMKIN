/* HUMKIN Cloud Autopilot laboratory.
 * The computer publishes an approved, immutable-segment program; the Worker
 * reads it. Every listener gets the same clock-addressed HLS timeline.
 * No credentials, persistent worker timers, or Acer availability required.
 */
export const PROGRAM_SCHEMA = "humkin.cloud-autopilot/v1";
export const PATH_RE = /^\/autopilot\/([a-z0-9][a-z0-9-]{0,31})\/(live\.m3u8|status|now-playing|segments\/([0-9a-f]{64})\/segment-([0-9]{6})\.ts)$/;
const HASH = /^[0-9a-f]{64}$/;
const ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
const MAX_REVISIONS = 32, MAX_TRACKS = 500, MAX_SEGMENTS = 10000;
const PLAYOUT_LAG_MS = 15000;
const WINDOW_SEGMENTS = 6;

function requireValue(condition, reason) {
  if (!condition) throw new Error(reason);
}
function string(value, max = 160) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function timestamp(raw) {
  requireValue(typeof raw === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(raw), "INVALID_TIME");
  const value = Date.parse(raw);
  requireValue(Number.isFinite(value), "INVALID_TIME");
  return value;
}
function buildRevision(raw) {
  requireValue(raw && ID.test(raw.id), "INVALID_REVISION_ID");
  const epoch = timestamp(raw.effective_at);
  requireValue(Array.isArray(raw.tracks) && raw.tracks.length > 0 && raw.tracks.length <= MAX_TRACKS, "INVALID_TRACKS");
  let offset = 0, trackBeginnings = 0, maxSegment = 0;
  const segments = [];
  const tracks = [];
  for (const row of raw.tracks) {
    requireValue(row && ID.test(row.id) && HASH.test(row.asset_sha), "INVALID_ASSET_ID");
    requireValue(Array.isArray(row.durations_ms) && row.durations_ms.length > 0, "INVALID_SEGMENTS");
    requireValue(segments.length + row.durations_ms.length <= MAX_SEGMENTS, "SEGMENT_LIMIT");
    const track = {id: row.id, title: string(row.title), artist: string(row.artist),
      album: string(row.album), artwork: string(row.artwork, 1000), asset_sha: row.asset_sha};
    requireValue(track.title.length > 0 && row.durations_ms.length <= 999999, "INVALID_TRACK_METADATA");
    tracks.push(track);
    for (let i = 0; i < row.durations_ms.length; i++) {
      const duration = row.durations_ms[i];
      requireValue(Number.isInteger(duration) && duration >= 250 && duration <= 11000, "INVALID_DURATION");
      maxSegment = Math.max(maxSegment, duration);
      segments.push({offset, duration, track, trackIndex: tracks.length - 1,
        index: i, asset: row.asset_sha, discIndex: trackBeginnings});
      offset += duration;
    }
    trackBeginnings++;
  }
  requireValue(offset > 0 && offset <= 7 * 24 * 3600 * 1000, "INVALID_CYCLE_LENGTH");
  return {id: raw.id, epoch, tracks, segments, cycleMs: offset,
    discontinuitiesPerCycle: tracks.length, maxSegment, baseSeq: 0, baseDisc: 0};
}
function locationInRevision(rev, time) {
  const elapsed = time - rev.epoch;
  if (elapsed < 0) return null;
  const cycle = Math.floor(elapsed / rev.cycleMs);
  const pos = elapsed % rev.cycleMs;
  let lo = 0, hi = rev.segments.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (rev.segments[mid].offset <= pos) lo = mid + 1;
    else hi = mid - 1;
  }
  const index = Math.max(0, hi), segment = rev.segments[index];
  return {...segment, start: rev.epoch + cycle * rev.cycleMs + segment.offset,
    end: rev.epoch + cycle * rev.cycleMs + segment.offset + segment.duration,
    sequence: rev.baseSeq + cycle * rev.segments.length + index,
    discontinuity: rev.baseDisc + cycle * rev.discontinuitiesPerCycle + segment.discIndex,
    revision: rev.id};
}
export function compileProgram(input) {
  requireValue(input?.schema === PROGRAM_SCHEMA, "INVALID_SCHEMA");
  requireValue(typeof input.station_id === "string" &&
    /^[a-z0-9][a-z0-9-]{0,31}$/.test(input.station_id), "INVALID_FREQUENCY");
  requireValue(Array.isArray(input.revisions) && input.revisions.length &&
    input.revisions.length <= MAX_REVISIONS, "INVALID_REVISIONS");
  const revisions = input.revisions.map(buildRevision);
  for (let i = 1; i < revisions.length; i++) {
    const before = revisions[i - 1], after = revisions[i];
    requireValue(after.epoch > before.epoch, "UNSORTED_REVISIONS");
    const last = locationInRevision(before, after.epoch - 1);
    requireValue(last && last.end === after.epoch, "REVISION_NOT_AT_SEGMENT_BOUNDARY");
    after.baseSeq = last.sequence + 1;
    after.baseDisc = last.discontinuity + 1;
  }
  return {stationId: input.station_id, revisions,
    approved: new Map(revisions.flatMap(rev => rev.tracks.map(track =>
      [track.asset_sha, Math.max(...rev.segments.filter(s => s.asset === track.asset_sha).map(s => s.index)) + 1])))};
}
export function segmentAt(program, time) {
  if (!Number.isFinite(time)) return null;
  for (let i = program.revisions.length - 1; i >= 0; i--) {
    const rev = program.revisions[i];
    if (time >= rev.epoch) return locationInRevision(rev, time);
  }
  return null;
}
function urlFor(segment) {
  return "./segments/" + segment.asset + "/segment-" + String(segment.index).padStart(6, "0") + ".ts";
}
function encodeCue(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
export function playbackWindow(program, now = Date.now()) {
  const last = segmentAt(program, now - PLAYOUT_LAG_MS);
  if (!last) return [];
  const reversed = [last];
  for (let i = 1; i < WINDOW_SEGMENTS; i++) {
    const previous = segmentAt(program, reversed[reversed.length - 1].start - 1);
    if (!previous) break;
    reversed.push(previous);
  }
  return reversed.reverse();
}
export function renderPlaylist(program, now = Date.now()) {
  const window = playbackWindow(program, now);
  if (!window.length) throw new Error("NOT_ON_AIR");
  const max = Math.max(...program.revisions.map(rev => rev.maxSegment));
  const lines = ["#EXTM3U", "#EXT-X-VERSION:7", "#EXT-X-TARGETDURATION:" + Math.ceil(max / 1000),
    "#EXT-X-MEDIA-SEQUENCE:" + window[0].sequence,
    "#EXT-X-DISCONTINUITY-SEQUENCE:" + window[0].discontinuity];
  for (let i = 0; i < window.length; i++) {
    const item = window[i], prev = window[i - 1];
    if (prev && item.discontinuity > prev.discontinuity) lines.push("#EXT-X-DISCONTINUITY");
    lines.push("#EXT-X-PROGRAM-DATE-TIME:" + new Date(item.start).toISOString());
    if (item.index === 0) {
      const track = item.track;
      const metadata = {id:track.id,title:track.title,artist:track.artist,
        album:track.album,artwork:track.artwork};
      lines.push('#EXT-X-DATERANGE:ID="' + item.revision + "-" + item.sequence +
        '",CLASS="org.abundent.humkin.track",START-DATE="' +
        new Date(item.start).toISOString() + '",X-HUMKIN="' + encodeCue(metadata) + '"');
    }
    lines.push("#EXTINF:" + (item.duration / 1000).toFixed(3) + ",", urlFor(item));
  }
  return lines.join("\n") + "\n";
}
function headers(type) {
  return {"Content-Type":type, "Access-Control-Allow-Origin":"*",
    "Access-Control-Allow-Methods":"GET,HEAD,OPTIONS",
    "Cache-Control":"no-store, no-transform",
    "X-Content-Type-Options":"nosniff","Cross-Origin-Resource-Policy":"cross-origin"};
}
function respond(data, status = 200) {
  return new Response(JSON.stringify(data), {status, headers:headers("application/json; charset=utf-8")});
}
export async function serveAutopilot(request, env, now = Date.now()) {
  const pathname = new URL(request.url).pathname;
  const match = PATH_RE.exec(pathname);
  if (!match) return respond({error:"NOT_FOUND"},404);
  if (!["GET","HEAD"].includes(request.method)) return respond({error:"METHOD_NOT_ALLOWED"},405);
  if (!env?.RADIO_MEDIA?.get) return respond({on_air:false,error:"NO_MEDIA_BINDING"},503);
  try {
    const snapshot = await env.RADIO_MEDIA.get("autopilot/programs/" + match[1] + ".json");
    if (!snapshot?.body) return respond({on_air:false,mode:"cloud_autopilot_unpublished"},503);
    const parsed = compileProgram(JSON.parse(await snapshot.text()));
    if (parsed.stationId !== match[1]) return respond({on_air:false,error:"FREQUENCY_MISMATCH"},503);
    const window = playbackWindow(parsed, now);
    if (!window.length) return respond({on_air:false,error:"PROGRAM_NOT_STARTED"},503);
    if (match[2].startsWith("segments/")) {
      const sha = match[3], index = Number(match[4]);
      const permitted = parsed.approved.get(sha);
      if (!Number.isInteger(permitted) || index >= permitted)
        return respond({error:"SEGMENT_NOT_APPROVED"},404);
      const asset = await env.RADIO_MEDIA.get("autopilot/segments/" + sha + "/segment-" +
        match[4] + ".ts");
      if (!asset?.body) return respond({error:"SEGMENT_MISSING"},503);
      return new Response(request.method === "HEAD" ? null : asset.body,
        {status:200,headers:{...headers("video/mp2t"),"Cache-Control":"public, max-age=31536000, immutable"}});
    }
    const latest = window[window.length - 1];
    // If a required window segment is not yet in the durable bucket, do not
    // advertise a ghost broadcast or let the player stall halfway in.
    for (const item of window) {
      if (!await env.RADIO_MEDIA.head("autopilot/segments/" + item.asset +
          "/segment-" + String(item.index).padStart(6,"0") + ".ts"))
        return respond({on_air:false,error:"PROGRAM_MEDIA_INCOMPLETE"},503);
    }
    if (match[2] === "status") return respond({on_air:true,mode:"cloud_autopilot_hls",
      frequency:parsed.stationId,revision:latest.revision,age_seconds:Math.round((now - latest.end)/1000),
      playlist:pathname.replace(/status$/,"live.m3u8")});
    if (match[2] === "now-playing") return respond({on_air:true,
      mode:"cloud_autopilot_hls",frequency:parsed.stationId,
      revision:latest.revision,media_at:new Date(latest.start).toISOString(),
      track:{id:latest.track.id,title:latest.track.title,artist:latest.track.artist,
        album:latest.track.album,artwork_url:latest.track.artwork}});
    return new Response(request.method === "HEAD" ? null : renderPlaylist(parsed,now),
      {status:200,headers:headers("application/vnd.apple.mpegurl")});
  } catch (e) {
    return respond({on_air:false,error:e instanceof Error && /^(?:INVALID_|UNSORTED_|REVISION_|SEGMENT_LIMIT)/.test(e.message)
      ? "INVALID_PROGRAM" : "PROGRAM_UNAVAILABLE"},503);
  }
}
