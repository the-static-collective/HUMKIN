import assert from "node:assert/strict";
import test from "node:test";
import {monthlyCouncil,vinylNominationPacket,chicagoMonth,
  SNAPSHOT_SCHEMA,VINYL_SCHEMA} from "./vinyl-council.mjs";

const u=n=>n.toString(16).padStart(8,"0")+"-a1b2-4def-8000-1234567890ab";
function fixture(){
 const catalog=Array.from({length:18},(_,i)=>({
  id:"crate-"+(i+1),title:"Track "+(i+1),artist:"Artist "+(i+1),
  duration_seconds:170+i,featured:([4,5,8,9,10,11].includes(i+1)),
  enabled:true,kind:"song"
 }));
 // EP: 1/2/3/4 are radio-only, 5/6 are released. Album uses
 // 1/2/3/6/7/12/13/14 radio-only, 4/5/8/9 released? correct below.
 const ep=["crate-1","crate-2","crate-3","crate-6","crate-4","crate-5"];
 const album=["crate-1","crate-2","crate-3","crate-6","crate-7","crate-12",
  "crate-13","crate-14","crate-4","crate-5","crate-8","crate-9"];
 return {schema:SNAPSHOT_SCHEMA,month:"2026-10",closed:true,complete:true,
  truncated:false,event_feed_status:"not_connected",catalog,
  plays:catalog.map((t,i)=>({id:t.id,radio:i<6?12:2,playlist:i<6?4:1})),
  weather:catalog.map((t,i)=>({id:t.id,feelings:{move:i<6?4:0,hope:2}})),
  records:[
   {id:u(1),kind:"ep",issue_key:"2026-10-12",title:"EP Made By People",curator:"DIAL 001",tracks:ep},
   {id:u(2),kind:"album",issue_key:"2026-10-19",title:"LP Made By People",curator:"DIAL 002",tracks:album}
  ],events:[]};
}
test("monthly league proposes one LP and EP while preserving separate evidence lanes",()=>{
 const data=fixture(),result=monthlyCouncil(data);
 assert.equal(result.state,"NOMINATION_SLATE_REVIEW_REQUIRED");
 assert.equal(result.ep.leader.title,"EP Made By People");
 assert.equal(result.lp.leader.title,"LP Made By People");
 assert(result.ep.leader.evidence.chart>0);
 assert.equal(result.ep.leader.evidence.verified_events,0);
 assert.equal(result.ep.leader.evidence.move,24);
 assert.equal(result.rules.weights.chart,70);
 assert.equal(result.ep.leader.evidence.chart,
   result.ep.leader.evidence.radio+result.ep.leader.evidence.playlist);
});
test("LP and EP nominations carry rights, masters, side and manufacture holds",()=>{
 const data=fixture(),council=monthlyCouncil(data);
 const ep=vinylNominationPacket(council,"ep",data.catalog);
 assert.equal(ep.schema,VINYL_SCHEMA);
 assert.equal(ep.state,"HOLD_NOT_MANUFACTURABLE");
 assert.equal(ep.sides.A.length,3);
 assert.equal(ep.sides.B.length,3);
 assert(ep.sides.A.every(x=>x.master_sha256===null&&
  x.rights_for_physical==="NOT_VERIFIED"));
 assert.equal(ep.gating.pressing_ordered,false);
 assert.equal(ep.gating.artist_copies_and_fulfillment,false);
 const lp=vinylNominationPacket(council,"lp",data.catalog);
 assert.equal(lp.sides.A.length,6);
 assert.equal(lp.sides.B.length,6);
 assert.equal(lp.gating.owner_physical_approval,false);
});
test("unverified activities never add chart points or monthly event score",()=>{
 const data=fixture();
 data.events=[{record_id:u(1),event_id:"volunteer-123",
  proof_ref:"proposal",reviewed:true}];
 data.event_feed_status="not_connected";
 let result=monthlyCouncil(data);
 assert.equal(result.ep.leader.evidence.verified_events,0);
 const old=result.ep.leader.evidence.chart;
 data.event_feed_status="owner_verified";
 result=monthlyCouncil(data);
 assert.equal(result.ep.leader.evidence.verified_events,1);
 assert.equal(result.ep.leader.evidence.chart,old);
});
test("bad or unpublished track groups cannot reach the vinyl nomination slate",()=>{
 const data=fixture();
 data.catalog.find(t=>t.id==="crate-5").enabled=false;
 const result=monthlyCouncil(data);
 assert.equal(result.ep.nominees.length,0);
 assert.equal(result.lp.nominees.length,0);
 assert.equal(vinylNominationPacket(result,"ep",data.catalog),null);
});
test("incomplete or current-month inputs must remain provisional",()=>{
 const data=fixture();data.complete=false;
 assert.equal(monthlyCouncil(data).state,"PROVISIONAL_INCOMPLETE");
 data.complete=true;data.month=chicagoMonth();
 assert.equal(monthlyCouncil(data).state,"PROVISIONAL_INCOMPLETE");
});
test("malformed counter or duplicate play summary is rejected",()=>{
 const data=fixture();
 data.plays.push({...data.plays[0]});
 assert.throws(()=>monthlyCouncil(data),/DUPLICATE_PLAYS_SUMMARY/);
 data.plays.pop();
 data.plays[0].radio=-1;
 assert.throws(()=>monthlyCouncil(data),/BAD_PLAY_COUNTER/);
});
