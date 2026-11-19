/**
 * Dedicated-bucket R2 HLS receiver. Station One uploads complete segments before its
 * playlist; neither credentials nor unfinished recordings reach the browser.
 * Kept separate from personal Long Wave /live.mp3 rotation.
 */
const DEFAULT_FREQUENCY = "station-one";
const HLS_PATH = /^\/hls\/(?:([a-z0-9][a-z0-9-]{0,31})\/)?(live\.m3u8|delayed\.m3u8|status|delayed-status|now-playing|delayed-now-playing|[a-f0-9]{32}\/segment-[0-9]{10,16}\.ts|art\/[a-f0-9]{64}\.jpg)$/;
const MAX_STALE_MS = 90000;

export function isHlsPath(path) {
  return HLS_PATH.test(path);
}

function headers(type, live) {
  return {
    "Content-Type": type,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Cache-Control": live ? "no-store, no-transform" :
      "public, max-age=31536000, immutable"
  };
}

export function hlsObjectKey(path) {
  const match = HLS_PATH.exec(path);
  if (!match) return null;
  const [, frequency = DEFAULT_FREQUENCY, resource] = match;
  const mapped = ["status", "now-playing"].includes(resource) ? "live.m3u8" :
    ["delayed-status", "delayed-now-playing"].includes(resource) ? "delayed.m3u8" : resource;
  return "live/" + frequency + "/" + mapped;
}

function playoutCue(manifest) {
  let track = null, mediaAt = null;
  for (const [, at, data] of manifest.matchAll(
    /^#EXT-X-DATERANGE:ID="[^"]+",CLASS="org\.abundent\.humkin\.track",START-DATE="([^"]+)",X-HUMKIN="([A-Za-z0-9_-]{1,5000})"$/gm
  )) {
    try {
      const bytes = Uint8Array.from(atob(data.replace(/-/g, "+").replace(/_/g, "/")),
        char => char.charCodeAt(0));
      const decoded = JSON.parse(new TextDecoder().decode(bytes));
      if (!Number.isFinite(Date.parse(at))) continue;
      if (decoded !== null && typeof decoded?.title !== "string") continue;
      track = decoded && {id: decoded.id, title: decoded.title, artist: decoded.artist,
        album: decoded.album, artwork_url: decoded.artwork};
      mediaAt = at;
    } catch { /* Leave the last valid transmitted cue intact. */ }
  }
  return {track, media_at: mediaAt};
}

export async function serveHls(request, env, now = Date.now()) {
  const path = new URL(request.url).pathname;
  const key = hlsObjectKey(path);
  if (!key || !["GET","HEAD"].includes(request.method))
    return new Response("Not found", { status: 404 });
  if (!env?.RADIO_LIVE?.get)
    return new Response("R2 binding missing", { status: 503 });
  const delayed = /\/(?:delayed\.m3u8|delayed-status|delayed-now-playing)$/.test(path);
  const status = path.endsWith("/status") || path.endsWith("/delayed-status");
  const nowPlaying = path.endsWith("/now-playing") || path.endsWith("/delayed-now-playing");
  const live = path.endsWith("/live.m3u8") || path.endsWith("/delayed.m3u8") || status || nowPlaying;
  // R2ObjectBody.uploaded is the object timestamp; a stale playlist is
  // not evidence that the radio is still broadcasting.
  const obj = await env.RADIO_LIVE.get(key);
  if (!obj) return new Response(live ? "Radio not on air" : "Segment missing",
                                 { status: live ? 503 : 404,
                                   headers: headers("text/plain; charset=utf-8", true) });
  const updated = new Date(obj.uploaded).getTime();
  if (live && (!Number.isFinite(updated) || now - updated > MAX_STALE_MS ||
               updated - now > 30000))
    return new Response("Radio signal stale", { status: 503,
      headers: headers("text/plain; charset=utf-8", true) });
  if (nowPlaying) {
    const cue = request.method === "HEAD" ? null : playoutCue(await obj.text());
    const frequency = HLS_PATH.exec(path)[1] || DEFAULT_FREQUENCY;
    return new Response(cue === null ? null :
      JSON.stringify({schema: "humkin.station-one.now-playing/v1", frequency,
        updated_at: new Date(updated).toISOString(),
        ...(delayed ? {mode: "delayed_reservoir_hls"} : {}), ...cue}),
      {status: 200, headers: headers("application/json; charset=utf-8", true)});
  }
  if (status) {
    return new Response(request.method === "HEAD" ? null :
      JSON.stringify({ on_air: true,
                       mode: delayed ? "delayed_reservoir_hls" : "shared_live_hls",
                       age_seconds: Math.max(0,Math.round((now-updated)/1000)),
                       playlist: path.replace(/(?:delayed-)?status$/,
                         delayed ? "delayed.m3u8" : "live.m3u8") }),
      { status: 200, headers: headers("application/json; charset=utf-8", true) });
  }
  const type = live ? "application/vnd.apple.mpegurl" :
    path.endsWith(".jpg") ? "image/jpeg" : "video/mp2t";
  return new Response(request.method === "HEAD" ? null : obj.body,
    { status: 200, headers: headers(type, live) });
}
