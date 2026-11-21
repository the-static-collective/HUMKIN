/* HUMKIN Tower -> Crate Loader: read-only metadata sidecars.
 * Never trust local_audio paths or open arbitrary files from JSON.
 * The browser File picker owns every byte we may stage.
 */
export const TOWER_SHA = /^[0-9a-f]{64}$/;
const AUDIO = /^([0-9a-f]{64})\.(mp3|wav|m4a|aac|flac|ogg|opus|aiff|aif)$/i;
const SIDECAR = /^([0-9a-f]{64})\.json$/i;
const MAX_SIDECAR_BYTES = 32768;

export function towerAudioDigest(filename) {
  return AUDIO.exec(String(filename || ""))?.[1]?.toLowerCase() || null;
}
function safeText(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
export function parseTowerSidecar(raw, filename) {
  const match = SIDECAR.exec(String(filename || ""));
  if (!match || typeof raw !== "string" || raw.length > MAX_SIDECAR_BYTES) return null;
  const sha = match[1].toLowerCase();
  let record;
  try { record = JSON.parse(raw); } catch { return null; }
  if (!record || typeof record !== "object" || Array.isArray(record) ||
      record.id !== "upload-" + sha || record.source !== "upload") return null;
  // File paths in JSON are informational, NEVER read or sent to the server.
  const originName = typeof record.local_audio === "string"
    ? record.local_audio.split(/[\\/]/).pop() : "";
  if (towerAudioDigest(originName) !== sha) return null;
  const title = safeText(record.title, 120);
  const artist = safeText(record.artist, 160);
  const album = safeText(record.album, 160);
  const duration = Number(record.duration);
  if (!title || !Number.isFinite(duration) || duration < 1 || duration > 14400)
    return null;
  return {sha, title, artist, album, duration,
    kind: record.kind === "bumper" ? "bumper" : "song"};
}
export async function inspectTowerFolder(files) {
  const all = Array.from(files || []);
  const sources = new Set(all.map(f => towerAudioDigest(f.name)).filter(Boolean));
  const sidecars = all.filter(f => SIDECAR.test(String(f.name || "")));
  const records = new Map();
  const conflicted = new Set();
  let rejected = 0, unpaired = 0;
  for (const file of sidecars) {
    const hash = SIDECAR.exec(file.name)[1].toLowerCase();
    if (!sources.has(hash)) { unpaired++; continue; }
    if (!Number.isSafeInteger(file.size) || file.size > MAX_SIDECAR_BYTES ||
        typeof file.text !== "function") { rejected++; continue; }
    let parsed = null;
    try { parsed = parseTowerSidecar(await file.text(), file.name); }
    catch { parsed = null; }
    if (!parsed) { rejected++; continue; }
    if (records.has(hash) && JSON.stringify(records.get(hash)) !== JSON.stringify(parsed)) {
      conflicted.add(hash);
      records.delete(hash);
      rejected++;
      continue;
    }
    if (!conflicted.has(hash)) records.set(hash, parsed);
  }
  return {
    metadata: records,
    towerAudioCount: sources.size,
    paired: records.size,
    rejected,
    unpaired,
    unsupported: all.filter(f => /\.(aac|flac|ogg|opus|aiff|aif)$/i.test(String(f.name||""))).length,
  };
}
