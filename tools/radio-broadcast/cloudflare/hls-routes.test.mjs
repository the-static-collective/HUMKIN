import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.mjs";
import { isHlsPath, hlsObjectKey, serveHls } from "./hls-routes.mjs";

const session = "0123456789abcdef0123456789abcdef";
const segment = "segment-001763000123.ts";
const now = Date.now();
function envAt(uploaded = new Date(now)) {
  const keys = [];
  return {
    keys,
    RADIO_LIVE: {
      async get(key) {
        keys.push(key);
        if (key === "live/station-one/live.m3u8") return {
          uploaded, body: new Blob(["#EXTM3U\n#EXTINF:10,\n" +
                  session + "/" + segment + "\n"]).stream()
        };
        if (key === "live/station-one/" + session + "/" + segment)
          return { uploaded, body: new Blob(["FAKE-SEGMENT"]).stream() };
        return null;
      }
    }
  };
}
test("reject path traversal, wrong segment type, missing session and arbitrary objects", () => {
  assert(isHlsPath("/hls/live.m3u8"));
  assert(isHlsPath("/hls/status"));
  assert(isHlsPath("/hls/" + session + "/" + segment));
  for (const path of ["/hls/../private", "/hls/" + session + "/../secret.ts",
    "/hls/" + session + "/index.m3u8", "/hls/private.wav",
    "/hls/" + session + "/segment-001763000123.mp3"]) {
    assert.equal(isHlsPath(path), false, path);
    assert.equal(hlsObjectKey(path), null);
  }
});
test("live playlist and status verify freshness without exposing R2 credentials", async () => {
  const env = envAt(new Date(now - 12000));
  const response = await serveHls(
    new Request("https://humkin.test/hls/live.m3u8"), env, now);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /mpegurl/);
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert((await response.text()).startsWith("#EXTM3U"));
  const status = await serveHls(
    new Request("https://humkin.test/hls/status"), env, now);
  assert.equal((await status.json()).on_air, true);
  assert.equal(env.keys[0], "live/station-one/live.m3u8");
});
test("stale or absent live manifest never advertises station as on air", async () => {
  const stale = envAt(new Date(now - 91000));
  assert.equal((await serveHls(new Request("https://humkin.test/hls/status"),
                              stale, now)).status, 503);
  const missing = { RADIO_LIVE: { get: async () => null } };
  assert.equal((await serveHls(new Request("https://humkin.test/hls/live.m3u8"),
                              missing, now)).status, 503);
  const invalid = envAt(undefined);
  invalid.RADIO_LIVE.get = async () => ({ body: new Blob(["x"]).stream() });
  assert.equal((await serveHls(new Request("https://humkin.test/hls/live.m3u8"),
                              invalid, now)).status, 503);
});
test("immutable segments stream from approved R2 key and 404 on unknown keys", async () => {
  const env = envAt();
  const response = await serveHls(new Request("https://humkin.test/hls/" +
                                    session + "/" + segment), env, now);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "video/mp2t");
  assert.match(response.headers.get("cache-control"), /immutable/);
  assert.equal(await response.text(), "FAKE-SEGMENT");
  assert.equal(env.keys.at(-1), "live/station-one/" + session + "/" + segment);
  const bad = await worker.fetch(new Request("https://humkin.test/hls/private.wav"), env);
  assert.equal(bad.status, 404);
  const integration = await worker.fetch(new Request("https://humkin.test/hls/live.m3u8"), env);
  assert.equal(integration.status, 200);
});

test("frequency routes isolate manifests, public artwork and the now-playing feed", async () => {
  const data = Buffer.from(JSON.stringify({id: "a", title: "Acer cue", artist: "Fixture",
    artwork: "https://humkin.abundent.org/cover.jpg"})).toString("base64url");
  const manifest = '#EXTM3U\n#EXT-X-DATERANGE:ID="a",CLASS="org.abundent.humkin.track",' +
    'START-DATE="2026-11-18T23:00:00.000Z",X-HUMKIN="' + data + '"\n';
  const uploaded = new Date("2026-11-18T23:00:20Z");
  const requests = [];
  const env = {RADIO_LIVE: {async get(key) {
    requests.push(key);
    return {uploaded, body: "data", text: async () => manifest};
  }}};
  const origin = "https://radio.example";
  const now = uploaded.getTime();
  const response = await serveHls(new Request(origin + "/hls/talk/now-playing"), env, now);
  const result = await response.json();
  assert.equal(result.schema, "humkin.station-one.now-playing/v1");
  assert.equal(result.frequency, "talk");
  assert.equal(result.track.title, "Acer cue");
  assert.equal(result.track.artwork_url, "https://humkin.abundent.org/cover.jpg");
  assert.equal(requests[0], "live/talk/live.m3u8");
  const photo = "a".repeat(64) + ".jpg";
  const art = await serveHls(new Request(origin + "/hls/talk/art/" + photo), env, now);
  assert.equal(art.headers.get("Content-Type"), "image/jpeg");
  assert.equal(requests[1], "live/talk/art/" + photo);
  const stale = await serveHls(new Request(origin + "/hls/talk/now-playing"), env, now + 91000);
  assert.equal(stale.status, 503);
});

test("reservoir paths stay distinct from hot and reject private object lookups", async () => {
  assert.equal(hlsObjectKey("/hls/delayed.m3u8"), "live/station-one/delayed.m3u8");
  assert.equal(hlsObjectKey("/hls/delayed-status"), "live/station-one/delayed.m3u8");
  assert.equal(hlsObjectKey("/hls/delayed-now-playing"), "live/station-one/delayed.m3u8");
  assert.equal(hlsObjectKey("/hls/talk/delayed.m3u8"), "live/talk/delayed.m3u8");
  assert.equal(isHlsPath("/hls/private/delayed.m3u8/../secret"), false);
  const requested = [];
  const uploaded = new Date(now - 10000);
  const env = {RADIO_LIVE: {async get(key) {
    requested.push(key);
    if (key === "live/station-one/delayed.m3u8") return {
      uploaded, body: new Blob(["#EXTM3U\n#EXT-X-MEDIA-SEQUENCE:123\n"]).stream(),
      text: async () => "#EXTM3U\n"
    };
    return null;
  }}};
  const manifest = await serveHls(new Request("https://humkin.test/hls/delayed.m3u8"), env, now);
  assert.equal(manifest.status, 200);
  assert.match(await manifest.text(), /MEDIA-SEQUENCE:123/);
  const status = await serveHls(new Request("https://humkin.test/hls/delayed-status"), env, now);
  assert.equal((await status.json()).mode, "delayed_reservoir_hls");
  assert.equal(requested.every(key => key === "live/station-one/delayed.m3u8"), true);
  assert.equal((await serveHls(new Request("https://humkin.test/hls/status"), env, now)).status, 503);
  assert.equal((await serveHls(new Request("https://humkin.test/hls/delayed-status"), env,
    now + 100000)).status, 503);
});
