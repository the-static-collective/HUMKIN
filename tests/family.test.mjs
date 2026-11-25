import test from "node:test";import assert from "node:assert/strict";
import {rootNode,eligible,familyPairs,makeChild,admitChild,familyBundle,verifyFamily,germlinePerformance,signature} from "../robots/echo/family.mjs";
import {crossMidi} from "../robots/echo/pollinator.mjs";
const root=(id,pitches,durations=[.5,.75,1,.5])=>rootNode({id:id.repeat(64),track_title:id,proposal:{pitches,durations_quarter:durations,tempo_bpm:90}});
const a=root("a",[60,62,64,65]),b=root("b",[67,69,71,74]),c=root("c",[55,60,62,67]),d=root("d",[72,69,65,64]);
const pair=(a,b)=>({a:a.id,b:b.id,shift:0});
test("two generations preserve roots and original receipts",async()=>{
 const x=await makeChild(a,b,pair(a,b),"duet"),y=await makeChild(c,d,pair(c,d),"call-response");
 const z=await makeChild(x,y,pair(x,y),"graft","rotate-rhythm");
 assert.equal(z.generation,2);assert.equal(z.roots.length,4);assert.equal(z.ancestors.length,6);assert.equal(z.broadcast_authority,false);
 const bundle=familyBundle([a,b,c,d,x,y,z]);const nodes=await verifyFamily(bundle,async()=>{});assert.deepEqual(nodes.at(-1),z);
 assert.equal(Buffer.from(crossMidi(germlinePerformance(z))).toString("ascii",0,4),"MThd");
 assert.equal(eligible(x,a,true),false);assert.equal(eligible(x,y),true);
 const tampered=structuredClone(bundle);tampered.nodes.at(-1).proposal.pitches[0]++;await assert.rejects(()=>verifyFamily(tampered,async()=>{}));
 const missing=structuredClone(bundle);missing.nodes.splice(0,1);await assert.rejects(()=>verifyFamily(missing,async()=>{}));
});
test("diversity guard, deterministic replay and explicit related policy",async()=>{
 const x=await makeChild(a,b,pair(a,b),"graft"),y=await makeChild(a,c,pair(a,c),"graft");
 assert.equal(eligible(x,y),false);assert.equal(eligible(x,y,true),true);
 assert.throws(()=>admitChild([a,b,x],x));const clone={...x,id:"e".repeat(64),proposal:{...x.proposal,pitches:x.proposal.pitches.map(n=>n+2)}};assert.equal(signature(clone.proposal),signature(x.proposal));assert.throws(()=>admitChild([x],clone));
 assert.deepEqual(familyPairs([a,b,c,d]),familyPairs([d,c,b,a]));
 const f=await makeChild(a,b,pair(a,b),"duet","rotate-rhythm");assert.deepEqual(f,await makeChild(a,b,pair(a,b),"duet","rotate-rhythm"));assert.notDeepEqual(f.proposal.durations_quarter,x.proposal.durations_quarter);
});
