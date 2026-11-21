import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {buildCloudHandoff,canonical,eligibleHandoffRow} from "../fm/load/cloud-feature-handoff.mjs";

const uid="4a83d975-d338-446f-acd7-34a35a007d2f";
const clip="ab3a9723-e209-4d0e-a8cc-5137ce1e2af0";
function row(id,kind,sec){
 const sha=createHash("sha256").update(id).digest("hex");
 return {id,sha256:sha,r2_object_key:`tracks/${id}/${sha}.mp3`,
   title:kind==="bumper"?"Interview — Þorn":"A New Song",artist:"HUMKIN",
   album:"FELLOWSHIP",kind,enabled:true,published_at:"2026-11-21T00:00:00+00:00",
   storage_provider:"r2",duration_seconds:sec};
}
const rows=[row(uid,"song",150),row(clip,"bumper",262.531)];
const sha=async bytes=>createHash("sha256").update(bytes).digest("hex");
const args={
 name:"FELLOWSHIP · The Order",day:"2026-12-05",time:"19:15",
 ids:[uid,clip,uid],rows,programId:"0123456789abcdef01234567"
};
test("one-time feature preserves exact approved order, source identity and spoken feature",async()=>{
 const packet=await buildCloudHandoff(args,sha);
 assert.equal(packet.schema,"humkin.tower.cloud-handoff/v1");
 assert.equal(packet.state,"draft_for_owner_review");
 assert.equal(packet.station_id,"station-one");
 assert.deepEqual(packet.program.track_ids,[
   "r2-"+uid,"r2-"+clip,"r2-"+uid]);
 assert.equal(packet.crate.tracks[1].source_kind,"r2");
 assert.equal(packet.crate.tracks[1].expected_sha,rows[1].sha256);
 assert.equal(packet.crate.tracks[1].url,"https://media.abundent.org/"+rows[1].r2_object_key);
 assert(!Object.hasOwn(packet.crate.tracks[1],"path"));
 const {station_id,program,slot,crate}=packet;
 assert.equal(packet.fingerprint,
  await sha(new TextEncoder().encode(canonical({station_id,program,slot,crate}))));
 const py=spawnSync("python3",["-c",String.raw`
import json,sys
sys.path.insert(0,'tools/radio-broadcast')
from tower_cloud_handoff import validate_handoff
packet=json.load(sys.stdin)
print(validate_handoff(packet)[0])
`],{input:JSON.stringify(packet),encoding:"utf8"});
 assert.equal(py.status,0,py.stderr);
 assert.equal(py.stdout.trim(),"station-one");
});
test("private/unpublished/off-air or forged R2 objects cannot be exported",async()=>{
 assert.equal(eligibleHandoffRow({...rows[0],published_at:null}),null);
 assert.equal(eligibleHandoffRow({...rows[0],enabled:false}),null);
 assert.equal(eligibleHandoffRow({...rows[0],storage_provider:"r2_private"}),null);
 assert.equal(eligibleHandoffRow({...rows[0],r2_object_key:"../hidden"}),null);
 assert.equal(eligibleHandoffRow({...rows[0],sha256:"badhash"}),null);
 for(const extra of [
  {rows:[{...rows[0],published_at:null},rows[1]]},
  {ids:[uid,"../../private"]},
  {time:"19:13"},{time:"02:67"},{day:"2026-02-31"},
  {programId:"weak"},{name:""}
 ]) await assert.rejects(()=>buildCloudHandoff({...args,...extra},sha));
 const over=[row(uid,"song",29000)];
 await assert.rejects(()=>buildCloudHandoff({...args,ids:[uid],rows:over},sha),/eight hours/);
});
test("Crate Feature Desk exports from owner RLS recheck without granting phone R2 writes",()=>{
 const page=readFileSync("fm/load/index.html","utf8");
 const desk=readFileSync("fm/load/feature-desk.mjs","utf8");
 assert.match(page,/id="feature-cloud-date"/);
 assert.match(page,/id="feature-cloud-time"/);
 assert.match(page,/id="feature-export-cloud"/);
 assert.match(desk,/db\.auth\.getUser\(\)/);
 assert.match(desk,/storage_provider,sha256,r2_object_key,duration_seconds/);
 assert.match(desk,/buildCloudHandoff/);
 assert.match(desk,/URL\.createObjectURL/);
 assert.match(desk,/NOT an aired or scheduled show/);
 assert.doesNotMatch(desk,/service_role|sb_secret_|CLOUDFLARE_API_TOKEN/);
});
