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
