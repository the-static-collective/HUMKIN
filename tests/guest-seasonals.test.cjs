const test=require("node:test");
const assert=require("node:assert/strict");
const policy=require("../fm/r2-catalog.js");
const feature=require("../fm/guest-features.json").features.find(x=>x.id==="eno-efia-unshackled-dreams");
const rotation=require("../fm/rotation.json").seasonal_rotation;
const songs=feature.tracks.filter(t=>t.kind==="song");
const interview=feature.tracks.find(t=>t.kind==="interview");

test("guest feature keeps interview immediately before My Best Friend",()=>{
 assert.equal(feature.tracks.length,3);
 assert.equal(interview.title,"Interview — Introduction to My Best Friend");
 assert.equal(interview.catalog_kind,"bumper");
 assert.equal(interview.feature_only,true);
 assert.equal(interview.seasonal,false);
 assert.equal(feature.tracks.indexOf(interview)+1,feature.tracks.findIndex(t=>t.title==="My Best Friend"));
});
test("seasonal policy lists the two songs, not the interview",()=>{
 assert.equal(songs.length,2);
 assert.equal(rotation.multiplier,3);
 assert.deepEqual(new Set(rotation.sha256s),new Set(songs.map(t=>t.sha256)));
 assert.equal(rotation.sha256s.includes(interview.sha256),false);
 const config=require("../fm/rotation.json");
 assert.deepEqual(config.feature_only_spoken_sha256s,[interview.sha256]);
 assert.equal(songs.some(t=>config.feature_only_spoken_sha256s.includes(t.sha256)),false);
});
test("two songs each receive three total positions",()=>{
 const tracks=feature.tracks.map((t,i)=>({id:"crate-"+i,sha256:t.sha256,kind:t.catalog_kind}));
 const extra=policy.additionalPositions([0,2],tracks,[],rotation);
 assert.deepEqual(extra,[0,0,1,1]);
});
test("featured seasonal song still receives three total, not five",()=>{
 const tracks=[{id:"crate-song",sha256:songs[0].sha256,kind:"song"}];
 assert.deepEqual(policy.additionalPositions([0],tracks,[0],rotation),[0]);
});
test("misclassified interview cannot gain seasonal slots",()=>{
 const tracks=[{id:"interview",sha256:interview.sha256,kind:"song"}];
 assert.deepEqual(policy.additionalPositions([0],tracks,[],rotation),[]);
});
test("bumpers do not enter seasonal music under any matching fingerprint",()=>{
 const tracks=[{id:"bumper",sha256:songs[0].sha256,kind:"bumper"}];
 assert.deepEqual(policy.additionalPositions([0],tracks,[],rotation),[]);
});
