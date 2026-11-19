import test from "node:test";
import assert from "node:assert/strict";
import {normalizeCatalog,buildAccidentSet,makeV20Handoff,HANDOFF_SCHEMA} from "../fm/autodisco/accident-core.mjs";
const mp3=id=>"https://media.abundent.org/tracks/"+id+".mp3";
const make=(id,album,artist,plays)=>({id,title:id,album,artist,duration:120,src:mp3(id),
  plays,artwork:"https://humkin.abundent.org/cover.jpg"});
test("published Compost data is filtered to safe eligible media, excluding bumpers",()=>{
  const items=normalizeCatalog({tracks:[
    {...make("song-a","One","A",0),kind:"song"},
    {...make("song-b","One","A",0),kind:"bumper"},
    {...make("song-c","Two","B",0),src:"https://evil.example/c.mp3"},
    {...make("song-a","One","A",0),title:"duplicate"},
    {...make("song-d","Two","B",0),kind:"feature"}],
    scores:[{id:"song-a",plays:7}]});
  assert.deepEqual(items.map(x=>x.id),["song-a","song-d"]);
  assert.equal(items[0].plays,7);assert.equal(items[1].plays,null);
});
test("selection is repeatable, least-heard first, variety on ties",()=>{
  const items=[make("track-a","A","A",20),make("track-b","A","A",0),
    make("track-c","B","B",0),make("track-d","C","C",1)];
  const left=buildAccidentSet(items,{seed:"2026-11-18",size:3});
  assert.deepEqual(left,buildAccidentSet(items,{seed:"2026-11-18",size:3}));
  assert.deepEqual(left.slice(0,2).map(x=>x.id).sort(),["track-b","track-c"]);
  assert.equal(left.at(-1).id,"track-d");
});
test("curator handoff is explicitly NOT a fabricated V20 listen",()=>{
  const result=makeV20Handoff([make("track-a","Album","Artist",null)],{
    seed:"test",createdAt:"2026-11-18T20:00:00Z"});
  assert.equal(result.schema,HANDOFF_SCHEMA);
  assert.equal(result.status,"editorial-candidate-only");
  assert.equal(result.editorial_candidates[0].observed_play_count,null);
  assert.equal(result.isolation.curator_context_must_not_enter_dj_prompt,true);
  assert.equal(JSON.stringify(result).includes("first_responses"),false);
  assert.throws(()=>makeV20Handoff([make("bad track","A","B",0)]));
});
test("invalid snapshots fail closed",()=>{
  assert.throws(()=>normalizeCatalog({tracks:[]}));
  assert.deepEqual(buildAccidentSet([]),[]);
  assert.throws(()=>buildAccidentSet([make("track-a","A","B",0)],{size:500}));
});
