const assert=require("node:assert/strict");
const fs=require("node:fs");
const brain=require("../fm/bumper-brain.js");
const rotation=JSON.parse(fs.readFileSync("fm/rotation.json","utf8"));
assert.equal(rotation.bumper_brain.schema,"humkin.radio.bumper-brain/v1");
const policy=rotation.bumper_brain;
const songs=Array.from({length:135},(_,i)=>i);
const entries=[
 {id:"crate-hard-short",title:"Hard Dark Train",duration:21},
 {id:"crate-hard-long",title:"Hard dark trains",duration:42},
 {id:"crate-taken-teaser",title:"Taken minute",duration:24.6},
 {id:"crate-opener",title:"Taken Minute Opener",duration:56},
 {id:"crate-feature",title:"Taken Minute",duration:102.5},
 {id:"crate-news",title:"Top of the Hour",duration:30},
 {id:"crate-records",title:"Oh Hey There — Vintage AM Cart",duration:9.7},
 {id:"crate-comedy",title:"Art is Difficult",duration:34},
 {id:"crate-warm",title:"Lantern Bells Station ID",duration:14},
 {id:"crate-goat",title:"Farm desk",duration:18},
 {id:"crate-other",title:"Very Good Things",duration:12},
 {id:"crate-long-a",title:"The full longer feature",duration:68},
 {id:"crate-long-b",title:"Longer story about us",duration:83},
 {id:"crate-long-c",title:"Funny long recording",duration:94},
];
const bumpers=entries.map((_,i)=>songs.length+i),tracks=[
 ...songs.map((i)=>({id:"song-"+i,kind:"song",duration:180,title:"Song "+i})),
 ...entries.map(t=>({...t,kind:"bumper"}))
];
const profiles={
 ...policy.profiles,
 "crate-hard-short":{role:"musical",family:"hard-dark"},
 "crate-hard-long":{role:"musical",family:"hard-dark"},
 "crate-taken-teaser":{role:"musical",family:"taken-minute"},
 "crate-opener":{role:"show_opener",family:"taken-minute",hold:true},
 "crate-feature":{role:"feature",family:"taken-minute",hold:true}
};
const options={...policy,profiles};
const result=brain.plan(songs,bumpers,4,tracks,options);
assert(result.breaks.length>20,"Should have many scheduled breaks");
assert(result.held.some(b=>b.title==="Taken Minute Opener"),"Show opener must be held");
assert(result.held.some(b=>b.seconds>100),"Full-length music feature held");
assert(result.held.some(b=>b.title==="Top of the Hour"),"Clock claims held");
assert(!result.breaks.some(b=>/opener|top of the hour/i.test(b.title)));
assert(result.breaks.every(b=>b.seconds<=180),"No oversized, unapproved cart can air");
assert(result.breaks.some(b=>b.lane==="long"),"Approved long features must get ~22-minute slots");
assert(result.breaks.some(b=>b.lane==="medium"),"Medium segments must get ~11-minute slots");
assert(result.breaks.some(b=>b.lane==="short"),"Short φ drops must get frequent slots");
assert(new Set(result.breaks.map(b=>b.afterSong)).size===result.breaks.length);
assert.deepEqual(result.sequence.filter(i=>i<songs.length),songs,"Songs stay complete and in order");
assert.equal(result.sequence.length,songs.length+result.breaks.length);
// φ should make short IDs feel spontaneous, not follow every Nth song.
const shortGaps=result.breaks.filter(b=>b.lane==="short").map((b,i,a)=>
 i?b.afterSong-a[i-1].afterSong:null).filter(x=>x!==null);
assert(new Set(shortGaps).size>=3,"Short drops require nonuniform golden-ratio gaps");
const longEvents=result.breaks.filter(b=>b.lane==="long");
assert(longEvents.length>=5);
for(let i=1;i<longEvents.length;i++){
 const delta=longEvents[i].estimatedMinute-longEvents[i-1].estimatedMinute;
 assert(delta>=17&&delta<=28,"Long feature anchors should be ~22 minutes, got "+delta);
}
const anchored=result.breaks.filter(b=>b.lane!=="short");
assert(anchored.length>=20);
for(let i=1;i<anchored.length;i++){
 const delta=anchored[i].estimatedMinute-anchored[i-1].estimatedMinute;
 assert(delta>=6&&delta<=17,"A medium-or-long interlude should recur ~11–12 minutes: "+delta);
}
// The source label never affects lane or its bag. Each tier is separately
// equal-weight: more SHORT SLOTS does not mean we pick particular short carts.
const routine=entries.filter(x=>!brain.classify(x,options).hold);
const spins=new Map();
for(const b of result.breaks)spins.set(b.id,(spins.get(b.id)||0)+1);
for(const lane of ["short","medium","long"]){
 const peers=routine.filter(t=>brain.classify(t,options).lane===lane);
 assert(peers.length>=2,"Fixture needs two recordings per length lane: "+lane);
 const totals=peers.map(t=>spins.get(t.id)||0);
 assert(Math.max(...totals)-Math.min(...totals)<=1,
   "Each "+lane+" recording should have one turn per lane bag");
 const initial=result.breaks.filter(b=>b.lane===lane).slice(0,peers.length);
 assert.deepEqual(new Set(initial.map(b=>b.id)),new Set(peers.map(t=>t.id)),
   "No "+lane+" bumper repeats before its lane bag is exhausted");
}
const shelfNames=["HUMKIN RADIO · FIELD CARTS",
 "HUMKIN RADIO · PREVIEW CARTS","HUMKIN RADIO · INBOX"];
const mixedTracks=tracks.map((t,i)=>t.kind==="bumper"?
 {...t,album:shelfNames[(i-songs.length)%3]}:t);
const mixed=brain.plan(songs,bumpers,4,mixedTracks,options);
assert.deepEqual(mixed.breaks,result.breaks,
 "Storage shelf labels must not affect airtime, cadence or priority");
const manuallyHeld=entries.find(e=>e.id==="crate-feature");
assert(result.held.some(b=>b.id===manuallyHeld.id),
 "An expressly held long feature must stay held");
const altered=brain.plan([...songs].reverse(),bumpers,4,tracks,options);
assert.deepEqual(altered.breaks,result.breaks,"Same-time recipients get an identical bumper order regardless of shuffled songs");
assert.equal(altered.sequence.length,result.sequence.length,"Shared-clock cycle length stays stable");
assert.deepEqual(brain.plan(songs,bumpers,4,tracks,options),result,"Deterministic for every receiver");
const legacy=brain.plan(songs.slice(0,21),bumpers.slice(0,1),3,tracks,options);
assert(legacy.breaks.length>=5&&legacy.breaks.length<=8,
 "A smaller density setting should shorten the medium lane without forcing a rigid count");
assert(legacy.breaks.every(b=>b.lane==="medium"));
assert.deepEqual(brain.plan(songs,bumpers,0,tracks,options).sequence,songs);
const radio=fs.readFileSync("fm/radio.js","utf8"),html=fs.readFileSync("fm/index.html","utf8");
const manager=fs.readFileSync("fm/manage/manager.js","utf8");
const mgrPage=fs.readFileSync("fm/manage/index.html","utf8");
const worker=fs.readFileSync("sw.js","utf8");
assert(radio.includes("HUMKIN_BUMPER_BRAIN?.plan"),"Production radio must actually use Bumper Brain");
assert(html.indexOf("bumper-brain.js")<html.indexOf("radio.js"),"Radio loads brain before radio.js");
assert(manager.includes("renderBumperPreview"),"Manager must display a break plan");
assert(mgrPage.includes('id="bumper-preview"'),"Preview panel required");
assert(worker.includes('"./fm/bumper-brain.js"'),"Offline shell needs new helper");
const tool=fs.readFileSync("tools/generate-robot-drops.py","utf8");
const workflow=fs.readFileSync(".github/workflows/robot-desk-auditions.yml","utf8");
assert(tool.includes('"DRAFT / HUMAN REVIEW / NOT ON AIR"'),"Generated drops must be drafts");
assert(workflow.includes("workflow_dispatch:")&&workflow.includes("upload-artifact@v4"),
 "Robot machine should generate review-only packs");
assert(!workflow.includes("git push")&&!workflow.includes("service_role")&&!workflow.includes("curl -X POST"),
 "Scheduled action must never publish or send recordings to the air");
console.log("Bumper Brain: "+result.breaks.length+" φ-short / ~11-minute medium / ~22-minute long breaks; "+result.held.length+" editorial holds; deterministic and tier-fair.");
