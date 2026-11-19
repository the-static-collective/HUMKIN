/* HUMKIN predictive playout planning (NOT the live HLS receiver).
 * Side-effect-free checks used before any future offline-ahead transport is enabled.
 * A scheduled recording is never presented as proven live broadcast audio.
 */
const HOSTS = new Set(["humkin.abundent.org", "media.abundent.org",
  "humkin-long-wave.joyvolcanomusic.workers.dev"]);
export const MAX_PREFETCH_TRACKS = 3;
export const MAX_PREFETCH_BYTES = 30 * 1024 * 1024;
export const MAX_CLOCK_RTT_MS = 2500;
export const MAX_CLOCK_AGE_MS = 2 * 60 * 1000;

function goodTime(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function safeRecording(entry) {
  if (!entry || entry.status !== "committed" || entry.offline_license !== true ||
      !goodTime(entry.start_ms) || !goodTime(entry.duration_ms) ||
      !goodTime(entry.size_bytes) || entry.size_bytes > MAX_PREFETCH_BYTES ||
      !/^[a-zA-Z0-9_-]{1,256}$/.test(entry.id || "")) return false;
  try {
    const url = new URL(entry.url);
    // No credentialed, arbitrary, or expiring URLs in the durable cache plan.
    return url.protocol === "https:" && HOSTS.has(url.host) &&
      !url.username && !url.password && !url.search && !url.hash &&
      /^[a-f0-9]{64}$/.test(entry.sha256 || "");
  } catch {return false;}
}

/** NTP-like offset based on midpoint of an authenticated same-origin exchange. */
export function clockSample(clientSentMs, serverMs, clientReceivedMs) {
  if (![clientSentMs, serverMs, clientReceivedMs].every(goodTime)) return null;
  const rtt = clientReceivedMs - clientSentMs;
  if (rtt < 0 || rtt > MAX_CLOCK_RTT_MS) return null;
  return {offset_ms: serverMs - (clientSentMs + clientReceivedMs) / 2,
    uncertainty_ms: rtt / 2, sampled_at_ms: clientReceivedMs};
}
export function serverNow(localNowMs, sample) {
  if (!goodTime(localNowMs) || !sample ||
      localNowMs - sample.sampled_at_ms > MAX_CLOCK_AGE_MS ||
      localNowMs < sample.sampled_at_ms) return null;
  return localNowMs + sample.offset_ms;
}

/** Select only immutable, explicitly offline-cleared recordings, never future HLS. */
export function prefetchPlan(schedule, sample, localNowMs, options = {}) {
  const now = serverNow(localNowMs, sample);
  if (!schedule || !Array.isArray(schedule.entries) ||
      typeof schedule.epoch !== "string" || !schedule.epoch ||
      !Number.isSafeInteger(schedule.revision) || schedule.revision < 0 ||
      !goodTime(schedule.valid_until_ms) || now === null ||
      now > schedule.valid_until_ms || options.allowDownloads !== true) return [];
  let bytes = 0;
  const selected = [];
  for (const entry of [...schedule.entries].sort((a,b) => a.start_ms - b.start_ms)) {
    if (!safeRecording(entry) ||
        entry.start_ms + entry.duration_ms < now ||
        entry.start_ms > schedule.valid_until_ms) continue;
    if (selected.length >= MAX_PREFETCH_TRACKS) break;
    if (bytes + entry.size_bytes > MAX_PREFETCH_BYTES) continue;
    bytes += entry.size_bytes;
    selected.push(Object.freeze({
      id: entry.id, url: entry.url, sha256: entry.sha256,
      start_ms: entry.start_ms, duration_ms: entry.duration_ms,
      epoch: schedule.epoch, revision: schedule.revision, size_bytes: entry.size_bytes
    }));
  }
  return selected;
}

/** Offline slot is provisional and must be labeled accordingly.
 * On network return, confirm the published epoch/revision and actual live edge.
 */
export function offlinePosition(schedule, cachedIds, sample, localNowMs) {
  const now = serverNow(localNowMs, sample);
  if (!schedule || now === null || now > schedule.valid_until_ms ||
      !Array.isArray(schedule.entries) || !(cachedIds instanceof Set)) return null;
  const item = schedule.entries.find(entry => safeRecording(entry) &&
    cachedIds.has(entry.id) && entry.start_ms <= now &&
    now < entry.start_ms + entry.duration_ms);
  if (!item) return null;
  return {mode: "offline-scheduled", id: item.id,
    offset_seconds: (now - item.start_ms)/1000,
    epoch: schedule.epoch, revision: schedule.revision,
    label: "Scheduled recording · offline, not verified live"};
}

/** If the station's program revision changed, discard the old prediction. */
export function shouldResyncLive(cachedPlan, current) {
  return !cachedPlan || !current ||
    cachedPlan.epoch !== current.epoch ||
    cachedPlan.revision !== current.revision ||
    current.source === "live" ||
    current.ready !== true;
}
