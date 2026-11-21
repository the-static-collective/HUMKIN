import test from "node:test";
import assert from "node:assert/strict";
import {availableRecordings,buildPausedFeature,minutes,move} from "../fm/load/feature-core.mjs";

const owner="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const song="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const interview="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const pending="dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const rows=[
 {id:song,title:"Song",kind:"song",published_at:"2026-11-21T12:00:00Z",enabled:true,duration_seconds:180},
 {id:interview,title:"Interview",kind:"bumper",published_at:"2026-11-21T12:00:00Z",enabled:true,duration_seconds:262.5},
 {id:pending,title:"Unpublished draft",kind:"song",published_at:null,enabled:false,duration_seconds:90}
];
test("only eligible approved song and feature clips may enter an ordered program",()=>{
 assert.deepEqual(availableRecordings(rows).map(x=>x.id),[song,interview]);
 const packet=buildPausedFeature({name:"Fellowship Feature",days:[5,0],
  start:"19:00",end:"20:00",trackIds:[song,interview,song]},rows,owner);
 assert.deepEqual(packet.track_ids,["crate-"+song,"crate-"+interview,"crate-"+song]);
 assert.deepEqual(packet.days,[0,5]);
 assert.equal(packet.is_active,false);
 assert.equal(packet.priority,0);
 assert.equal(packet.start_minute,1140);
 assert.equal(packet.end_minute,1200);
 assert.equal(packet.owner_id,owner);
});
test("draft refuses hidden/unpublished clips, forged IDs, malformed windows and bad owners",()=>{
 const base={name:"A Feature",days:[5],start:"07:00",end:"08:00",trackIds:[song]};
 for(const change of [
  {trackIds:[pending]}, {trackIds:["r2-../../private"]},
  {days:[]}, {days:[5,5]}, {days:[7]}, {start:"23:30",end:"00:30"},
  {start:"xx",end:"11:00"}, {trackIds:[]}
 ]) assert.throws(()=>buildPausedFeature({...base,...change},rows,owner));
 assert.throws(()=>buildPausedFeature(base,rows,"not-owner"));
});
test("edit operations move only approved slot indices without changing their identity",()=>{
 assert.deepEqual(move([song,interview,song],1,-1),[interview,song,song]);
 assert.deepEqual(move([song,interview,song],0,-1),[song,interview,song]);
 assert.deepEqual(move([song,interview],0,1),[interview,song]);
 assert.equal(minutes("19:45"),1185);
});
