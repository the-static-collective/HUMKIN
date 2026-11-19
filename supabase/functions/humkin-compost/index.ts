import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const project = Deno.env.get("SUPABASE_URL")!;
const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(project, secret, { auth: { persistSession: false } });
const site = "https://humkin.abundent.org";
const radio = site + "/fm/";
const fallbackCover = site + "/cover.jpg";
const origins = new Set([site, "https://www.humkin.abundent.org"]);
const reactions = new Set(["dance", "again", "late", "surprise"]);
const idPattern = /^[A-Za-z0-9-]{3,90}$/;
const hashPattern = /^[a-f0-9]{64}$/;
const storagePattern = /^[a-f0-9-]{36}\/[a-f0-9]{64}\.mp3$/;
const pageSize = 500;

function objectURL(key: unknown, extension: RegExp) {
  if (typeof key !== "string" || key !== key.trim() || key.length > 400 || !extension.test(key)) return "";
  const parts = key.split("/");
  if (parts.some(part => !part || part === "." || part === ".." || /[\\?#\x00-\x1f\x7f]/.test(part))) return "";
  return "https://media.abundent.org/" + parts.map(encodeURIComponent).join("/");
}

function siteURL(value: unknown, extension: RegExp) {
  if (typeof value !== "string" || !value) return "";
  try {
    const url = new URL(value, radio);
    return url.origin === site && !url.search && !url.hash && extension.test(url.pathname) ? url.href : "";
  } catch {
    return "";
  }
}

const audioExt = /\.mp3$/i;
const artExt = /\.(jpg|jpeg|png|webp)$/i;
type Track = {id: string; title: string; artist: string; album: string; kind: string;
  duration: number; src: string; artwork: string; hash?: string};

async function publicJSON(path: string) {
  const response = await fetch(radio + path, { signal: AbortSignal.timeout(5500) });
  if (!response.ok) throw new Error("Catalog HTTP " + response.status);
  return await response.json();
}

async function cloudTracks() {
  const rows = [];
  let after = "00000000-0000-0000-0000-000000000000";
  while (true) {
    const { data, error } = await db.from("humkin_radio_tracks")
      .select("id,title,artist,album,kind,duration_seconds,storage_path,storage_provider,r2_object_key,sha256,art_asset_id")
      .not("published_at", "is", null).eq("enabled", true)
      .gt("id", after).order("id").limit(pageSize);
    if (error) throw error;
    rows.push(...data);
    if (data.length < pageSize) return rows;
    after = data[data.length - 1].id;
  }
}

async function loadCatalog(): Promise<Track[]> {
  const [rotation, r2, carts, overrides, art, cloud] = await Promise.all([
    publicJSON("rotation.json"), publicJSON("r2-tracks.json"), publicJSON("air-carts.json"),
    db.from("humkin_radio_static_overrides").select("track_id,title,artist,album,enabled,kind,art_asset_id"),
    db.from("humkin_radio_art_assets").select("id,storage_path"),
    cloudTracks()
  ]);
  if (overrides.error || art.error) throw (overrides.error || art.error);
  const edits = new Map((overrides.data ?? []).map(row => [row.track_id, row]));
  const artwork = new Map((art.data ?? []).filter(row => /^[a-f0-9-]{36}\/[a-f0-9]{64}\.jpg$/.test(row.storage_path))
    .map(row => [row.id, project + "/storage/v1/object/public/humkin-radio-art/" + row.storage_path]));
  const tracks: Track[] = [];
  const ids = new Set<string>(), hashes = new Set<string>(), sources = new Set<string>();
  function add(track: Track) {
    if (!idPattern.test(track.id) || !track.title || !track.src || !(track.duration > 0 && track.duration < 14400)) return;
    if (ids.has(track.id) || sources.has(track.src) || (track.hash && hashes.has(track.hash))) return;
    ids.add(track.id);
    sources.add(track.src);
    if (track.hash) hashes.add(track.hash);
    delete track.hash;
    tracks.push(track);
  }
  for (const row of rotation.tracks ?? []) {
    const edit = edits.get(row.id);
    if (edit?.enabled === false) continue;
    add({id: row.id, title: edit?.title || row.title, artist: edit?.artist || row.artist || "HUMKIN",
      album: edit?.album || row.album || "", kind: edit?.kind || row.kind || "song",
      duration: Number(row.duration), src: siteURL(row.src, audioExt),
      artwork: artwork.get(edit?.art_asset_id) || siteURL(row.artwork, artExt) || fallbackCover});
  }
  for (const row of cloud) {
    if (!storagePattern.test(row.storage_path ?? "")) continue;
    let src = "";
    if (row.storage_provider === "r2") src = objectURL(row.r2_object_key, audioExt);
    if (row.storage_provider === "supabase") src = project + "/storage/v1/object/public/humkin-radio-live/" + row.storage_path;
    add({id: "crate-" + row.id, title: row.title, artist: row.artist || "HUMKIN", album: row.album || "",
      kind: row.kind, duration: Number(row.duration_seconds), src,
      artwork: artwork.get(row.art_asset_id) || fallbackCover,
      hash: hashPattern.test(row.sha256) ? row.sha256 : undefined});
  }
  if (r2.schema === "humkin.radio.r2/v1") for (const row of r2.tracks ?? []) {
    if (row.approved !== true || !/^[a-z0-9][a-z0-9-]{2,79}$/.test(row.id)) continue;
    add({id: "r2-" + row.id, title: row.title, artist: row.artist || "HUMKIN", album: row.album || "",
      kind: "song", duration: Number(row.duration_seconds), src: objectURL(row.object_key, audioExt),
      artwork: objectURL(row.artwork_key, artExt) || fallbackCover,
      hash: hashPattern.test(row.sha256) ? row.sha256 : undefined});
  }
  if (carts.schema_version === "humkin.radio.air-carts/v1") for (const row of carts.carts ?? []) {
    if (!/^field-fm-[0-9]{3}$/.test(row.id) || !hashPattern.test(row.sha256)) continue;
    const id = "air-" + row.id;
    const edit = edits.get(id);
    const src = siteURL(row.src, audioExt);
    if (edit?.enabled === false || !src.startsWith(radio + "studio/recordings/")) continue;
    add({id, title: edit?.title || row.title, artist: edit?.artist || "HUMKIN", album: edit?.album || "",
      kind: edit?.kind || "bumper", duration: Number(row.duration_seconds), src,
      artwork: artwork.get(edit?.art_asset_id) || fallbackCover, hash: row.sha256});
  }
  return tracks;
}

let catalogCache: Promise<Track[]> | undefined;
let expires = 0;
function catalog() {
  if (!catalogCache || Date.now() >= expires) {
    expires = Date.now() + 60000;
    catalogCache = loadCatalog().catch(error => {
      catalogCache = undefined;
      throw error;
    });
  }
  return catalogCache;
}

async function scores() {
  const tracks = [];
  let after = "";
  while (true) {
    const {data, error} = await db.rpc("humkin_compost_stats", {p_after: after, p_limit: pageSize});
    if (error) throw error;
    tracks.push(...data);
    if (data.length < pageSize) return tracks;
    after = data[data.length - 1].id;
  }
}

const encoder = new TextEncoder();
const signingKey = crypto.subtle.importKey("raw", encoder.encode(secret), {name: "HMAC", hash: "SHA-256"}, false, ["sign"]);
async function digest(value: string) {
  const bytes = await crypto.subtle.sign("HMAC", await signingKey, encoder.encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async request => {
  const origin = request.headers.get("origin") || "";
  function response(value: unknown, status = 200) {
    return new Response(JSON.stringify(value), { status, headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": origins.has(origin) ? origin : site,
      "Access-Control-Allow-Headers": "content-type,apikey,authorization",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Vary": "Origin"
    }});
  }

  if (origin && !origins.has(origin)) return response({error: "Station origin only."}, 403);
  if (request.method === "OPTIONS") return response({});
  try {
    if (request.method === "GET") {
      const scope = new URL(request.url).searchParams.get("view");
      if (scope === "scores") return response({scores: await scores()});
      const [tracks, stats] = await Promise.all([catalog(), scores()]);
      return response({tracks, scores: stats});
    }
    if (request.method !== "POST") return response({error: "Method unavailable."}, 405);
    const reader = request.body?.getReader();
    if (!reader) return response({error: "Response required."}, 400);
    const decoder = new TextDecoder();
    let raw = "", size = 0;
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024) {
        await reader.cancel();
        return response({error: "Response too large."}, 413);
      }
      raw += decoder.decode(value, {stream: true});
    }
    let body;
    try { body = JSON.parse(raw + decoder.decode()); }
    catch { return response({error: "Unreadable response."}, 400); }
    const {action, track_id, listener, stars, reaction} = body ?? {};
    if (!["play", "rate"].includes(action) || typeof track_id !== "string" || !idPattern.test(track_id)
        || typeof listener !== "string" || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(listener))
      return response({error: "Invalid track response."}, 400);
    if (action === "rate" && (!Number.isInteger(stars) || stars < 1 || stars > 5
        || (reaction != null && !reactions.has(reaction))))
      return response({error: "Choose a valid rating."}, 400);
    if (!(await catalog()).some(track => track.id === track_id))
      return response({error: "This track is unavailable."}, 404);
    const address = request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip")
      || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unreported";
    const [actor, network] = await Promise.all([digest("compost-listener:" + listener),
      digest("compost-network:" + address.slice(0, 128))]);
    const {data, error} = await db.rpc("humkin_compost_record", {
      p_track: track_id, p_listener: actor, p_network: network,
      p_bucket: action === "play" ? Math.floor(Date.now() / 1200000) : 0,
      p_stars: action === "rate" ? stars : null, p_reaction: action === "rate" ? reaction ?? null : null
    });
    if (error) throw error;
    if (!data) return response({error: "Response limit reached for today."}, 429);
    return response({saved: true});
  } catch (error) {
    console.warn("Compost Heap request failed", String(error));
    return response({error: "The Compost Heap is temporarily unavailable."}, 503);
  }
});
