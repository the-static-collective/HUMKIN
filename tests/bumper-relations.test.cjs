// HUMKIN Bumper Workbench: no automatic artistic categories or hidden rules.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const rel=require("../fm/bumper-relations.js");
const mock=(id,lane,seconds)=>({id,title:id,index:id,seconds,role:"character",
 family:id,lane,rare:lane==="long"});
function checkSame(before,after){
 assert.deepEqual(after.map(x=>x.lane),before.map(x=>x.lane),
  "Group changes must never move a bumper into the wrong timing lane");
 assert.deepEqual(new Set(after.map(x=>x.id)),new Set(before.map(x=>x.id)),
  "Every eligible recording remains in the station plan");
 assert.equal(after.reduce((sum,x)=>sum+x.seconds,0),before.reduce((sum,x)=>sum+x.seconds,0),
  "Same-Time cycle duration must stay identical");
}
const source=[mock("A","short",7),mock("X","medium",35),
 mock("Y","medium",29),mock("C","short",9),
 mock("B","medium",42),mock("Z","medium",38)];
const alone=source.map(x=>({...x}));
rel.arrange(alone,[],{short:2,medium:4},3);
assert.deepEqual(alone,source,"No user-saved groups = no imposed relationships");
const related=source.map(x=>({...x}));
rel.arrange(related,[{id:"1",name:"shared subject",kind:"attract",enabled:true,
 track_ids:["A","B"]}],{short:2,medium:4},3);
assert.equal(related[1].id,"B",
 "Attract moves a later matching work into an eligible near-term break");
checkSame(source,related);
const disabled=source.map(x=>({...x}));
rel.arrange(disabled,[{id:"1",kind:"attract",enabled:false,
 track_ids:["A","B"]}],{short:2,medium:4},3);
assert.deepEqual(disabled,source,"Paused groups must have no effect");
const edits=[mock("cut-21","medium",21),mock("unrelated","short",8),
 mock("cut-42","medium",42),mock("another","medium",34)];
const separated=edits.map(x=>({...x}));
rel.arrange(separated,[{kind:"repel",enabled:true,track_ids:["cut-21","cut-42"]}],
 {short:1,medium:3},3);
assert.equal(separated[2].id,"another",
 "Repel defers an alternate cut when a fair same-lane substitute exists");
assert.equal(separated[3].id,"cut-42");
checkSame(edits,separated);
assert.equal(rel.validGroups([{kind:"attract",enabled:true,track_ids:["only"]}]).length,0,
 "A group needs at least two distinct recordings");
// Inactive rules are powerless, and time-varying restrictions are isolated
// from the fixed Same-Time epoch. Uses America/Chicago, not UTC device time.
const noon=new Date("2026-11-18T18:00:00Z"); // Wednesday 12:00 Central
assert(rel.permitted("A",[{kind:"hold",enabled:false,track_ids:["A"]}],noon),
 "OFF means OFF");
assert(!rel.permitted("A",[{kind:"hold",enabled:true,track_ids:["A"]}],noon,"clock"),
 "An explicit owner hold works in Same-Time");
const daytime=[{kind:"daypart",enabled:true,track_ids:["A"],
 days:[3],start_minute:540,end_minute:1020}];
assert(rel.permitted("A",daytime,noon,"stream"));
assert(!rel.permitted("A",daytime,new Date("2026-11-18T05:00:00Z"),"stream"));
assert(rel.permitted("A",daytime,new Date("2026-11-18T05:00:00Z"),"clock"),
 "Same-Time ignores only variable restrictions");
const calendar=[{kind:"date",enabled:true,track_ids:["A"],
 start_date:"2026-11-19",end_date:"2026-12-04"}];
assert(!rel.permitted("A",calendar,noon,"stream"));
assert(rel.permitted("A",calendar,new Date("2026-12-04T18:00:00Z"),"stream"));
const html=fs.readFileSync("fm/manage/index.html","utf8");
const manager=fs.readFileSync("fm/manage/manager.js","utf8");
const workbench=fs.readFileSync("fm/manage/bumper-workbench.js","utf8");
assert(html.includes('id="group-editor-root"')&&html.includes('id="rule-editor-root"'));
assert(manager.includes("mountBumperControls")&&manager.includes("bumper_rules"));
assert(workbench.includes("GROUP CHECKED LIBRARY BUMPERS"));
const radio=fs.readFileSync("fm/radio.js","utf8");
const shell=fs.readFileSync("sw.js","utf8");
assert(radio.includes("bumper_groups")&&radio.includes("bumper_rules"));
assert(shell.includes('"./fm/bumper-relations.js"'));
console.log("Manual ATTRACT/REPEL, OFF-by-default rules, shared-clock checksum and owner control wiring pass.");
