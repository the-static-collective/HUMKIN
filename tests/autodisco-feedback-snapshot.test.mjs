import test from "node:test";
import assert from "node:assert/strict";
import {makeFeedbackSnapshot,SNAPSHOT_SCHEMA} from "../fm/autodisco/snapshot-core.mjs";
const queue=[{id:"track-a"},{id:"track-b"}];
test("snapshot carries only aggregate totals and exact six-record-program identity",()=>{
 const result=makeFeedbackSnapshot(queue,[{
   id:"track-a",plays:"12",ratings:4,dance:"3",stars:"4.50",
   listener_hash:"should-not-appear",network_hash:"never-export-me"
 }],{seed:"2026-11-18-set-0",at:"2026-11-18T20:00:00Z"});
 assert.equal(result.schema,SNAPSHOT_SCHEMA);
 assert.equal(result.program_seed,"2026-11-18-set-0");
 assert.equal(result.complete,true);
 assert.deepEqual(result.candidate_track_ids,["track-a","track-b"]);
 assert.deepEqual(result.aggregates[1],{
   track_id:"track-b",plays:0,ratings:0,dance:0,stars:null,observed_row:false
 });
 assert.equal(result.aggregates[0].dance,3);
 assert.equal(JSON.stringify(result).includes("listener_hash"),false);
 assert.equal(JSON.stringify(result).includes("network_hash"),false);
 assert.equal(JSON.stringify(result).includes("should-not-appear"),false);
});
test("invalid or duplicate aggregates refuse export",()=>{
 assert.throws(()=>makeFeedbackSnapshot(queue,[{id:"track-a",plays:3,ratings:1,dance:2,stars:5}],
   {seed:"a"}),/INVALID_FEEDBACK_REACTION_TOTAL/);
 assert.throws(()=>makeFeedbackSnapshot(queue,[
   {id:"track-a",plays:0,ratings:0,dance:0,stars:null},
   {id:"track-a",plays:0,ratings:0,dance:0,stars:null},
 ],{seed:"a"}),/DUPLICATE_FEEDBACK_SCORE_ROW/);
 assert.throws(()=>makeFeedbackSnapshot(queue,[],{seed:""}));
});
