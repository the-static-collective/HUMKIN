import test from "node:test";import assert from "node:assert/strict";
import {compileProgram,segmentAt,renderPlaylist,publicSchedule} from "../tools/radio-broadcast/cloudflare/cloud-autopilot.mjs";
import {parseHlsCues,trackAt} from "../fmstudio/receiver/core.mjs";
const t=Date.parse("2026-11-01T00:00:00Z");
const id=n=>"rec-"+String(n).repeat(64);
const session={id:"session-one",title:"Rain on the Receiver",artist:"HUMKIN",asset_sha:"a".repeat(64),durations_ms:Array(150).fill(8000),chapters:[
 {start_ms:0,recording_id:id(1),title:"First",artist:"HUMKIN"},
 {start_ms:183500,recording_id:id(2),title:"Second",artist:"HUMKIN"},
 {start_ms:700000,recording_id:id(3),title:"Third",artist:"HUMKIN"}]};
const data={schema:"humkin.cloud-autopilot/v1",station_id:"quiet-frequency",revisions:[{id:"r-one",effective_at:new Date(t).toISOString(),tracks:[session]}]};
test("chapter changes within a segment without changing asset or discontinuity",()=>{
 const p=compileProgram(data),a=segmentAt(p,t+183499),b=segmentAt(p,t+183500);
 assert.equal(a.sequence,b.sequence);assert.equal(a.asset,b.asset);assert.equal(a.discontinuity,b.discontinuity);
 const cue=parseHlsCues(renderPlaylist(p,t+183500+15000));
 assert.equal(trackAt(cue,t+183499).title,"First");assert.equal(trackAt(cue,t+183500).title,"Second");
 assert.equal(trackAt(cue,t+183500).id,id(2));assert.equal(trackAt(cue,t+183500).session_title,session.title);
});
test("late join carries chapter already in progress and schedule projects logical tracks",()=>{
 const p=compileProgram(data),now=t+350000+15000;
 const cue=parseHlsCues(renderPlaylist(p,now));assert.equal(trackAt(cue,t+350000).title,"Second");
 const schedule=publicSchedule(p,now);assert.equal(schedule.rotation_track_count,1);assert.equal(schedule.rotation_chapter_count,3);
 assert.equal(schedule.upcoming[0].track.id,id(2));assert.equal(schedule.upcoming[1].track.id,id(3));
});
test("invalid offsets rejected",()=>{const broken=structuredClone(data);broken.revisions[0].tracks[0].chapters[1].start_ms=0;assert.throws(()=>compileProgram(broken),/INVALID_CHAPTER/);});
