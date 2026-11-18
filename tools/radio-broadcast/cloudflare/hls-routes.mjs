/**
 * Shared R2 HLS receiver. Station One uploads complete segments before its
 * playlist; neither credentials nor unfinished recordings reach the browser.
 * Kept separate from personal Long Wave /live.mp3 rotation.
 */
const LIVE_KEY = "live/station-one/live.m3u8";
const SEGMENT_PATH = /^\/hls\/([a-f0-9]{32})\/(segment-[0-9]{10,16}\.ts)$/;
const MAX_STALE_MS = 90000;

export function isHlsPath(path) {
  return path === "/hls/live.m3u8" || path === "/hls/status" ||
         SEGMENT_PATH.test(path);
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
  if (path === "/hls/live.m3u8" || path === "/hls/status") return LIVE_KEY;
  const matched = SEGMENT_PATH.exec(path);
  return matched ? "live/station-one/" + matched[1] + "/" + matched[2] : null;
}

export async function serveHls(request, env, now = Date.now()) {
  const path = new URL(request.url).pathname;
  const key = hlsObjectKey(path);
  if (!key || !["GET","HEAD"].includes(request.method))
    return new Response("Not found", { status: 404 });
  if (!env?.RADIO_MEDIA?.get)
    return new Response("R2 binding missing", { status: 503 });
  const live = path === "/hls/live.m3u8" || path === "/hls/status";
  // R2ObjectBody.uploaded is the object timestamp; a stale playlist is
  // not evidence that the radio is still broadcasting.
  const obj = await env.RADIO_MEDIA.get(key);
  if (!obj) return new Response(live ? "Radio not on air" : "Segment missing",
                                 { status: live ? 503 : 404,
                                   headers: headers("text/plain; charset=utf-8", true) });
  const updated = new Date(obj.uploaded).getTime();
  if (live && (!Number.isFinite(updated) || now - updated > MAX_STALE_MS ||
               updated - now > 30000))
    return new Response("Radio signal stale", { status: 503,
      headers: headers("text/plain; charset=utf-8", true) });
  if (path === "/hls/status") {
    return new Response(request.method === "HEAD" ? null :
      JSON.stringify({ on_air: true, mode: "shared_live_hls",
                       age_seconds: Math.max(0,Math.round((now-updated)/1000)),
                       playlist: "/hls/live.m3u8" }),
      { status: 200, headers: headers("application/json; charset=utf-8", true) });
  }
  const type = live ? "application/vnd.apple.mpegurl" : "video/mp2t";
  return new Response(request.method === "HEAD" ? null : obj.body,
    { status: 200, headers: headers(type, live) });
}
