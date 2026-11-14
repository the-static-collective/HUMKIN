import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const C=require("../fm/studio/clock.js");
const read=f=>readFileSync(f,"utf8");
execFileSync(process.execPath,["--check","fm/studio/clock.js"]);
execFileSync(process.execPath,["--input-type=module","--check"],{input:read("fm/studio/studio.js")});
assert.equal(C.DEPARTMENTS.length,9,"Cart machine should cover news, spots, community and other radio beats");
assert(C.DEPARTMENTS.some(([id])=>id==="news"));
assert(C.DEPARTMENTS.some(([id])=>id==="community"));
const songs=Array.from({length:80},(_,i)=>({
 id:"song-"+(i+1),title:"Song "+(i+1),artist:"HUMKIN",
 kind:"song",duration:165+i%5*8,published:true,enabled:true
}));
const example=C.pilot(songs,17);
assert(example.songCount>=16,"Pilot should fill a substantial part of the hour with real songs");
assert(example.unrecorded>=6,"Sketches/news must remain clearly identified as scripts, not synthetic audio");
assert(example.totalSeconds<=3600,"Pilot builder must not overrun the one-hour window");
assert.equal(new Set(example.rundown.filter(x=>x.type==="track").map(x=>x.trackId)).size,example.songCount,
 "Pilot cannot repeat songs to pad the clock");
assert.equal(C.eligibleBroadcast(example.rundown,songs).ok,false,
 "Unrecorded spoken beats cannot be saved as an on-air show");
const scripts=example.rundown.filter(x=>x.type==="script");
assert(scripts.every(x=>x.notes&&x.notes.length>30),"Every fictional news scene must have script directions");
const withoutScripts=example.rundown.filter(x=>x.type==="track");
assert(C.eligibleBroadcast(withoutScripts,songs).ok);
assert.equal(C.eligibleBroadcast([...withoutScripts,{type:"track",trackId:"missing",label:"Missing"}],songs).ok,false);
assert.equal(C.eligibleBroadcast([{type:"track",trackId:"song-1",label:"Song"}],songs.filter(x=>x.id!=="song-1")).ok,false);
assert.equal(C.prettyTime(3661),"1:01:01");
assert.equal(C.sanitizeRundown([null,{type:"invalid"}]).length,0);
assert(C.PILOT_BEATS.some(x=>/fictional|imaginary|verified/i.test(x[2])),"Script must clearly separate fiction from public facts");

const page=read("fm/studio/index.html"),studio=read("fm/studio/studio.js");
for(const id of ["workbench","auth","sign-in","cue","cue-name","cart-track",
  "cart-department","cart-label","cart-notes","carts","save-cart","draft-title",
  "song-pick","song-add","pilot","clear","save-draft","save-show","export",
  "clock","rundown","draft-status","feedback","cart-count"]){
 assert(page.includes('id="'+id+'"'),"Missing private studio UI "+id);
}
for(const match of studio.matchAll(/\$\("([^"]+)"\)/g))
 assert(page.includes('id="'+match[1]+'"'),"Studio script references missing UI "+match[1]);
assert(studio.includes('db.from("humkin_radio_carts")'),"Production carts must persist under owner RLS");
assert(studio.includes('db.from("humkin_radio_production_drafts")'),"Private producer draft must persist");
assert(studio.includes('is_active:false'),"Saving from rehearsal must never activate a show");
assert(studio.includes("if(!title||!result.ok)"),"Unrecorded script placeholders must block show creation");
assert(studio.includes('player.src=t.src'),"Rehearsal cue must play private local monitor only");
assert(!studio.includes("broadcastLive("),"Producer cannot imply a live mic takeover");
assert(studio.includes('account?.email?.toLowerCase()!==OWNER'),"Private producer must require owner authentication");
assert(read("fm/manage/index.html").includes('href="../studio/"'));
assert(read("fm/index.html").includes('href="./studio/"'));
assert(read("sw.js").includes('"./fm/studio/studio.js"'));
console.log("WKRP producer studio checks passed: 60m pilot, fictional script boundary, owner-only carts, saved drafts, safe show gating and local cue.");
