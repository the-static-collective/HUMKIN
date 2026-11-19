import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {discoverFrequencyIds, stationRegistry, serveStationRegistry}
  from "../tools/radio-broadcast/cloudflare/station-registry.mjs";

const NOW = Date.parse("2026-11-18T23:00:00.000Z");
const date = lag => new Date(NOW - lag);
function bucket(overrides = {}) {
  const hits = [];
  const live = {
    "live/station-one/live.m3u8": {uploaded: date(1500)},
    "live/talk/live.m3u8": {uploaded: date(12000)},
    "live/ghost/live.m3u8": {uploaded: date(500000)},
    "live/future/live.m3u8": {uploaded: new Date(NOW + 45000)}
  };
  const value = {
    hits,
    async list(options) {
      hits.push(["list", options]);
      return {delimitedPrefixes: [
        "live/station-one/", "live/talk/", "live/ghost/", "live/future/",
        "live/../", "live/secrets/key/", "other/live/"], truncated:false};
    },
    async head(key) {hits.push(["head",key]);return live[key] || null;},
    ...overrides
  };
  return value;
}
test("rejects object-key injection and keeps exactly one station-one entry", () => {
  assert.deepEqual(discoverFrequencyIds(["live/talk/", "live/talk/", "live/station-one/",
    "live/secrets/key/", "live/../", "live/foo?bar/", "other/evil/"]),
    ["station-one", "talk"]);
});
test("advertises only fresh published HLS manifests, not planned or stale frequencies", async () => {
  const b = bucket();
  const result = await stationRegistry(b,NOW);
  assert.equal(result.schema,"humkin.fm.station-registry/v1");
  assert.deepEqual(result.stations.map(s=>s.id),["station-one","talk"]);
  assert.equal(result.stations[0].on_air,true);
  assert.equal(result.stations[0].age_seconds,2);
  assert.equal(result.stations[1].receiver,"/fm/?frequency=talk");
  assert.deepEqual(b.hits[0],["list",{prefix:"live/",delimiter:"/",limit:500}]);
  assert.ok(b.hits.every(hit => hit[0] !== "put" && hit[0] !== "delete"));
  assert.ok(!JSON.stringify(result).includes("secret"));
});
test("still lists the classic receiver when the Acer is offline", async () => {
  const b = bucket({async head() {return null;}});
  const result = await stationRegistry(b,NOW);
  assert.deepEqual(result.stations.map(s=>({id:s.id,on_air:s.on_air})),
    [{id:"station-one",on_air:false}]);
  assert.equal(result.stations[0].mode,"unavailable");
});
test("fail closed on missing R2 binding, truncated prefix listing, too many frequencies", async () => {
  await assert.rejects(()=>stationRegistry(null,NOW));
  await assert.rejects(()=>stationRegistry(bucket({
    async list() {return {truncated:true,delimitedPrefixes:[]};}
  }), NOW), /exceeds safe/);
  await assert.rejects(()=>stationRegistry(bucket({
    async list(){return {truncated:false,delimitedPrefixes:
      Array.from({length:60},(_,i)=>"live/station-"+i+"/")};}
  }), NOW), /Too many/);
});
test("network endpoint sends public, bounded no-store JSON without private R2 metadata", async () => {
  const url = "https://relay.example/hls/stations";
  const response = await serveStationRegistry(new Request(url),{RADIO_LIVE:bucket()},NOW);
  assert.equal(response.status,200);
  assert.equal(response.headers.get("access-control-allow-origin"),"*");
  assert.match(response.headers.get("cache-control"),/no-store/);
  assert.deepEqual((await response.json()).stations.map(x=>x.id),["station-one","talk"]);
  const head = await serveStationRegistry(new Request(url,{method:"HEAD"}),
    {RADIO_LIVE:bucket()},NOW);
  assert.equal(head.status,200);
  assert.equal(await head.text(),"");
  const missing = await serveStationRegistry(new Request(url),{},NOW);
  assert.equal(missing.status,503);
});
test("the existing Cloudflare Worker routes the directory without changing HLS or Long Wave", () => {
  const code=readFileSync("tools/radio-broadcast/cloudflare/worker.mjs","utf8");
  assert.match(code,/import \{serveStationRegistry\} from "\.\/station-registry\.mjs"/);
  assert.match(code,/path==="\/hls\/stations"\)return serveStationRegistry\(request,env\)/);
  assert.match(code,/isHlsPath\(path\)\)return serveHls\(request,env\)/);
  assert.match(code,/path!=="\/live\.mp3"/);
});
