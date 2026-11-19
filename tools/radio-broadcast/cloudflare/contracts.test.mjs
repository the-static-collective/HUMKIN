import assert from "node:assert/strict";
import test from "node:test";
import {program} from "./worker.mjs";
import {STATIONS} from "./stations.mjs";
import {CONTRACT_SCHEMA,validateContractGraph,resolveContract,
  projectMainline,contractReceipt,describeContractStations,fingerprint} from "./contracts.mjs";

const AT=new Date("2026-11-18T23:30:00Z"); // Wed 17:30 Central
function song(id,featured=false){
 return {id,key:"tracks/"+id+".mp3",kind:"song",title:id,artist:"Original",
  album:"Field Notes",duration:140,featured,seasonal:false,tags:[]};
}
function library(){
 const tracks=[song("crate-a"),song("crate-b"),song("crate-c",true)];
 tracks.bumper_rules=[];tracks.bumper_groups=[];
 tracks.mainline_programs=[{id:"show-1",name:"Mainline Show",enabled:true,
   days:[3],start_minute:1020,end_minute:1140,priority:1,
   track_ids:["crate-a"],filter:{track_ids:["crate-a"]}}];
 return tracks;
}
function make(id,parent_id="mainline",kind="echo",influence=100){
 return {id,enabled:true,mode:"personal",filter:{kinds:["song"]},
  include_bumpers:false,programs:[],contract_version:1,revision:1,
  parent_id,relationship:{kind,influence}};
}
function weights(resolved){
 return Object.fromEntries(resolved.tracks.filter(t=>t.kind==="song")
  .map(t=>[t.id,t.rotation_weight||1]));
}
test("Mainline projection selects published *planned* show IDs rather than inventing plays",()=>{
 const root=projectMainline(library(),AT);
 assert.equal(root.program_source,"published_mainline_schedule");
 assert.deepEqual(root.tracks.map(t=>t.id),["crate-a"]);
});
test("echo and counterpoint draw different preferences from the same approved R2 library",()=>{
 const tracks=library(),echo=make("echo"),counter=make("counter","mainline","counterpoint",100);
 const e=resolveContract(echo,tracks,AT,[echo]);
 const c=resolveContract(counter,tracks,AT,[counter]);
 assert(weights(e)["crate-a"]>weights(e)["crate-b"]);
 assert(weights(c)["crate-b"]>weights(c)["crate-a"]);
 assert.equal(e.tracks.length,c.tracks.length);
 assert(e.tracks.every(t=>tracks.some(s=>s.key===t.key)));
});
test("a dependent station responds to the parent, including its program edits",()=>{
 const e=make("echo"),child=make("child","echo","inverse",100);
 const before=resolveContract(child,library(),AT,[e,child]);
 assert.deepEqual(before.lineage,["mainline","echo","child"]);
 assert(weights(before)["crate-b"]>weights(before)["crate-a"]);
 const changed=library();
 changed.mainline_programs[0].filter={track_ids:["crate-b"]};
 const after=resolveContract(child,changed,AT,[e,child]);
 assert(weights(after)["crate-a"]>weights(after)["crate-b"]);
 assert.notEqual(before.key,after.key);
 assert.notEqual(before.fingerprint,after.fingerprint);
});
test("content eligibility is local and no parent can approve a withdrawn recording",()=>{
 const child=make("child","mainline","inverse",100);
 const approved=library().filter(t=>t.id!=="crate-c");
 approved.bumper_groups=[];approved.bumper_rules=[];approved.mainline_programs=[];
 const selected=resolveContract(child,approved,AT,[child]);
 assert.equal(selected.tracks.length,2);
 assert(!selected.tracks.some(x=>x.id==="crate-c"));
});
test("invalid cycles, missing parents, unsupported revisions and disabled ancestors fail closed",()=>{
 const a=make("a","b"),b=make("b","a");
 assert.throws(()=>validateContractGraph([a,b]),/CONTRACT_CYCLE/);
 assert.throws(()=>validateContractGraph([make("missing","nope")]),/CONTRACT_PARENT_MISSING/);
 assert.throws(()=>validateContractGraph([make("root","mainline","echo",101)]),/RELATIONSHIP_INVALID/);
 assert.throws(()=>validateContractGraph([{...make("root"),contract_version:2}]),/VERSION_UNSUPPORTED/);
 const parent={...make("parent"),enabled:false},child=make("child","parent");
 assert.throws(()=>resolveContract(child,library(),AT,[parent,child]),/PARENT_DISABLED/);
});
test("influence zero and independent stations leave the ordinary rotation metadata unchanged",()=>{
 const plain=make("plain","mainline","independent",100);
 const zero=make("zero","mainline","echo",0);
 assert(resolveContract(plain,library(),AT,[plain]).tracks.every(x=>!Object.hasOwn(x,"rotation_weight")));
 assert(resolveContract(zero,library(),AT,[zero]).tracks.every(x=>!Object.hasOwn(x,"rotation_weight")));
});
test("weights control rotations without changing the existing unweighted Long Wave behavior",()=>{
 const old=library();
 const legacy=program(old,44);
 assert.equal(legacy.filter(t=>t.id==="crate-c").length,2); // featured double spin
 const weighted=old.map(t=>({...t,rotation_weight:t.id==="crate-a"?5:1}));
 const built=program(weighted,44);
 assert.equal(built.filter(t=>t.id==="crate-a").length,5);
 assert.equal(built.filter(t=>t.id==="crate-c").length,1);
});
test("receipt is stable, inspectable and expressly not proof of actual airplay",()=>{
 const station=make("daydream");
 const a=resolveContract(station,library(),AT,[station]),b=resolveContract(station,library(),AT,[station]);
 const receipt=contractReceipt(a);
 assert.deepEqual(contractReceipt(a),contractReceipt(b));
 assert.equal(receipt.schema,CONTRACT_SCHEMA);
 assert.equal(receipt.claim,"deterministic_selection_not_proof_of_actual_airplay");
 assert.equal(fingerprint({a:1,b:2}),fingerprint({b:2,a:1}));
 assert.equal(describeContractStations(library(),AT,STATIONS).find(s=>s.id==="deep-wave").parent_id,"spotlight");
});
