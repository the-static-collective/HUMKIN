const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const P=require("../fm/orchard/gambit-proposal.js");
const read=path=>fs.readFileSync(path,"utf8");
const fixture={
 schema:P.SCHEMA,title:"The Evening Experiment",station_id:"station-one",
 day:"2026-11-25",time:"20:00",minutes:60,
 rules:[{when:"unheard",action:"least-played",enabled:true},
  {when:"always",action:"surprise",enabled:true}],
 note:"New voices on the dial, from the approved station crate."
};
const now=Date.parse("2026-11-19T14:00:00Z");
test("Gambit proposal has bounded declarative rules and a future Central-time window",()=>{
 const result=P.validate(fixture,now);
 assert.equal(result.title,"The Evening Experiment");
 assert.equal(result.minutes,60);
 assert.deepEqual(result.rules,fixture.rules);
 for(const time of ["11:01","23:59","24:00","now"]){
   assert.throws(()=>P.validate({...fixture,time},now),/quarter-hour/);
 }
 assert.throws(()=>P.validate({...fixture,day:"2026-10-01"},now),/coming month/);
 assert.throws(()=>P.validate({...fixture,day:"2027-01-01"},now),/coming month/);
 assert.throws(()=>P.validate({...fixture,rules:[{when:"always",action:"eval",enabled:true}]},now),/Gambit/);
 assert.throws(()=>P.validate({...fixture,rules:[]},now),/Gambit/);
 assert.throws(()=>P.validate({...fixture,rules:[
   {when:"always",action:"surprise",enabled:false}]},now),/enabled/);
});
test("proposals are not station grants, reward receipts, or arbitrary scripts",()=>{
 const edge=read("supabase/functions/humkin-program-proposals/index.ts");
 const schema=read("supabase/migrations/20261119224500_humkin_program_proposals.sql");
 const ui=read("fm/orchard/gambit-proposal-ui.js");
 const review=read("fm/orchard/gambits-review.js");
 const html=read("fm/orchard/gambits.html");
 const guild=read("fm/participate/desk.js");
 assert.match(edge,/await owner\(req\)/);
 assert.match(edge,/\.eq\("state","pending_review"\)/);
 assert.match(edge,/humkin_program_proposals/);
 assert.match(edge,/catalog_checked/);
 assert.doesNotMatch(edge,/autopilot\/programs\//);
 assert.doesNotMatch(edge,/potential_hum|award_hum|humkin_contrib_review/);
 assert.match(schema,/enable row level security/);
 assert.match(schema,/revoke all on table .* from public, anon, authenticated/);
 assert.match(ui,/P\.proposed\(/);
 assert.match(ui,/action:"submit"/);
 assert.match(ui,/action:"withdraw"/);
 assert.match(review,/mode=approved/);
 assert.match(review,/action:"review"/);
 assert.match(guild,/humkin-participation-pass-v1/);
 assert.match(ui,/humkin-participation-pass-v1/);
 for(const id of ["program-title-input","program-day","program-time","program-length",
   "program-deck","program-send","program-receipts","program-confirm"]){
  assert.ok(html.includes('id="'+id+'"'),id);
 }
 assert.match(html,/gambit-proposal-ui\.js/);
 assert.doesNotThrow(()=>new Function(ui));
 assert.doesNotThrow(()=>new Function(read("fm/orchard/gambit-proposal.js")));
});
test("approved publisher has two-step intervention and automatic house return",()=>{
 const publisher=read("tools/radio-broadcast/autopilot_publisher.py");
 const compiler=read("tools/radio-broadcast/program_deck.py");
 const win=read("tools/radio-broadcast/windows/cloud-autopilot.ps1");
 assert.match(publisher,/--approved-packet/);
 assert.match(publisher,/new_revision_count=2/);
 assert.match(publisher,/schedule_guest/);
 assert.match(win,/\$ApprovedPacket/);
 assert.match(win,/PUBLISH AUTOPILOT/);
 assert.match(compiler,/return_revision/);
 assert.match(compiler,/previous\["tracks"\]/);
 assert.match(compiler,/validate_packet/);
 assert.doesNotMatch(compiler,/exec\(|eval\(|subprocess\./);
});
