import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const C=require("../fm/clock-sync.js");
const read=f=>readFileSync(f,"utf8");
execFileSync(process.execPath,["--check","fm/clock-sync.js"]);
assert.equal(C.MAX_RATE_DELTA,.018);
assert.equal(C.rateForDrift(0),1);
assert.equal(C.rateForDrift(.05),1,"Don't oscillate the rate for tiny jitter");
assert(C.rateForDrift(1)>1&&C.rateForDrift(1)<=1.018,
  "When a listener lags one second, gradually catch up");
assert(C.rateForDrift(-1)<1&&C.rateForDrift(-1)>=.982,
  "When a listener leads one second, gently slow down");
assert.equal(C.rateForDrift(18),1,
  "A slow network gap must never force skips or abrupt speed-ups");
assert.equal(C.rateForDrift(NaN),1,"Invalid media timestamps must not change playback");
assert.deepEqual(C.chooseSample([{rttMs:300,offsetMs:2500},
  {rttMs:80,offsetMs:970},{rttMs:5000,offsetMs:50}]),
  {rttMs:80,offsetMs:970},"Prefer the lowest network RTT sample");
assert.equal(C.chooseSample([{rttMs:8000,offsetMs:20},
  {rttMs:100,offsetMs:800000}]),null,"Reject stale and implausible clocks");
let now=1789000000000,calls=0;
const fetcher=async (url,opts)=>{
 calls++;assert(url.includes("/rest/v1/rpc/humkin_radio_clock_ms"));
 assert.equal(opts.method,"GET");
 assert(opts.headers.apikey,"Public clock must use the publishable API key");
 assert.equal(opts.cache,"no-store");
 return {ok:true,json:async()=>now+1050};
};
const result=await C.calibrate(fetcher,"https://kbhqacsdvjsstzyplqij.supabase.co","public-demo",()=>now);
assert(result.synced);
assert.equal(result.offsetMs,1050,"Shared clock should correct local device skew");
assert.equal(calls,2,"Two parallel probes pick the most reliable sample");
const unavailable=await C.calibrate(async()=>({ok:false}),"https://host.invalid","key",()=>now);
assert.deepEqual(unavailable,{offsetMs:0,rttMs:null,synced:false},
  "No clock server must fall back to the user's local clock");

const radio=read("fm/radio.js"),html=read("fm/index.html");
assert(html.indexOf("clock-sync.js")<html.indexOf("radio.js"),"Clock helper must run before radio");
assert(radio.includes("clockOffsetMs=clockSample?.synced"),"Player must adopt server clock");
assert(radio.includes("finishClockJoin()"),"Initial tuning must correct for load latency");
assert(radio.includes("gentlyAlignClock()"),"Drift correction must be gradual");
assert(radio.includes("pendingClockJoin=null;"),"Automatic transitions must not seek");
assert(read("sw.js").includes('"./fm/clock-sync.js"'));
console.log("HUMKIN station clock verified: best RTT sample, remote time offset, ±1.8% gentle sync, no long-gap jumps, and offline fallback.");
