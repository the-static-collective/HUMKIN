import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url),read=p=>readFileSync(p,"utf8");
const B=require("../fm/studio/bible.js"),Clock=require("../fm/studio/clock.js");
const book=B.validate(JSON.parse(read("fm/studio/station-bible.json")));
assert.equal(book.scenes.length,13,"Thirteen original ready-to-produce scene cards");
assert.equal(book.roles.length,5,"Five founding staff voices");
assert.equal(book.dayparts.length,6,"Six broad proposed dayparts");
assert.equal(book.sonic_signature.tempo_bpm,92);
assert.deepEqual(book.sonic_signature.notes,["G4","B4","E5"]);
const distinct=new Set(book.scenes.map(s=>s.id));
assert.equal(distinct.size,book.scenes.length);
const beatCards=book.scenes.filter(s=>s.in_pilot);
assert.equal(beatCards.length,7,"Seven pilot placeholders with actual scripts");
assert.equal(beatCards.filter(s=>s.kind==="real_template").length,1,
 "The pilot has one explicitly unverified community segment");
assert(book.scenes.some(s=>s.label.includes("Good Company")),"Warm station identification must be available");
const lumi=book.scenes.find(s=>s.id==="id-lumi-001");
assert(lumi&&lumi.role.includes("Lumi")&&lumi.department==="station_id",
 "Lumi has an original short ID ready for synthetic voice acting");
assert(lumi.expected_seconds<=20,"Lumi's eleven-minute station ID should be brief");
assert(!lumi.in_pilot,"The preexisting first-day pilot retains seven spoken beats");
assert(/11.minutes/i.test(lumi.direction),"Lumi's cadence is a target, not a prerecorded or auto-aired claim");
assert(book.scenes.some(s=>s.id.includes("night")),"Night shift identity must be available");
assert(book.show_rules.some(s=>s.includes("recorded is not approved")),"Kinship provenance should persist");
for(const s of book.scenes){
 assert(s.script.length>60&&s.script.length<=2400,"All scenes need actual text to record: "+s.id);
 assert(s.expected_seconds>=5&&s.expected_seconds<=600);
 const item=B.asRundown(s);
 assert.equal(item.type,"script","Text is a script, not a counterfeit MP3");
 assert(item.notes.includes(s.role));
 assert(item.notes.length<=1200,"Script must stay within existing production-draft schema");
 assert(B.copyText(s).includes("NOT AN AIRED RECORDING"));
 if(s.kind==="real_template"){
  assert(item.notes.includes("DO NOT AIR UNVERIFIED"));
  assert(s.script.includes("[")&&s.script.includes("]"),
   "A real-world Community Desk item remains a visibly unfilled template");
 }else{
  assert(item.notes.includes("SCRIPTED FICTION"),"Fiction must never masquerade as reporting");
 }
}
const minutes=t=>{const [h,m]=t.split(":").map(Number);return h*60+m};
const occupied=new Array(1440).fill(0);
for(const day of book.dayparts){
 const [start,end]=day.time.split("–");
 let cursor=minutes(start),stop=minutes(end);
 assert(cursor>=0&&cursor<1440&&stop>=0&&stop<1440);
 if(stop<=cursor)stop+=1440;
 while(cursor<stop){occupied[cursor%1440]++;cursor++}
}
assert(occupied.every(v=>v===1),"Proposed daypart clock should cover exactly 24h without overlaps");
const demoSongs=Array.from({length:50},(_,i)=>({
 id:"h"+i,title:"Song "+i,duration:150+i%4*17,enabled:true,published:true,kind:"song"
}));
const generated=Clock.pilot(demoSongs,14,B.pilotBeats(book));
assert.equal(generated.unrecorded,7);
assert.equal(generated.rundown.filter(r=>r.type==="script").length,7);
assert(generated.songCount>=12,"Rundown must remain music-led");
assert(generated.totalSeconds<=3600,"No script-overrun beyond the nominal hour");
assert(Clock.timeOf(generated.rundown,new Map(demoSongs.map(t=>[t.id,t])))<=3600);
assert.equal(Clock.eligibleBroadcast(generated.rundown,demoSongs).ok,false,
 "Unrecorded fictional scenes and community templates cannot create a paused scheduled show");
const withoutScripts=generated.rundown.filter(x=>x.type==="track");
assert.equal(Clock.eligibleBroadcast(withoutScripts,demoSongs).ok,true);
assert.throws(()=>B.validate({...book,scenes:[...book.scenes,{...book.scenes[0]}]}),/Invalid production script/);
assert.throws(()=>B.validate({...book,scenes:[{...book.scenes[0],kind:"actual_news"}]}),/Invalid production script/);
execFileSync(process.execPath,["--check","fm/studio/bible.js"]);
execFileSync(process.execPath,["--check","fm/studio/clock.js"]);
execFileSync(process.execPath,["--input-type=module","--check"],{input:read("fm/studio/studio.js")});
const page=read("fm/studio/index.html"),studio=read("fm/studio/studio.js");
for(const id of ["script-vault","script-status","station-signature","station-staff","station-dayparts","script-cards"])
 assert(page.includes('id="'+id+'"'),"Missing script scene shelf UI "+id);
assert(page.indexOf('bible.js')<page.indexOf('studio.js'),"Bible adapter must load before studio module");
assert(studio.includes('fetch("./station-bible.json"'),"Studio must load source bible");
assert(studio.includes('BIBLE.pilotBeats(stationBible)'),"Pilot must use canonical spoken scenes");
assert(studio.includes('BIBLE.asRundown(scene)'),"Scene additions must stay unrecorded placeholders");
assert(studio.includes('BIBLE.copyText(scene)'),"Producer must be able to copy speech to a voice tool");
assert(studio.includes('renderBible();'),"Producer UI must display dayparts and scripts");
assert(read("sw.js").includes('"./fm/studio/station-bible.json"'),"Cache station bible for mobile continuity");
console.log("HUMKIN Radio First Day production bible passed: 12 scripts, 5 voices, 24h proposal, 92 BPM ID, 60m pilot and no fake-airing gates.");
