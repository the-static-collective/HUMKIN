import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {sampleStation,summarize,appendObservation,readLedger,STATIONS} from "./transmission-ledger.mjs";
const base=Date.parse("2026-11-27T09:38:00Z");
const row=(station,sec,seq,ok=true)=>({schema:"humkin.transmission-observation/v1",station,
  observed_at:new Date(base+sec*1000).toISOString(),ok,media_sequence:seq,revision:"r1"});
test("only Night Shift enabled by default",()=>assert.deepEqual(STATIONS.filter(s=>s.enabled).map(s=>s.id),["station-one"]));
test("media probe failures are recorded and do not throw",async()=>{
  const r=await sampleStation("station-one",async()=>{throw Error("network");},()=>new Date(base));
  assert.equal(r.ok,false);assert.equal(r.media_sequence,null);assert.equal(r.continuous_uptime_verified,false);
});
test("successful probe preserves evidence without claiming audible output",async()=>{
  const r=await sampleStation("lo-fi",async(_origin,id)=>({ok:true,media_sequence:7,revision:"r2",track_title:id,media_bytes_checked:188}),()=>new Date(base));
  assert.equal(r.ok,true);assert.equal(r.station,"lo-fi");assert.equal(r.track_title,"lo-fi");assert.equal(r.receiver_audio_verified,false);
});
test("separate clocks; failure, stall and gap break sampled span",()=>{
  const a=[row("station-one",0,10),row("lo-fi",1,1),row("station-one",60,17),
    row("station-one",120,17),row("station-one",180,25),row("station-one",240,null,false),
    row("station-one",300,32),row("station-one",600,70),row("lo-fi",61,8)];
  const [s,l]=summarize(a,180000,base+600000);
  assert.equal(s.longest_sampled_span_ms,60000);assert.equal(s.current_sampled_span_ms,0);
  assert.equal(s.breaks,3);assert.equal(s.continuous_uptime_verified,false);
  assert.equal(l.longest_sampled_span_ms,60000);assert.equal(l.latest_state,"stale");
});
test("regression resets sampled span; future samples not fresh",()=>{
  const [s]=summarize([row("station-one",0,10),row("station-one",60,9)],180000,base);
  assert.equal(s.breaks,1);assert.equal(s.latest_state,"stale");
});
test("ledger survives new process reads",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"humkin-ledger-"));
  try{const path=join(dir,"history.jsonl");assert.deepEqual(await readLedger(path),[]);
    await appendObservation(path,row("station-one",0,10));
    await appendObservation(path,row("lo-fi",1,1));
    assert.equal((await readLedger(path)).length,2);
  }finally{await rm(dir,{recursive:true,force:true});}
});
