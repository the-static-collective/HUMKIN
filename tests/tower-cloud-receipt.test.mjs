import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {formatCloudReceipt} from "../fm/load/cloud-house-receipt.mjs";

test("cloud receipts distinguish a published schedule from actual listener audio",()=>{
 const body={schema:"humkin.autopilot.public-schedule/v1",
   station_id:"station-one",rotation_track_count:406,cycle_duration_ms:55500000,
   revision:"r-approved",on_air:true,pending_revisions:[]};
 const result=formatCloudReceipt(body);
 assert.match(result,/CLOUD HLS WINDOW VERIFIED/);
 assert.match(result,/406 scheduled entries/);
 assert.match(result,/does not prove any particular device/);
 assert.match(formatCloudReceipt({...body,on_air:false}),/NOT YET VERIFIED/);
 assert.match(formatCloudReceipt({schema:"malicious",station_id:"station-one"}),/not verifiable/);
});
test("Crate shows owner setup and live schedule without a public write token",()=>{
 const page=readFileSync("fm/load/index.html","utf8");
 const loader=readFileSync("fm/load/loader.js","utf8");
 const receipt=readFileSync("fm/load/cloud-house-receipt.mjs","utf8");
 assert.match(page,/id="cloud-receipt"/);
 assert.match(page,/HUMKIN_CLOUD_AUTOPUBLISH=ENABLED/);
 assert.match(page,/tower-cloud-incremental-sync.yml/);
 assert.match(loader,/mountCloudReceipt\(\)/);
 assert.match(receipt,/\/autopilot\/station-one\/schedule/);
 assert.doesNotMatch(receipt,/service_role|sb_secret_|Authorization:|PUT\(/);
});
