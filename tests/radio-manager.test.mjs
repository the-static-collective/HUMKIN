import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const S=require("../fm/scheduler.js");
const read=f=>readFileSync(f,"utf8");
const managerPage=read("fm/manage/index.html"),managerJs=read("fm/manage/manager.js");
const playerPage=read("fm/index.html"),playerJs=read("fm/radio.js");
for(const f of ["fm/manage/index.html","fm/manage/manager.js","fm/scheduler.js"]){
 assert(existsSync(f),"Missing station-manager file "+f);
}
execFileSync(process.execPath,["--input-type=module","--check"],{input:managerJs});
execFileSync(process.execPath,["--check","fm/scheduler.js"]);
execFileSync(process.execPath,["--check","fm/radio.js"]);
const ids=new Set([...managerPage.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
for(const m of managerJs.matchAll(/\$\("([^"]+)"\)/g))
 assert(ids.has(m[1]),"Manager JS references missing element #"+m[1]);
assert(managerPage.includes("STATION MANAGER")&&managerPage.includes('type="search"'));
assert(managerPage.includes('id="edit-dialog"'));
assert(managerPage.includes('id="edit-kind"'));
assert(managerPage.includes('id="show-days"'));
assert(managerPage.includes('id="slot-list"'));
assert(managerPage.includes("PREVIEW"));
assert(managerJs.includes("source:\"static\""),"Legacy tracks must be visible/editable");
assert(managerJs.includes("source:\"cloud\""),"Uploaded tracks must be visible/editable");
assert(managerJs.includes("storagePath"),"Permanent cloud deletion must target original path");
assert(managerJs.includes('db.storage.from(bucket).remove([t.storagePath])'),"Delete cloud bytes through Storage API, not direct SQL");
assert(managerJs.includes("prompt(\"Type DELETE"),"Require second deletion confirmation");
assert(managerJs.includes("onConflict:\"track_id\""),"Legacy edits must be durable metadata overrides");
assert(managerJs.includes("requireOwner()")&&managerJs.includes("OWNER"),"Owner session required");
assert(!/sb_secret_|service_role/.test(managerJs),"No service key in browser");
assert(playerPage.indexOf("scheduler.js")<playerPage.indexOf("radio.js"),"Scheduler must load first");
assert(playerPage.includes('href="./manage/"'),"Manager navigation missing from station");
assert(read("sw.js").includes('"./fm/scheduler.js"'),"Service worker should cache scheduler");
assert(playerJs.includes('getPublishedCrate')&&playerJs.includes("humkin_radio_static_overrides"));
assert(playerJs.includes("humkin_radio_programs")&&playerJs.includes("fetchExtras"));
assert(playerJs.includes('t.kind==="bumper"'),"Bumpers must stay out of default rotation");
assert(read("fm/load/index.html").includes('href="../manage/"'),"Loader should link manager");

const tracks=[
 {id:"a",duration:120,title:"A",kind:"song"},
 {id:"bumper",duration:15,title:"ID",kind:"bumper"},
 {id:"b",duration:160,title:"B",kind:"song"}
];
const t=Date.parse("2026-11-13T13:30:00Z");
assert.equal(S.ZONE,"America/Chicago");
assert.deepEqual(
 Object.fromEntries(Object.entries(S.localParts(t)).filter(([key])=>["day","hour","minute","minuteOfDay"].includes(key))),
 {day:5,hour:7,minute:30,minuteOfDay:450});
const morning={
 id:"p1",name:"Morning",days:[1,2,3,4,5],start_minute:420,end_minute:540,
 track_ids:["a","bumper","b","a"],is_active:true,priority:1
};
assert.equal(S.currentProgram([morning],t).id,"p1");
assert.equal(S.currentProgram([morning],Date.parse("2026-11-14T13:30:00Z")),null,"No Friday show on Saturday");
assert.equal(S.currentProgram([morning],Date.parse("2026-11-13T16:30:00Z")),null,"Outside show");
assert.equal(S.currentProgram([{...morning,is_active:false}],t),null,"Paused show must not air");
const emergency={...morning,id:"p2",name:"Special",priority:8};
assert.equal(S.currentProgram([morning,emergency],t).id,"p2","Higher-priority show must win overlap");
const inProgram=S.scheduledAt(morning,t,tracks);
assert(inProgram&&inProgram.program==="Morning");
assert([0,1,2].includes(inProgram.index));
assert(inProgram.position>=0&&inProgram.position<tracks[inProgram.index].duration);
const repeat=S.scheduledAt(morning,t,tracks);
assert.deepEqual(repeat,inProgram,"Same-time program must be deterministic");
assert.equal(S.scheduledAt({...morning,track_ids:["removed"]},t,tracks),null,"Missing/deleted track must not crash playback");
assert.equal(S.scheduledAt(morning,Date.parse("2026-11-14T13:30:00Z"),tracks),null);
assert.equal(S.localParts(Date.parse("2026-07-10T12:30:00Z")).hour,7,"Chicago DST must use daylight time in July");
const Auto=require("../fm/autodj.js");
assert.equal(Auto.cadenceValue(0),0);
assert.equal(Auto.cadenceValue(3),3);
assert.equal(Auto.cadenceValue("NaN"),0);
assert.deepEqual(Auto.insertBumpers([0,1,2,3,4,5,6],[7,8],0),[0,1,2,3,4,5,6]);
assert.deepEqual(Auto.insertBumpers([0,1,2,3,4,5,6],[7,8],3),[0,1,2,7,3,4,5,8,6]);
assert.deepEqual(Auto.insertBumpers([0,1,2,3],[],2),[0,1,2,3]);
assert.equal(Auto.lengthMs([0,1],[{duration:2},{duration:1.1}]),3100);
assert(managerPage.includes('id="bumper-frequency"'),"Missing station ID cadence control");
assert(managerPage.includes('id="station-label"'),"Missing station label input");
assert(managerJs.includes('db.from("humkin_radio_settings")'),"Station Manager must load and persist real settings");
assert(read("fm/index.html").indexOf('autodj.js')<read("fm/index.html").indexOf('radio.js'),
  "AutoDJ helper must load before player");
assert(read("fm/radio.js").includes("withStationIds("),"Shared clock must use ID automation");
assert(read("sw.js").includes('"./fm/autodj.js"'),"Offline shell must include AutoDJ helper");
console.log("HUMKIN station manager checks passed: page wiring, RLS-aware CRUD, safe delete, legacy edits, Chicago daypart DST, priority, timing and missing track fallback.");
