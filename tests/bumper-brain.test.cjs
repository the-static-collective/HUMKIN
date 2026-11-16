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
assert(result.breaks.every(b=>b.seconds<=49));
assert(new Set(result.breaks.map(b=>b.afterSong)).size===result.breaks.length);
assert.deepEqual(result.sequence.filter(i=>i<songs.length),songs,"Songs stay complete and in order");
assert.equal(result.sequence.length,songs.length+result.breaks.length);
const gaps=result.breaks.map((b,i)=>b.afterSong-(result.breaks[i-1]?.afterSong||0));
assert(gaps.includes(3)&&gaps.includes(4)&&gaps.includes(5)&&gaps.includes(6),
 "Vary 3–6 song breaks while maintaining the same plan length");
for(let i=0;i<result.breaks.length;i++){
 const previous=result.breaks.slice(Math.max(0,i-4),i);
 if(entries.length>5)assert(!previous.some(x=>x.family===result.breaks[i].family),
  "Family should not recur within four breaks: "+result.breaks[i].family);
}
const altered=brain.plan([...songs].reverse(),bumpers,4,tracks,options);
assert.deepEqual(altered.breaks,result.breaks,"Same-time recipients get an identical bumper order regardless of shuffled songs");
assert.equal(altered.sequence.length,result.sequence.length,"Shared-clock cycle length stays stable");
assert.deepEqual(brain.plan(songs,bumpers,4,tracks,options),result,"Deterministic for every receiver");
const legacy=brain.plan(songs.slice(0,21),bumpers.slice(0,1),3,tracks,options);
assert.deepEqual(legacy.breaks.map(b=>b.afterSong),[3,6,9,12,15,18,21],
 "Cadence 3 stays exact for short collections");
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
console.log("Bumper Brain: "+result.breaks.length+" deterministic, family-spaced breaks; "+result.held.length+" show-only holds; machine is human-review-only.");
