const test=require("node:test");
const assert=require("node:assert/strict");
const policy=require("../fm/r2-catalog.js");
const hashes=["ffc6cc64c5233b4d3ec35cdb2c935c65e3bf37d8e60767bf455b63809820c2b5",
"a9223523d009c520a7add920b954258c73017198eb0411bfa6a54e795f1136a4",
"e9b16482a25cce61b9bc6a68aa5589cb9a36ef28007b5c3436b73d8458b8a964"];
test("exact hashes add two seasonal slots per regular song",()=>{
 const tracks=hashes.map((sha256,i)=>({id:"crate-"+i,sha256,kind:"song"}));
 tracks.push({id:"other",sha256:"0".repeat(64),kind:"song"});
 const extras=policy.additionalPositions([0,1,2,3],tracks,[],{multiplier:3,sha256s:hashes});
 assert.deepEqual(extras,[0,0,1,1,2,2]);
});
test("featured and seasonal total only three slots",()=>{
 const tracks=[{id:"crate-a",sha256:hashes[0],kind:"song",is_single:true}];
 assert.deepEqual(policy.additionalPositions([0],tracks,[0],{multiplier:3,sha256s:hashes}),[0]);
});
test("bumper with same fingerprint never becomes seasonal",()=>{
 const tracks=[{id:"bumper",sha256:hashes[0],kind:"bumper"}];
 assert.deepEqual(policy.additionalPositions([0],tracks,[],{multiplier:3,sha256s:hashes}),[]);
});
