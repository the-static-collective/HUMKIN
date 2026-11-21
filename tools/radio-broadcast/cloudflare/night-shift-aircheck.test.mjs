import test from "node:test";
import assert from "node:assert/strict";
import {inspectWorker,watchWorker} from "./night-shift-aircheck.mjs";
const HOST="https://humkin-long-wave.joyvolcanomusic.workers.dev";
const SHA="a".repeat(64);
const media="/autopilot/station-one/segments/"+SHA+"/segment-000000.ts";
function response(payload,status=200,type="application/json") {
  return new Response(typeof payload==="string"?payload:JSON.stringify(payload),
    {status,headers:{"content-type":type}});
}
function fake(mode="ready") {
  const requests=[];
  const fetcher=async url=>{
    const path=new URL(url).pathname;requests.push(path);
    if(path.endsWith("/status"))
      return mode==="missing_route"?response({error:"NOT_FOUND"},404):
        mode==="not_published"?response({mode:"cloud_autopilot_unpublished"},503):
        response({on_air:true,revision:"r001"});
    if(path.endsWith("/live.m3u8")) {
      const uri=mode==="foreign_segment"?"https://other.example/segment.ts":
        "./segments/"+SHA+"/segment-000000.ts";
      return response("#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-MEDIA-SEQUENCE:900\n#EXTINF:6.000,\n"+uri+"\n",
        200,"application/vnd.apple.mpegurl");
    }
    if(path.endsWith("/now-playing"))
      return response({on_air:true,track:{id:"approved-song",title:"Real track"}});
    if(path===media) {
      if(mode==="missing_media")return response({error:"SEGMENT_MISSING"},503);
      const bytes=new Uint8Array(188*2);bytes[0]=0x47;bytes[188]=0x47;
      return new Response(bytes,{status:200,headers:{"content-type":"video/mp2t"}});
    }
    return response({error:"UNKNOWN"},404);
  };
  return {fetcher,requests};
}
test("aircheck requires HTTPS worker origin, never a password-bearing URL",async()=>{
  for(const value of ["http://example.com/","https://me:secret@example.com/",
    "https://example.com/x","https://example.com/?x=1"]) {
    await assert.rejects(inspectWorker(value,"station-one",fake().fetcher),
      /EXPECTED_WORKER_HTTPS_ORIGIN/);
  }
});
test("healthy route verifies real transport-stream bytes without changing radio",async()=>{
  const {fetcher,requests}=fake();
  const proof=await inspectWorker(HOST+"/","station-one",fetcher);
  assert.equal(proof.ok,true);
  assert.equal(proof.media_sequence,900);
  assert.equal(proof.track_id,"approved-song");
  assert.equal(proof.media_bytes_checked,376);
  assert.equal(proof.receiver_audio_verified,false);
  assert.equal(proof.acer_off_verified,false);
  assert.deepEqual(requests,[
    "/autopilot/station-one/status","/autopilot/station-one/live.m3u8",
    "/autopilot/station-one/now-playing",media]);
});
test("deployed older Worker is a route gap, not a false no-audio success",async()=>{
  const p=await inspectWorker(HOST,"station-one",fake("missing_route").fetcher);
  assert.equal(p.ok,false);assert.equal(p.http_status,404);
  assert.equal(p.reason,"AUTOPILOT_ROUTE_NOT_DEPLOYED");
  const q=await inspectWorker(HOST,"station-one",fake("not_published").fetcher);
  assert.equal(q.ok,false);assert.equal(q.http_status,503);
  assert.equal(q.reason,"cloud_autopilot_unpublished");
});
test("aircheck never follows off-origin media or pretends missing segments play",async()=>{
  await assert.rejects(inspectWorker(HOST,"station-one",fake("foreign_segment").fetcher),
    /UNSAFE_SEGMENT_REFERENCE/);
  await assert.rejects(inspectWorker(HOST,"station-one",fake("missing_media").fetcher),
    /SEGMENT_UNAVAILABLE/);
});
test("single-probe receipt distinguishes HTTP/media checks from sound or Acer-off proof",async()=>{
  const r=await watchWorker(HOST,"station-one",0,15,fake().fetcher);
  assert.equal(r.verdict,"API_MEDIA_VERIFIED");
  assert.equal(r.clock_advanced,false);
  assert.equal(r.receiver_audio_verified,false);
  assert.equal(r.acer_off_verified,false);
  const q=await watchWorker(HOST,"station-one",0,15,fake("missing_route").fetcher);
  assert.equal(q.verdict,"BLOCKED");
});
