/* HUMKIN receiver contracts: no DOM, station artwork, or transport side effects. */
export const STREAM_BASE = "https://humkin-long-wave.joyvolcanomusic.workers.dev";
const ID = /^[a-z0-9][a-z0-9-]{0,31}$/;
const LAYOUTS = new Set(["console", "portrait", "banner", "compact"]);
const DEFAULT_ART = new URL("../../cover.jpg", import.meta.url).href;

export function validStationId(id) {
  return typeof id === "string" && ID.test(id);
}

export function streamForStation(id, base = STREAM_BASE) {
  if (!validStationId(id)) throw new TypeError("Invalid station frequency");
  if (id === "quiet-frequency") {
    const prefix = base.replace(/\/$/, "") + "/autopilot/quiet-frequency/";
    return {hls: prefix + "live.m3u8", status: prefix + "status", longwave: null};
  }
  const prefix = base.replace(/\/$/, "") + "/hls/" + (id === "station-one" ? "" : id + "/");
  return { hls: prefix + "live.m3u8", status: prefix + "status",
    longwave: id === "station-one" ? base.replace(/\/$/, "") + "/live.mp3" : null };
}

export function decodeTrackCue(base64) {
  try {
    if (!/^[A-Za-z0-9_-]{1,5000}$/.test(base64)) return null;
    const binary = atob(base64.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const value = JSON.parse(new TextDecoder().decode(bytes));
    return value && typeof value.title === "string" && value.title.trim()
      ? { title: value.title.trim().slice(0, 160),
          artist: typeof value.artist === "string" ? value.artist.trim().slice(0, 160) : "",
          album: typeof value.album === "string" ? value.album.trim().slice(0, 160) : "",
          artwork: typeof value.artwork === "string" ? value.artwork : "",
          ...(typeof value.id==="string" ? {id:value.id.slice(0,80)} : {}),
          ...(typeof value.session_id==="string" && typeof value.session_title==="string" && Number.isInteger(value.chapter_index) && Number.isInteger(value.chapter_count) ? {session_id:value.session_id.slice(0,80),session_title:value.session_title.slice(0,160),chapter_index:value.chapter_index,chapter_count:value.chapter_count} : {}) }
      : null;
  } catch { return null; }
}

export function parseHlsCues(manifest) {
  if (typeof manifest !== "string") return null;
  const first = Date.parse(/^#EXT-X-PROGRAM-DATE-TIME:(.+)$/m.exec(manifest)?.[1]);
  const durations = [...manifest.matchAll(/^#EXTINF:([\d.]+),/gm)].map(match => Number(match[1]));
  if (!Number.isFinite(first) || !durations.length || durations.some(n => !Number.isFinite(n))) return null;
  const end = first + durations.reduce((sum, n) => sum + n * 1000, 0);
  const cues = [];
  const pattern = /^#EXT-X-DATERANGE:ID="[^"]+",CLASS="org\.abundent\.humkin\.track",START-DATE="([^"]+)",X-HUMKIN="([A-Za-z0-9_-]{1,5000})"$/gm;
  for (const [, instant, encoded] of manifest.matchAll(pattern)) {
    const at = Date.parse(instant), track = decodeTrackCue(encoded);
    if (Number.isFinite(at)) cues.push({ at, track });
  }
  return { first, end, cues: cues.sort((a, b) => a.at - b.at) };
}

export function trackAt(cues, time) {
  if (!cues || !Number.isFinite(time) || time < cues.first || time >= cues.end) return null;
  for (let i = cues.cues.length - 1; i >= 0; i--) {
    if (cues.cues[i].at <= time) return cues.cues[i].track;
  }
  return null;
}

export function safeArt(value, base = DEFAULT_ART) {
  if (typeof value !== "string" || !value.trim()) return DEFAULT_ART;
  try {
    const url = new URL(value, base);
    const allowed = new Set([
      new URL(base).hostname, "humkin.abundent.org", "media.abundent.org",
      "kbhqacsdvjsstzyplqij.supabase.co",
      "humkin-long-wave.joyvolcanomusic.workers.dev"
    ]);
    return url.protocol === "https:" && allowed.has(url.hostname) && !url.username && !url.password
      ? url.href : DEFAULT_ART;
  } catch { return DEFAULT_ART; }
}

export function skinFor(id, definitions = {}, base = DEFAULT_ART) {
  const entry = Object.prototype.hasOwnProperty.call(definitions, id) ? definitions[id] : {};
  const color = (value, fallback) => typeof value === "string" &&
    /^#[a-f\d]{3}(?:[a-f\d]{3})?(?:[a-f\d]{2})?$/i.test(value) ? value : fallback;
  const art = value => value ? safeArt(value, base) : "";
  return {
    layout: LAYOUTS.has(entry.layout) ? entry.layout : "console",
    accent: color(entry.accent, "#ffe080"),
    background: color(entry.background, "#251c31"),
    foreground: color(entry.foreground, "#fbf2e9"),
    muted: color(entry.muted, "#d3c4d8"),
    frame: color(entry.frame, "#685775"),
    artwork: art(entry.artwork) || DEFAULT_ART,
    backgroundArt: art(entry.backgroundArt),
    overlayArt: art(entry.overlayArt),
    badgeArt: art(entry.badgeArt),
    caption: typeof entry.caption === "string" ? entry.caption.slice(0, 120) : "",
  };
}
