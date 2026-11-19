import {test} from "node:test";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {mkdtempSync, writeFileSync, readFileSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {hlsCues, makeTracerReceipt, TRACER_SCHEMA} from "../scripts/humkin-tracer-core.mjs";

const id = "crate-00000000-0000-0000-0000-000000000001";
const catalog = {tracks: [{id, kind: "song", title: "A First Recording",
  artist: "HUMKIN", duration: 90, src: "https://media.abundent.org/music/first.mp3"}],
scores: [{id, plays: 4, ratings: 2, dance: 1, stars: 4.5}]};
const cue = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const hls = `#EXTM3U
#EXT-X-MEDIA-SEQUENCE:21
#EXT-X-PROGRAM-DATE-TIME:2026-11-18T23:00:00+00:00
#EXT-X-DATERANGE:ID="test-1",CLASS="org.abundent.humkin.track",START-DATE="2026-11-18T23:00:01.250+00:00",X-HUMKIN="${cue({id, title:"A First Recording", artist:"HUMKIN"})}"
#EXTINF:10.000,
segment-000000000021.ts
`;
const proposals = {schema:"humkin.signal-relay.export/v1", proposals:[{
  schema:"humkin.signal-relay.proposal/v1", track_id:id, action:"opened_paused_editor",
  broadcast_status:"not_published_by_relay", suggested_lane:"UNDERHEARD",
  at:"2026-11-18T23:03:00.000Z"}]};

test("reads sample-aligned HLS track cues without inventing audio playback", () => {
  assert.deepEqual(hlsCues(hls), [{
    track_id:id, title:"A First Recording", artist:"HUMKIN",
    at:"2026-11-18T23:00:01.250Z"
  }]);
  const receipt = makeTracerReceipt({trackId:id, catalog, playlist:hls,
    proposals, acquiredAt:"2026-11-18T23:04:00Z"});
  assert.equal(receipt.schema,TRACER_SCHEMA);
  assert.equal(receipt.events[0].status,"listed_in_public_snapshot");
  assert.equal(receipt.events[1].status,"present_in_hls_window");
  assert.equal(receipt.events[1].detail.at,"2026-11-18T23:00:01.250Z");
  assert.deepEqual(receipt.events[2].detail,{plays:4,ratings:2,dance:1});
  assert.equal(receipt.events[3].status,"operator_local_unverified");
  assert.equal(receipt.events[4].status,"not_authorized_or_executed");
  assert.ok(Object.values(receipt.claims).every(v=>v===false));
  assert.doesNotMatch(JSON.stringify(receipt), /music\/first\.mp3|station-control|listener_uuid/);
});
test("when no cue is provided or no exact matching recording is in the window, do not claim it aired", () => {
  const missing = makeTracerReceipt({trackId:id,catalog});
  assert.equal(missing.events[1].status,"not_supplied");
  const another = hls.replace(cue({id,title:"A First Recording",artist:"HUMKIN"}),
    cue({id:"another-track",title:"Elsewhere"}));
  const unseen = makeTracerReceipt({trackId:id,catalog,playlist:another});
  assert.equal(unseen.events[1].status,"not_in_hls_window");
  assert.equal(unseen.events[2].status,"pseudonymous_aggregate_only");
});
test("malformed, silent and unrelated metadata cannot establish a matching cue", () => {
  const nullCue = hls.replace(cue({id,title:"A First Recording",artist:"HUMKIN"}),cue(null));
  assert.deepEqual(hlsCues(nullCue),[]);
  const badCue = hls.replace(cue({id,title:"A First Recording",artist:"HUMKIN"}),"%%%INVALID");
  assert.deepEqual(hlsCues(badCue),[]);
  assert.throws(()=>hlsCues("not a playlist"));
});
test("rejects unpublished, duplicate or incomplete catalog identities", () => {
  assert.throws(()=>makeTracerReceipt({trackId:"../private",catalog}));
  assert.throws(()=>makeTracerReceipt({trackId:id,catalog:{...catalog,tracks:[]}}));
  assert.throws(()=>makeTracerReceipt({trackId:id,catalog:{...catalog,tracks:[...catalog.tracks,...catalog.tracks]}}));
  assert.throws(()=>makeTracerReceipt({trackId:id,catalog:{...catalog,scores:[...catalog.scores,...catalog.scores]}}));
  assert.throws(()=>makeTracerReceipt({trackId:id,catalog:{...catalog,tracks:[{id,duration:90,src:"file:///private"}]}}));
  assert.throws(()=>makeTracerReceipt({trackId:id,catalog:{tracks:catalog.tracks}}));
});
test("refuses editorial exports that claim someone authorized a broadcast", () => {
  const forged={...proposals,proposals:[{...proposals.proposals[0],broadcast_status:"published"}]};
  assert.throws(()=>makeTracerReceipt({trackId:id,catalog,proposals:forged}),/unsupported claim/);
  const receipt=makeTracerReceipt({trackId:id,catalog,proposals});
  assert.equal(receipt.claims.owner_approval_verified,false);
});
test("operator CLI accepts local evidence and writes only a new receipt", () => {
  const dir=mkdtempSync(join(tmpdir(),"humkin-tracer-"));
  try {
    const c=join(dir,"catalog.json"),m=join(dir,"manifest.m3u8"),
      p=join(dir,"proposals.json"),out=join(dir,"trace.json");
    writeFileSync(c,JSON.stringify(catalog));writeFileSync(m,hls);
    writeFileSync(p,JSON.stringify(proposals));
    execFileSync(process.execPath,["scripts/humkin-tracer.mjs","--track",id,
      "--catalog",c,"--hls",m,"--proposal",p,"--out",out],{cwd:process.cwd()});
    const data=JSON.parse(readFileSync(out,"utf8"));
    assert.equal(data.events[1].status,"present_in_hls_window");
    assert.equal(data.claims.station_programming_changed,false);
    assert.throws(()=>execFileSync(process.execPath,["scripts/humkin-tracer.mjs",
      "--track",id,"--catalog",c,"--out",out],{cwd:process.cwd(),stdio:"pipe"}));
  } finally {rmSync(dir,{recursive:true,force:true});}
});
