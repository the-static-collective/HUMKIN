/**
 * Public HUMKIN FM Studio station registry.
 *
 * Station identity is a published, fresh R2 HLS playlist, NOT a local Tower
 * process, a planned program, or an old leftover R2 segment. This endpoint
 * enumerates only real live frequencies; Station One remains a fixed receiver
 * entry even when its live transmitter is unavailable.
 *
 * Read-only: no R2 listing or playlist metadata may authorize publishing.
 */
const LIVE_PREFIX = "live/";
const FREQUENCY = /^[a-z0-9][a-z0-9-]{0,31}$/;
const MAX_STALE_MS = 90000;
const MAX_FREQUENCIES = 50;

function response(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "cross-origin"
    }
  });
}

function station(id, live, age = null) {
  return {
    id,
    on_air: live,
    mode: live ? "shared_live_hls" : "unavailable",
    age_seconds: live ? Math.max(0, Math.round(age / 1000)) : null,
    receiver: id === "station-one" ? "/fm/" : "/fm/?frequency=" + id
  };
}

/**
 * R2 returns delimiter prefixes such as live/talk/. Filter out anything that
 * could be a leaked object key, malformed frequency or stale session.
 */
export function discoverFrequencyIds(prefixes) {
  const ids = new Set(["station-one"]);
  for (const entry of Array.isArray(prefixes) ? prefixes.slice(0, 300) : []) {
    if (typeof entry !== "string" || !entry.startsWith(LIVE_PREFIX) ||
        !entry.endsWith("/")) continue;
    const id = entry.slice(LIVE_PREFIX.length, -1);
    if (FREQUENCY.test(id)) ids.add(id);
  }
  return [...ids].sort((a, b) => a === "station-one" ? -1 : b === "station-one" ? 1 : a.localeCompare(b));
}

export async function stationRegistry(bucket, now = Date.now()) {
  if (!bucket?.list || !bucket?.head) throw Error("R2 registry binding unavailable.");
  const listing = await bucket.list({prefix: LIVE_PREFIX, delimiter: "/", limit: 500});
  if (listing.truncated) throw Error("Station registry exceeds safe discovery window.");
  const ids = discoverFrequencyIds(listing.delimitedPrefixes);
  if (ids.length > MAX_FREQUENCIES) throw Error("Too many frequencies to probe safely.");
  const stations = await Promise.all(ids.map(async id => {
    try {
      const obj = await bucket.head(`live/${id}/live.m3u8`);
      if (!obj) return station(id, false);
      const updated = new Date(obj.uploaded).getTime();
      const age = now - updated;
      return station(id, Number.isFinite(age) && age >= -30000 &&
        age <= MAX_STALE_MS, age);
    } catch {
      return station(id, false);
    }
  }));
  return {
    schema: "humkin.fm.station-registry/v1",
    checked_at: new Date(now).toISOString(),
    // Ghost frequency prefixes from past transmissions must not advertise
    // a live receiver. Station One retains its classic fallback entry.
    stations: stations.filter(s => s.on_air || s.id === "station-one")
  };
}

export async function serveStationRegistry(request, env, now = Date.now()) {
  if (!["GET", "HEAD"].includes(request.method))
    return response({error: "METHOD_NOT_ALLOWED"}, 405);
  try {
    const registry = await stationRegistry(env?.RADIO_LIVE, now);
    return request.method === "HEAD"
      ? new Response(null, {status: 200, headers: response(null).headers})
      : response(registry);
  } catch {
    return response({error: "STATION_REGISTRY_UNAVAILABLE"}, 503);
  }
}
