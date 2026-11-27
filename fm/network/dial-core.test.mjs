import test from "node:test";
import assert from "node:assert/strict";
import {stationURL,stationHealth,ledgerView,inventory,draftCrate} from "./dial-core.mjs";
test("fixed station routes reject traversal and arbitrary origins",()=>{
  assert.match(stationURL("lo-fi","live.m3u8"),/\/autopilot\/lo-fi\/live\.m3u8$/);
  assert.throws(()=>stationURL("../station-one","status"));
  assert.throws(()=>stationURL("lo-fi","https://example.com"));
});
test("unpublished is not on air and mismatched station is unconfirmed",async()=>{
  assert.equal((await stationHealth("lo-fi",async()=>new Response(JSON.stringify({mode:"cloud_autopilot_unpublished"}),{status:503}))).state,"unpublished");
  assert.equal((await stationHealth("lo-fi",async()=>new Response(JSON.stringify({on_air:true,frequency:"station-one",mode:"cloud_autopilot_hls"})))).state,"unconfirmed");
});
test("on-air and title require same station and revision",async()=>{
  const status={on_air:true,frequency:"lo-fi",mode:"cloud_autopilot_hls",revision:"r1"};
  const r=await stationHealth("lo-fi",async url=>new Response(JSON.stringify(url.endsWith("status")?status:{...status,revision:"r2",track:{title:"wrong"}})));
  assert.equal(r.state,"worker-reports-on-air");assert.equal(r.title,undefined);
});
test("old imported ledger is stale independent of its exported label",()=>{
  const raw={schema:"humkin.transmission-ledger-summary/v1",max_gap_ms:180000,stations:[{station:"station-one",last_observation:"2026-11-27T09:00:00Z",latest_state:"media_observed",longest_sampled_span_ms:60000,current_sampled_span_ms:60000}]};
  const result=ledgerView(raw,Date.parse("2026-11-27T09:10:00Z")).get("station-one");
  assert.equal(result.latest_state,"stale");assert.equal(result.current_sampled_span_ms,0);assert.equal(result.longest_sampled_span_ms,60000);
});
test("shared assets are counted once; inconsistent segment durations fail",()=>{
  const program=(station,ms=8000)=>({schema:"humkin.cloud-autopilot/v1",station_id:station,revisions:[{tracks:[{asset_sha:"a".repeat(64),durations_ms:[ms]}]}]});
  assert.deepEqual(inventory([program("station-one"),program("lo-fi")]),{stations:2,unique_assets:1,appearances:2,shared_assets:1,unique_segments:1});
  assert.throws(()=>inventory([program("station-one"),program("lo-fi",7000)]));
});
test("new station draft preserves sources and cannot target reference station",()=>{
  const source={schema:"humkin.autopilot.crate/v1",station_id:"station-one",tracks:[{id:"t",title:"t",path:"file.mp3",expected_sha:"b".repeat(64)}]};
  const draft=draftCrate(source,"lo-fi");assert.equal(draft.station_id,"lo-fi");assert.deepEqual(draft.tracks,source.tracks);assert.equal(source.station_id,"station-one");
  assert.throws(()=>draftCrate(source,"station-one"));
});
