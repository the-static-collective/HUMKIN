import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {CLOUD_ORIGIN,CLOUD_ROOT,FREQUENCY,STREAM_URL,validCloudStream,cloudState,scheduledTrack} from "../fm/night-shift/night-shift.js";

test("Night Shift is pinned to approved Cloud Autopilot station",()=>{
  assert.equal(CLOUD_ORIGIN,"https://humkin-long-wave.joyvolcanomusic.workers.dev");
  assert.equal(FREQUENCY,"station-one");
  assert.equal(STREAM_URL,CLOUD_ROOT+"live.m3u8");
  assert.equal(validCloudStream(STREAM_URL),true);
  for(const wrong of [
    "https://evil.test/autopilot/station-one/live.m3u8",
    "http://humkin-long-wave.joyvolcanomusic.workers.dev/autopilot/station-one/live.m3u8",
    STREAM_URL+"?private=1",STREAM_URL+"#audio",
    "https://user:pass@humkin-long-wave.joyvolcanomusic.workers.dev/autopilot/station-one/live.m3u8",
    CLOUD_ORIGIN+"/live.mp3"
  ]) assert.equal(validCloudStream(wrong),false,wrong);
});
test("cloud health requires published clock and exposes safe unready distinctions",()=>{
  assert.equal(cloudState(200,{on_air:true,mode:"cloud_autopilot_hls"}),"CLOUD_ON_AIR");
  assert.equal(cloudState(200,{on_air:true,mode:"personal_continuous_mp3"}),"SIGNAL_UNCONFIRMED");
  assert.equal(cloudState(503,{mode:"cloud_autopilot_unpublished"}),"PROGRAM_NOT_PUBLISHED");
  assert.equal(cloudState(503,{error:"PROGRAM_MEDIA_INCOMPLETE"}),"INCOMPLETE_MEDIA");
  assert.equal(cloudState(404,{error:"NOT_FOUND"}),"WORKER_ROUTE_UNAVAILABLE");
  assert.equal(cloudState(200,{on_air:false}),"SIGNAL_UNCONFIRMED");
});
test("metadata comes only from real on-air cloud schedule and is bounded",()=>{
  assert.equal(scheduledTrack({on_air:false,track:{id:"x",title:"Fake"}}),null);
  assert.equal(scheduledTrack({on_air:true}),null);
  assert.equal(scheduledTrack({on_air:true,track:{title:"No ID"}}),null);
  assert.deepEqual(scheduledTrack({on_air:true,track:{
    id:"track-a",title:" What the Quiet Costs ",
    artist:"HUMKIN",album:"Night Shift Proof"
  }}),{id:"track-a",title:"What the Quiet Costs",artist:"HUMKIN",album:"Night Shift Proof"});
  const bound=scheduledTrack({on_air:true,track:{id:"x",title:"A".repeat(400)}});
  assert.equal(bound.title.length,160);
});
test("standalone user-initiated receiver does not change primary station modes",()=>{
  const html=readFileSync(new URL("../fm/night-shift/index.html",import.meta.url),"utf8");
  const script=readFileSync(new URL("../fm/night-shift/night-shift.js",import.meta.url),"utf8");
  assert.match(html,/<audio\s+id="radio-audio"/);
  assert.match(html,/<button type="button" id="tune"/);
  assert.match(html,/hls\.js@1/);
  assert.match(html,/LONG WAVE BACKUP/);
  assert.match(script,/tuneButton\.addEventListener\("click",tune\)/);
  assert.match(script,/new Hls\(/);
  assert.match(script,/audio\.canPlayType\(/);
  assert.doesNotMatch(script,/localStorage|serviceWorker|POST|PUT|PATCH|DELETE/);
  assert.match(html,/ON THE PUBLISHED CLOUD SCHEDULE/);
});
