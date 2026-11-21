import test from "node:test";
import assert from "node:assert/strict";
import {compileProgram,publicSchedule,serveAutopilot} from "./cloud-autopilot.mjs";
import worker from "./worker.mjs";

const A="a".repeat(64), B="b".repeat(64), C="c".repeat(64), D="d".repeat(64);
const EPOCH="2026-11-21T12:00:00.000Z", MS=Date.parse(EPOCH);
const track=(id,asset,title)=>({
  id,asset_sha:asset,title,artist:"HUMKIN",album:"NIGHT SHIFT",
  artwork:"https://humkin.abundent.org/cover.jpg",durations_ms:[5000,5000]
});
const base={schema:"humkin.cloud-autopilot/v1",station_id:"station-one",
  revisions:[{id:"first",effective_at:EPOCH,tracks:[track("a",A,"First song"),track("b",B,"Second song")]}]};
const withCutover={...base,revisions:[
  base.revisions[0],
  {id:"second",effective_at:new Date(MS+60000).toISOString(),
    tracks:[track("c",C,"Third song"),track("d",D,"Fourth song")]}
]};
const req=(route,method="GET")=>new Request("https://example.test"+route,{method});
const bucket=(plan=base,available=true)=>({RADIO_LIVE:{
  get:async key=>key==="autopilot/programs/station-one.json"&&plan?
    {body:Uint8Array.of(1),text:async()=>JSON.stringify(plan)}:null,
  head:async key=>available&&key.startsWith("autopilot/segments/")?{size:42}:null
}});

test("published schedule projects one full cycle in actual shared-clock order",()=>{
  const projection=publicSchedule(compileProgram(base),MS+55000);
  assert.equal(projection.schema,"humkin.autopilot.public-schedule/v1");
  assert.equal(projection.station_id,"station-one");
  assert.equal(projection.revision,"first");
  assert.equal(projection.rotation_track_count,2);
  assert.equal(projection.cycle_duration_ms,20000);
  assert.equal(projection.upcoming.length,2);
  assert.deepEqual(projection.upcoming.map(x=>x.track.title),["First song","Second song"]);
  assert.equal(projection.upcoming[0].start_at_utc,new Date(MS+40000).toISOString());
  assert.equal(projection.upcoming[1].start_at_utc,new Date(MS+50000).toISOString());
  assert.equal(projection.upcoming[0].is_current,true);
  assert.equal(projection.upcoming[1].is_current,false);
  assert.equal(projection.pending_revisions.length,0);
});

test("future publication takes over at the real revision boundary, not a fake old rotation",()=>{
  const result=publicSchedule(compileProgram(withCutover),MS+66000);
  assert.deepEqual(result.upcoming.slice(0,3).map(x=>x.track.title),
    ["Second song","Third song","Fourth song"]);
  assert.equal(result.upcoming[0].end_at_utc,new Date(MS+60000).toISOString());
  assert.equal(result.upcoming[1].start_at_utc,new Date(MS+60000).toISOString());
  assert.equal(result.upcoming[1].revision,"second");
  assert.equal(result.pending_revisions[0].revision,"second");
  assert.equal(result.pending_revisions[0].effective_at_utc,new Date(MS+60000).toISOString());
});

test("read-only Worker route exposes actual published plan, no segment IDs or source paths",async()=>{
  const result=await worker.fetch(req("/autopilot/station-one/schedule"),bucket(),undefined);
  assert.equal(result.status,200);
  assert.equal(result.headers.get("access-control-allow-origin"),"*");
  assert.match(result.headers.get("cache-control"),/no-store/);
  const data=await result.json();
  assert.equal(data.on_air,true);
  assert.equal(data.mode,"cloud_autopilot_schedule");
  assert.equal(data.station_id,"station-one");
  assert(data.upcoming.length>0);
  const serial=JSON.stringify(data);
  assert.doesNotMatch(serial,/asset_sha|durations_ms|autopilot\/segments|\.ts|r2_object|source_path/);
  assert.doesNotMatch(serial,/a{64}|b{64}/);
});

test("published plan stays visible but clearly off-air if required media is missing",async()=>{
  const time=MS+55000;
  const response=await serveAutopilot(req("/autopilot/station-one/schedule"),bucket(base,false),time);
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.on_air,false);
  assert.equal(body.reason,"PROGRAM_MEDIA_INCOMPLETE");
  assert(body.upcoming.length>0);
  const oldStatus=await serveAutopilot(req("/autopilot/station-one/status"),bucket(base,false),time);
  assert.equal(oldStatus.status,503);
});

test("unstarted and unpublished programs never masquerade as on-air",async()=>{
  const future=await serveAutopilot(req("/autopilot/station-one/schedule"),bucket(),MS-30000);
  const upcoming=await future.json();
  assert.equal(future.status,200);
  assert.equal(upcoming.on_air,false);
  assert.equal(upcoming.reason,"PROGRAM_NOT_STARTED");
  assert.equal(upcoming.upcoming[0].start_at_utc,EPOCH);
  const unpublished=await serveAutopilot(req("/autopilot/station-one/schedule"),bucket(null),MS+55000);
  assert.equal(unpublished.status,503);
  assert.equal((await unpublished.json()).mode,"cloud_autopilot_unpublished");
});

test("schedule route remains GET-only and leaves existing receiver routes unchanged",async()=>{
  const time=MS+55000;
  assert.equal((await serveAutopilot(req("/autopilot/station-one/schedule","POST"),bucket(),time)).status,405);
  assert.equal((await worker.fetch(req("/autopilot/station-one/private"),bucket())).status,404);
  const now=await serveAutopilot(req("/autopilot/station-one/now-playing"),bucket(),time);
  assert.equal(now.status,200);
  assert.equal((await now.json()).mode,"cloud_autopilot_hls");
});
