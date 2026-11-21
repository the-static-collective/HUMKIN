import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {controlReceipt} from "../fm/load/living-control.mjs";

test("REQUESTED is never presented as on-air without Cloud HOUSE evidence",()=>{
 const intent={id:21};
 assert.match(controlReceipt(intent,null),/REQUESTED/);
 assert.match(controlReceipt(intent,{control:{effective_cursor:20},on_air:true}),/REQUESTED/);
 assert.match(controlReceipt(intent,{control:{effective_cursor:20,pending_cursor:21},on_air:false}),/ACCEPTED/);
 assert.match(controlReceipt(intent,{control:{effective_cursor:21},on_air:false}),/ACCEPTED/);
 assert.match(controlReceipt(intent,{control:{effective_cursor:21},on_air:true}),/EFFECTIVE CLOUD SCHEDULE/);
 assert.match(controlReceipt(intent,{control:{effective_cursor:21},on_air:true}),/not individual playback proof/);
 assert.match(controlReceipt({id:0},{}),/UNVERIFIED/);
});
test("mobile control UI is an authenticated immutable request client, not a transmitter",()=>{
 const loader=readFileSync("fm/load/loader.js","utf8");
 const html=readFileSync("fm/load/index.html","utf8");
 const ui=readFileSync("fm/load/living-control.mjs","utf8");
 const sql=readFileSync("docs/sql/TOWER-010-control-intents.sql","utf8");
 for(const action of ["queue_next","queue_end","more","less","hold","release"]){
   assert.match(html,new RegExp('id="living-'+action+'"'));
 }
 assert.match(loader,/mountLivingControl/);
 assert.match(ui,/db\.auth\.getUser\(\)/);
 assert.match(ui,/\.insert\(\{owner_id:user.id,track_id:row.id,action\}\)/);
 assert.match(ui,/from\("humkin_radio_tracks"\)\.update\(next\)/);
 assert.match(ui,/cloud scheduler must separately accept it/i);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/lower\(coalesce\(auth\.jwt\(\)->>'email',''\)\)/);
 assert.match(sql,/grant insert \(owner_id, track_id, action\)/);
 assert.doesNotMatch(sql,/grant update|grant delete/i);
 assert.doesNotMatch(ui,/service_role|sb_secret_|r2\.put|AWS_SECRET_ACCESS_KEY/);
});
test("Cloud Worker exposes control cursor only from a validated published revision",()=>{
 const worker=readFileSync("tools/radio-broadcast/cloudflare/cloud-autopilot.mjs","utf8");
 const sync=readFileSync("tools/radio-broadcast/cloud_house_sync.py","utf8");
 const job=readFileSync(".github/workflows/tower-living-control.yml","utf8");
 assert.match(worker,/control:safeControl\(raw\.control\)/);
 assert.match(worker,/effective_cursor: active\.control\?\.cursor/);
 assert.match(sync,/program\["revisions"\]\[-1\]\["control"\] = control_state/);
 assert.match(sync,/fresh_commands != commands/);
 assert.match(job,/HUMKIN_CLOUD_LIVING_CONTROL == 'ENABLED'/);
 assert.match(job,/cron: '\*\/5 \* \* \* \*'/);
 assert.match(job,/cancel-in-progress: false/);
 assert.match(job,/steps\.pending\.outputs\.pending == 'true'/);
 assert.doesNotMatch(job,/service_role|sb_secret_|contents: write|CLOUDFLARE_API_TOKEN/);
});
