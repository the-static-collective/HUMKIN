import assert from "node:assert/strict";
import test from "node:test";
import worker,{approvedCatalog,continuousStream} from "./worker.mjs";
import {STATIONS,stationClock,activeSlot,matchFilter,resolveStation,
  describeStations,getStation} from "./stations.mjs";

const hash="3b9e287699f677833ccc463cb3b33b56739a1f4c952b1d24ebf6bd51c577ffdb";
function row(n,kind="song",extra={}){
 const id=String(n).padStart(8,"0")+"-f76f-46d4-b139-8f4eb90dd096";
 return {id,title:"Track "+n,artist:"Original Artist",album:"Original Album",
  kind,enabled:true,published_at:"2026-11-17T22:00:00Z",
  storage_provider:"r2",r2_object_key:"tracks/"+id+"/"+hash+".mp3",
  duration_seconds:180,is_single:false,...extra};
}
function catalog(){
 const tracks=approvedCatalog([row(1),row(2,"song",{is_single:true}),
   row(3,"bumper",{duration_seconds:15}),row(4,"song",{enabled:false})],
   {schema:"humkin.radio.r2/v1",tracks:[{id:"summer-note",approved:true,
    object_key:"tracks/summer-note.mp3",title:"Summer Note",artist:"Eno Efia",
    album:"Unshackled Dreams",duration_seconds:200,seasonal:true,tags:["island"]}]});
 tracks.bumper_rules=[];
 tracks.bumper_groups=[];
 return tracks;
}
test("station list contains a ready eclectic channel and parked unprogrammed concepts",()=>{
 const list=describeStations(catalog(),new Date("2026-11-18T20:00:00Z"));
 assert(list.find(x=>x.id==="eclectic").ready);
 assert(!list.find(x=>x.id==="talk").enabled);
 assert.equal(list.find(x=>x.id==="talk").stream,null);
 assert.equal(getStation("not-a-station"),null);
});
test("station filter supports editorial metadata without widening empty selections",()=>{
 const tracks=catalog();
 assert.equal(tracks[0].artist,"Original Artist");
 assert.equal(tracks.at(-1).album,"Unshackled Dreams");
 assert(matchFilter(tracks.at(-1),{tags:["island"]}));
 assert(!matchFilter(tracks.at(-1),{tags:["talk"]}));
 assert(!matchFilter(tracks.at(-1),{track_ids:[]}));
 assert(!matchFilter(tracks.at(-1),{artists:[]}));
 assert.equal(resolveStation(getStation("seasonal"),tracks).tracks.filter(x=>x.kind==="song").length,1);
});
test("virtual program activates on Chicago time independently of listener location",()=>{
 const station=getStation("spotlight");
 const before=new Date("2026-11-18T22:59:00Z"); // 4:59 PM Chicago, standard time
 const during=new Date("2026-11-18T23:01:00Z");
 const after=new Date("2026-11-19T04:01:00Z");  // 10:01 PM Chicago
 assert.equal(stationClock(during).minute,17*60+1);
 assert.equal(activeSlot(station,before),null);
 assert.equal(activeSlot(station,during).id,"evening-singles");
 assert.equal(activeSlot(station,after),null);
 const tracks=catalog();
 assert.equal(resolveStation(station,tracks,before).program_name,"Regular rotation");
 const evening=resolveStation(station,tracks,during);
 assert.equal(evening.program_name,"Evening Singles");
 assert.deepEqual(evening.tracks.filter(t=>t.kind==="song").map(t=>t.title),["Track 2","Summer Note"]);
 assert(evening.tracks.some(t=>t.kind==="bumper"));
});
test("holds remain voluntary and active holds exclude short carts",()=>{
 const tracks=catalog();
 const cart=tracks.find(t=>t.kind==="bumper");
 tracks.bumper_rules=[{enabled:true,kind:"hold",track_ids:[cart.id]}];
 assert(!resolveStation(getStation("eclectic"),tracks).tracks.some(t=>t.key===cart.key));
 tracks.bumper_rules[0].enabled=false;
 assert(resolveStation(getStation("eclectic"),tracks).tracks.some(t=>t.key===cart.key));
});
test("an empty scheduled program does not silently play a different library",()=>{
 const custom={id:"custom",enabled:true,mode:"virtual",include_bumpers:false,
  filter:{kinds:["song"]},programs:[{id:"empty",name:"Empty",
   days:[3],start_minute:17*60,end_minute:18*60,filter:{track_ids:[]}}]};
 const sel=resolveStation(custom,catalog(),new Date("2026-11-18T23:01:00Z"));
 assert.equal(sel.program_name,"Empty");
 assert.equal(sel.tracks.length,0);
});
test("Worker serves multiple bounded station routes without mutating old URLs",async()=>{
 const old=globalThis.fetch,rows=[row(1),row(2,"song",{is_single:true}),row(3,"bumper")];
 globalThis.fetch=async url=>{
  const path=String(url);
  return new Response(JSON.stringify(path.includes("r2-tracks.json")?
   {schema:"humkin.radio.r2/v1",tracks:[]}:path.includes("humkin_radio_settings")?[]:rows),
   {status:200,headers:{"Content-Type":"application/json"}});
 };
 const streamData=Uint8Array.from([255,251,144,0,12,34]);
 const source={get:async()=>({body:new ReadableStream({start(ctrl){
   ctrl.enqueue(streamData);ctrl.close();
 }})})};
 const env={RADIO_MEDIA:source};
 try{
  const index=await worker.fetch(new Request("https://radio.example/stations"),env);
  assert.equal(index.status,200);
  const obj=await index.json();
  assert.equal(obj.synchronized,false);
  assert(obj.stations.some(s=>s.id==="eclectic"&&s.ready));
  const gone=await worker.fetch(new Request("https://radio.example/stations/nope/live.mp3"),env);
  assert.equal(gone.status,404);
  const disabled=await worker.fetch(new Request("https://radio.example/stations/talk/live.mp3"),env);
  assert.equal(disabled.status,404);
  const head=await worker.fetch(new Request("https://radio.example/stations/eclectic/live.mp3",{method:"HEAD"}),env);
  assert.equal(head.status,200);
  assert.equal(head.headers.get("x-humkin-station"),"eclectic");
  const radio=await worker.fetch(new Request("https://radio.example/stations/eclectic/live.mp3"),env);
  assert.equal(radio.status,200);
  assert.equal(radio.headers.get("content-type"),"audio/mpeg");
  assert.equal(radio.headers.get("x-humkin-synchronized"),"false");
  const reader=radio.body.getReader(),sample=await reader.read();
  assert.equal(sample.value[0],255);
  await reader.cancel();
  const legacy=await worker.fetch(new Request("https://radio.example/health"),env);
  assert.equal(legacy.status,200);
  const legacyAudio=await worker.fetch(new Request("https://radio.example/live.mp3",{method:"HEAD"}),env);
  assert.equal(legacyAudio.status,200);
 }finally{globalThis.fetch=old}
});

test("active virtual program switches at an audio boundary without another transmitter",async()=>{
 const tracks=catalog(),first=tracks[0],second=tracks[1];
 let selections=0;
 const objectBytes=new Map([[first.key,11],[second.key,22]]);
 const output=continuousStream({
   get:async key=>({body:new ReadableStream({start(c){
     c.enqueue(Uint8Array.from([255,251,144,0,objectBytes.get(key),0]));c.close();
   }})})
 },tracks,{maxObjects:3,seed:1,resolveTracks:()=>{
   const one=selections++===0;
   return {key:one?"morning":"evening",tracks:one?[first]:[second]};
 }});
 const reader=output.getReader(),parts=[];
 while(true){const {done,value}=await reader.read();if(done)break;parts.push(...value)}
 assert.deepEqual([parts[4],parts[10],parts[16]],[11,22,22]);
 assert(selections>=3);
});
test("approved voice carts may be intentional primary talk programming",()=>{
 const tracks=catalog();
 const station={id:"talk-test",enabled:true,mode:"personal",include_bumpers:false,
   filter:{kinds:["bumper"]}};
 const resolved=resolveStation(station,tracks);
 assert.equal(resolved.tracks.length,1);
 assert.equal(resolved.tracks[0].kind,"song");
 assert.equal(resolved.tracks[0].featured,false);
});
