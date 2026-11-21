const assert=require("node:assert/strict");
const fs=require("node:fs");
const relations=require("../fm/bumper-relations.js");
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
 "crate-hard-short":{role:"musical",edit_group:"hard-dark-master"},
 "crate-hard-long":{role:"musical",edit_group:"hard-dark-master"},
 "crate-taken-teaser":{role:"musical"},
 "crate-opener":{role:"show_opener"},
 "crate-feature":{role:"feature"}
};
const options={...policy,profiles};
const result=brain.plan(songs,bumpers,4,tracks,options);
assert(result.breaks.length>20,"Should have many scheduled breaks");
assert.equal(result.held.length,0,"Approved art should not be held for names, format or duration lane");
for(const id of ["crate-opener","crate-feature","crate-news"])
 assert.equal(brain.classify(tracks.find(x=>x.id===id),options).hold,false,
   "Neither opener, full feature nor fictional clock headline is an automatic hold");
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
const shortPositions=result.breaks.filter(b=>b.lane==="short").map(b=>b.afterSong);
assert(shortPositions.every((n,i)=>n>1&&(i===0||n-shortPositions[i-1]>=2)),
 "No shortie may follow a shortie at the next song boundary or cross a cycle seam");
const dense=brain.plan(songs.slice(0,24),bumpers,1,tracks,options);
const denseShortPositions=dense.breaks.filter(b=>b.lane==="short").map(b=>b.afterSong);
assert(denseShortPositions.length>=2,"Dense setting should still allow shorties");
assert(denseShortPositions.every((n,i)=>n>1&&(i===0||n-denseShortPositions[i-1]>=2)),
 "Even the densest shortie setting cannot put them after consecutive songs");
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
const heldOptions={...options,profiles:{...profiles,
 "crate-feature":{...profiles["crate-feature"],hold:true}}};
assert(brain.plan(songs,bumpers,4,tracks,heldOptions).held.some(b=>b.id==="crate-feature"),
 "Only an expressly configured future hold should exclude a valid recording");
const altered=brain.plan([...songs].reverse(),bumpers,4,tracks,options);
assert.deepEqual(altered.breaks,result.breaks,"Same-time recipients get an identical bumper order regardless of shuffled songs");
assert.equal(altered.sequence.length,result.sequence.length,"Shared-clock cycle length stays stable");
assert.deepEqual(brain.plan(songs,bumpers,4,tracks,options),result,"Deterministic for every receiver");
// A static order was repeated on every real on-air clock cycle. A rotation
// seed now remixes *which approved cart follows which song* while preserving
// each exact cart multiset and total duration; both are necessary for the
// shared-clock station's epoch arithmetic and fair length-lane distribution.
const checksum=sequence=>sequence.reduce((sum,index)=>
  sum+Math.round(tracks[index].duration*1000),0);
const baseChecksum=checksum(result.sequence);
const laneCount=lane=>routine.filter(t=>brain.classify(t,options).lane===lane).length;
const canonCounts=new Map();
for(const b of result.breaks)canonCounts.set(b.id,(canonCounts.get(b.id)||0)+1);
const signatures=new Set();
for(let seed=1;seed<=64;seed++){
 const mixed=brain.remix(result,bumpers,tracks,options,seed);
 const repeated=brain.remix(result,bumpers,tracks,options,seed);
 assert.deepEqual(mixed,repeated,"Cycle "+seed+" must give every listener the same bumpers");
 assert.equal(checksum(mixed.sequence),baseChecksum,
   "Cycle "+seed+" must keep the exact broadcast duration in milliseconds");
 assert.equal(mixed.sequence.length,result.sequence.length,
   "Remixed bumpers cannot add or remove song slots");
 assert.deepEqual(mixed.sequence.filter(i=>i<songs.length),songs,
   "Remixed bumpers must not change the underlying song order");
 assert.deepEqual(mixed.breaks.map(x=>x.lane),result.breaks.map(x=>x.lane),
   "Every short/medium/long break opportunity stays in its lane");
 const counts=new Map();
 for(const b of mixed.breaks)counts.set(b.id,(counts.get(b.id)||0)+1);
 assert.deepEqual(counts,canonCounts,
   "Every seed must use the same approved cart multiset, not just the same count");
 for(const lane of ["short","medium","long"]){
  const peers=laneCount(lane);
  const first=mixed.breaks.filter(b=>b.lane===lane).slice(0,peers);
  assert.equal(new Set(first.map(b=>b.id)).size,first.length,
   "Within a "+lane+" bag, every cart plays before repeating");
 }
 signatures.add(mixed.breaks.map(b=>b.id).join("|"));
}
assert(signatures.size>=24,
 "64 numbered rotations should not sound like the same bumper sequence");
const reversedCycle=brain.remix(
 brain.plan([...songs].reverse(),bumpers,4,tracks,options),
 bumpers,tracks,options,17);
assert.deepEqual(reversedCycle.breaks,brain.remix(result,bumpers,tracks,options,17).breaks,
 "Shared-clock bumper assignment must ignore which song is in each slot");
assert.equal(checksum(reversedCycle.sequence),baseChecksum,
 "Shuffling song order cannot change the shared-clock rotation duration");
assert.strictEqual(brain.remix(result,bumpers,tracks,options,0),result,
 "Seed zero retains the canonical Station Manager preview");

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
assert(radio.includes("HUMKIN_BUMPER_BRAIN?.remix"),"Radio must actually use the rotating bumper bags");
assert(radio.includes("withStationIds(weightedMusic(eligible,rotation),rotation)"),"Shared-clock cycle number must drive bumper remix");
assert(radio.includes("withStationIds(sorted,seed||1)"),"Road Shuffle needs a new cart order on each shuffle build");
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
// All groups are EXPLICIT owner-authored; no title or profile silently groups art.
const kin=[
 {index:135,id:"cut-21s",title:"Hard Dark Train 21s",family:"cut-21s",lane:"medium",seconds:21},
 {index:136,id:"other-voice",title:"Another Work",family:"other-voice",lane:"short",seconds:8},
 {index:137,id:"cut-42s",title:"Hard Dark Train 42s",family:"cut-42s",lane:"medium",seconds:42},
 {index:138,id:"other-recording",title:"A Third Work",family:"other-recording",lane:"medium",seconds:30}
];
relations.arrange(kin,[{id:"manual",kind:"repel",enabled:true,
 track_ids:["cut-21s","cut-42s"]}],{short:1,medium:3,long:0},3);
assert.equal(kin[2].id,"other-recording","Explicit REPEL exchanges an alternate cut");
assert.equal(kin[3].id,"cut-42s","Displaced cut still gets its scheduled turn");
assert.deepEqual(new Set(kin.map(x=>x.id)),new Set(["cut-21s","other-voice","cut-42s","other-recording"]));
assert.deepEqual(kin.map(x=>x.lane),["medium","short","medium","medium"]);
const ungrouped=brain.classify({id:"same-voice",title:"Robot Radio Days",duration:24},
 {profiles:{"same-voice":{role:"musical",family:"robot-radio",edit_group:"robot-master"}}});
assert.equal(ungrouped.family,"same-voice","Profiles never create groups");
assert.equal(relations.validGroups([]).length,0,"No grouping without explicit action");
assert(!Object.values(rotation.bumper_brain.profiles).some(x=>x.hold===true),
 "No assistant-inferred editorial holds");
assert(!Object.values(rotation.bumper_brain.profiles).some(x=>x.edit_group||x.family),
 "No family group preset without owner choice");
assert(html.includes("bumper-relations.js"),"Browser must load owner relation engine");
assert(manager.includes("bumperGroups")&&manager.includes("editorialRules"),
 "Owner groups and rules must be loaded into Station Manager");

console.log("Bumper Brain: "+result.breaks.length+" φ-short / ~11-minute medium / ~22-minute long breaks; "+result.held.length+" explicit holds; deterministic, tier-fair, unrelated art independent.");
