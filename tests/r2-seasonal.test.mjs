import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const r2=require("../fm/r2-catalog.js");
const fair=require("../fm/fair-rotation.js");
const rotation=JSON.parse(readFileSync("fm/rotation.json","utf8"));
const empty=JSON.parse(readFileSync("fm/r2-tracks.json","utf8"));
assert.equal(empty.schema,"humkin.radio.r2/v1");
assert.equal(empty.tracks.length,1,"The actual user-supplied R2 object key is staged");
const staged=empty.tracks[0];
assert.equal(staged.id,"blue-at-the-tip");
assert.equal(staged.object_key,"tracks/Blue At The Tip.mp3");
assert.equal(staged.seasonal,true,"Owner specified seasonal 3x intent");
assert.equal(staged.approved,true,"Public R2 MP3 successfully verified and approved");
assert.equal(staged.duration_seconds,193.96,"ffprobe measured exact duration");
assert.equal(staged.sha256,
 "2958309e915c076bed880349fbb61c0c8d8b9dcd97f4e619a5f6c5661a23cd16",
 "Public R2 bytes integrity fingerprint");
assert.equal(r2.objectUrl(staged.object_key),
  "https://media.abundent.org/tracks/Blue%20At%20The%20Tip.mp3");
const verified=r2.parse(empty,"cover.jpg");
assert.equal(verified.length,1,"Approved R2 MP3 must join radio");
assert.equal(verified[0].id,"r2-blue-at-the-tip");
assert.equal(verified[0].duration,193.96);
assert.equal(verified[0].seasonal,true);
assert.equal(r2.objectUrl("tracks/Fall Anthem.mp3"),
 "https://media.abundent.org/tracks/Fall%20Anthem.mp3");
for(const bad of ["../private.mp3","private//bad.mp3","secret.wav",
 "music/song.mp3?token=private","/absolute.mp3","bad\\file.mp3"]){
 assert.equal(r2.objectUrl(bad),null,"Reject invalid R2 key "+bad);
}
const fixture={schema:"humkin.radio.r2/v1",tracks:[
 {id:"fall-anthem",object_key:"tracks/Fall Anthem.mp3",title:"Fall Anthem",
  artist:"HUMKIN",album:"HUMKIN RADIO · SEASONAL",duration_seconds:180,
  approved:true,seasonal:true},
 {id:"unreleased-take",object_key:"private/Unreleased.mp3",title:"Unreleased",
  duration_seconds:184,approved:false,seasonal:true},
 {id:"fall-anthem",object_key:"tracks/Duplicate.mp3",title:"Duplicate",
  duration_seconds:120,approved:true,seasonal:true}
]};
const approved=r2.parse(fixture,"https://humkin.abundent.org/cover.jpg");
assert.equal(approved.length,1,"Only approved, unique public tracks qualify");
assert.equal(approved[0].source,"r2");
assert.equal(approved[0].id,"r2-fall-anthem");
assert.equal(approved[0].seasonal,true);

const tracks=[...rotation.tracks.map(t=>({...t,kind:"song"})),...approved];
const eligible=tracks.map((_,i)=>i);
const featured=eligible.filter(i=>
 rotation.featured_rotation.albums.includes(tracks[i].album)||
 rotation.featured_rotation.singles.includes(tracks[i].id));
const seasonal=r2.additionalPositions(eligible,tracks,featured,rotation.seasonal_rotation);
const index=tracks.length-1;
assert.deepEqual(seasonal,[index,index],"R2 seasonal 1x base +2 slots = 3x");
const featuredSeasonal=tracks.map(t=>({...t,seasonal:t.id==="mutant-pop-01"||t.seasonal}));
assert.deepEqual(r2.additionalPositions(eligible,featuredSeasonal,featured,rotation.seasonal_rotation),
 [0,index,index],"Featured 2x +1 seasonal slot = 3x");

// Reproduce the seeded radio shuffle so repeated cycles and clock guards can
// be verified without a network, an MP3 upload or listener data.
function shuffle(n,seed){
 const list=Array.from({length:n},(_,i)=>i);
 let state=(seed^0x9e3779b9)>>>0;
 const random=()=>{
  state=(state+0x6d2b79f5)>>>0;
  let x=state;x=Math.imul(x^(x>>>15),x|1);
  x^=x+Math.imul(x^(x>>>7),x|61);
  return ((x^(x>>>14))>>>0)/4294967296;
 };
 for(let i=n-1;i>0;i--){
  const j=Math.floor(random()*(i+1));
  [list[i],list[j]]=[list[j],list[i]];
 }
 return list;
}
let prior=[];
let clockTotal=0;
for(let cycle=0;cycle<100;cycle++){
 const order=fair.weightedCycle(tracks.length,cycle,shuffle,featured,seasonal);
 const cnt=new Map();
 for(let i=0;i<order.length;i++){
  const idx=order[i];
  cnt.set(idx,(cnt.get(idx)||0)+1);
  assert(!order.slice(Math.max(0,i-4),i).includes(idx),
   "No immediate reruns, even with seasonal extras");
 }
 assert.equal(cnt.get(index),3,"R2 seasonal track: three total spins per cycle");
 assert.equal(cnt.get(0),2,"Published album tracks stay 2x");
 assert.equal(cnt.get(20),1,"Unfeatured radio-only tracks stay 1x");
 assert.equal(order.length,tracks.length+featured.length+seasonal.length);
 const duration=order.reduce((ms,i)=>ms+Math.round(tracks[i].duration*1000),0);
 if(cycle===0)clockTotal=duration;
 assert.equal(duration,clockTotal,"Same-Time cycle duration must be invariant");
 if(prior.length){
  const guard=4,ending=new Set(prior.slice(-guard));
  assert(order.slice(0,guard).every(id=>!ending.has(id)),
   "Clock cycles must not restart with the last four played");
 }
 prior=order;
}
console.log("R2 manifest + 3x seasonal rotation tests passed (100 seeded cycles)");
