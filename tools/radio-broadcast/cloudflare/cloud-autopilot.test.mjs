import test from "node:test";
import assert from "node:assert/strict";
import {compileProgram, segmentAt, playbackWindow, renderPlaylist, serveAutopilot}
  from "./cloud-autopilot.mjs";
import worker from "./worker.mjs";

const A = "a".repeat(64), B = "b".repeat(64), C = "c".repeat(64);
const EPOCH = "2026-11-19T20:00:00.000Z";
const MS = Date.parse(EPOCH);
const stamp = milliseconds => new Date(milliseconds).toISOString();
const makeTrack = (id, asset, name, durations = [8000,8000]) => ({
  id, title:name, artist:"HUMKIN",album:"FIELD RADIO",artwork:"",
  asset_sha:asset,durations_ms:durations
});
const initial = {
  schema:"humkin.cloud-autopilot/v1",station_id:"station-one",
  revisions:[{id:"r-one",effective_at:EPOCH,tracks:[
    makeTrack("song-a",A,"A"), makeTrack("song-b",B,"B")]}]
};
const revised = {
  ...initial, revisions:[
    initial.revisions[0],
    {id:"r-two", effective_at:stamp(MS + 64_000),
      tracks:[makeTrack("song-c",C,"C")]}
  ]
};
function fakeBucket(plan = initial, missing = []) {
  const missingSet = new Set(missing);
  const media = key => /^autopilot\/segments\/[a-f0-9]{64}\/segment-\d{6}\.ts$/.test(key) &&
    !missingSet.has(key);
  const bucket = {
    async get(key) {
      if (key === "autopilot/programs/station-one.json" && plan)
        return {body:new Uint8Array([1]),text:async()=>JSON.stringify(plan)};
      if (!media(key)) return null;
      return {body:new ReadableStream({start(controller){controller.enqueue(Uint8Array.from([1,2,3]));controller.close();}})};
    },
    async head(key){return media(key) ? {size:3} : null;}
  };
  return {RADIO_LIVE:bucket};
}
function request(path) {return new Request("https://example.test" + path);}

test("identical timestamps choose identical published tracks across listeners", () => {
  const program = compileProgram(initial);
  for (const n of [0, 1000, 8000, 15999, 16000, 31999, 32000, 2000000]) {
    const a = segmentAt(program, MS + n);
    const b = segmentAt(program, MS + n);
    assert.deepEqual(a,b);
    assert.equal(a.start <= MS+n && a.end > MS+n,true);
    assert.equal(a.sequence, b.sequence);
  }
  assert.equal(segmentAt(program, MS-1),null);
  assert.equal(segmentAt(program, MS + 17000).track.title,"B");
  assert.equal(segmentAt(program, MS + 32000).sequence,4);
  assert.equal(segmentAt(program, MS + 32000).discontinuity,2);
});

test("clock schedule revisions take effect at a real track boundary, preserving sequence", () => {
  const program = compileProgram(revised);
  const previous = segmentAt(program, MS + 63999);
  const after = segmentAt(program, MS + 64000);
  assert.equal(previous.track.title,"B");
  assert.equal(after.track.title,"C");
  assert.equal(after.sequence,previous.sequence+1);
  assert.equal(after.discontinuity,previous.discontinuity+1);
  assert.equal(after.revision,"r-two");
  assert.equal(segmentAt(program, MS + 96000).track.title,"C");
  const broken = structuredClone(revised);
  broken.revisions[1].effective_at=stamp(MS + 65000);
  assert.throws(()=>compileProgram(broken),/REVISION_NOT_AT_SEGMENT_BOUNDARY/);
  const unsorted = structuredClone(revised);
  unsorted.revisions[1].effective_at = EPOCH;
  assert.throws(()=>compileProgram(unsorted),/UNSORTED_REVISIONS/);
});

test("playlist is an actual rolling shared segment timeline with cue and discontinuity", () => {
  const program=compileProgram(initial);
  const m3u8=renderPlaylist(program,MS+100000);
  assert.match(m3u8,/#EXTM3U/);
  assert.match(m3u8,/#EXT-X-PROGRAM-DATE-TIME:/);
  assert.match(m3u8,/#EXT-X-MEDIA-SEQUENCE:/);
  assert.match(m3u8,/#EXT-X-DISCONTINUITY/);
  assert.match(m3u8,/#EXT-X-DATERANGE:ID=/);
  assert.match(m3u8,/\.\/segments\/a{64}\/segment-000000\.ts/);
  const count=(m3u8.match(/#EXTINF:/g)||[]).length;
  assert.equal(count,6);
  const a=playbackWindow(program,MS+100000),b=playbackWindow(program,MS+100000);
  assert.deepEqual(a,b);
  assert.equal(a.every((x,i)=>i===0||x.sequence===a[i-1].sequence+1),true);
});

test("cloud HLS serves only published approved segments, never a ghost stream", async()=>{
  const env=fakeBucket();
  const time=MS+100000;
  const playlist=await serveAutopilot(request("/autopilot/station-one/live.m3u8"),env,time);
  assert.equal(playlist.status,200);
  assert.match(await playlist.text(),/#EXTM3U/);
  const status=await serveAutopilot(request("/autopilot/station-one/status"),env,time);
  assert.equal((await status.json()).mode,"cloud_autopilot_hls");
  const meta=await serveAutopilot(request("/autopilot/station-one/now-playing"),env,time);
  const data=await meta.json();
  assert.equal(data.on_air,true);
  assert(["A","B"].includes(data.track.title));
  const seg=await serveAutopilot(request("/autopilot/station-one/segments/" + A +
    "/segment-000000.ts"),env,time);
  assert.equal(seg.status,200);
  assert.equal(seg.headers.get("content-type"),"video/mp2t");
  assert.equal((await seg.arrayBuffer()).byteLength,3);
  const missingPlan=await serveAutopilot(request("/autopilot/station-one/live.m3u8"),
    fakeBucket(null),time);
  assert.equal(missingPlan.status,503);
  assert.equal((await missingPlan.json()).on_air,false);
  const oneMissing=await serveAutopilot(request("/autopilot/station-one/live.m3u8"),
    fakeBucket(initial,["autopilot/segments/"+A+"/segment-000001.ts"]),time);
  assert.equal(oneMissing.status,503);
  const forbidden=await serveAutopilot(request("/autopilot/station-one/segments/" +
    C + "/segment-000000.ts"),env,time);
  assert.equal(forbidden.status,404);
});

test("normal Long Wave and original R2 HLS URLs remain independently routed", async()=>{
  const env=fakeBucket();
  const pilot=await worker.fetch(request("/autopilot/station-one/status"),env);
  // The station clock is historical in this fixture; status remains safely
  // publishable regardless of how long the owner's Acer has been switched off.
  assert.equal(pilot.status,200);
  const bad=await worker.fetch(request("/autopilot/station-one/segments/../../x.ts"),env);
  assert.equal(bad.status,404);
  const status=await worker.fetch(request("/hls/status"),env);
  assert.equal(status.status,503,"original live HLS still depends on fresh Acer segments");
});

test("invalid schedules cannot publish an invented broadcast", async()=>{
  const bad=structuredClone(initial);
  bad.revisions[0].tracks[0].asset_sha="../../private";
  assert.throws(()=>compileProgram(bad),/INVALID_ASSET_ID/);
  const corrupt=await serveAutopilot(request("/autopilot/station-one/status"),
    fakeBucket(bad),MS+20000);
  assert.equal(corrupt.status,503);
  assert.equal((await corrupt.json()).error,"INVALID_PROGRAM");
});
