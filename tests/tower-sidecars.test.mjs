import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {towerAudioDigest,parseTowerSidecar,inspectTowerFolder}
  from "../fm/load/tower-sidecars.mjs";
const A="a".repeat(64),B="b".repeat(64);
const record={
  id:"upload-"+A, source:"upload",
  local_audio:"C:\\Users\\Owner\\AppData\\Local\\HUMKIN\\Tower\\media\\"+A+".mp3",
  title:"What the Quiet Costs",artist:"HUMKIN",album:"Night Shift Proof",
  duration:174.45,kind:"song"
};
function file(name,body="",size=body.length) {
  return {name,size,text:async()=>body};
}
test("finds Tower's content-addressed audio files and verifies matching sidecar metadata",async()=>{
  assert.equal(towerAudioDigest(A+".mp3"),A);
  assert.equal(towerAudioDigest(A+".wav"),A);
  assert.equal(towerAudioDigest("Other Song.mp3"),null);
  const parsed=parseTowerSidecar(JSON.stringify(record),A+".json");
  assert.deepEqual(parsed,{sha:A,title:"What the Quiet Costs",artist:"HUMKIN",
    album:"Night Shift Proof",duration:174.45,kind:"song"});
  const result=await inspectTowerFolder([
    file(A+".mp3"),file(A+".json",JSON.stringify(record)),file("cover.jpg"),
    file("other.json",'{"ignored":true}')
  ]);
  assert.equal(result.towerAudioCount,1);
  assert.equal(result.paired,1);
  assert.equal(result.metadata.get(A).title,"What the Quiet Costs");
  assert.equal(result.rejected,0);
  assert.equal(result.unpaired,0);
});
test("refuses sidecars with mismatched hashes or file identities, without reading local file paths",async()=>{
  const wrong={...record,id:"upload-"+B};
  assert.equal(parseTowerSidecar(JSON.stringify(wrong),A+".json"),null);
  assert.equal(parseTowerSidecar(JSON.stringify({...record,local_audio:"C:\\private\\secrets.txt"}),A+".json"),null);
  assert.equal(parseTowerSidecar(JSON.stringify({...record,source:"remote"}),A+".json"),null);
  assert.equal(parseTowerSidecar(JSON.stringify({...record,duration:-1}),A+".json"),null);
  const missing=await inspectTowerFolder([file(A+".mp3"),file(A+".json",JSON.stringify(wrong))]);
  assert.equal(missing.paired,0);
  assert.equal(missing.rejected,1);
  assert.equal(missing.towerAudioCount,1);
});
test("unmatched and oversized JSON never becomes a publishable source",async()=>{
  const unpaired=await inspectTowerFolder([file(A+".json",JSON.stringify(record))]);
  assert.equal(unpaired.unpaired,1);assert.equal(unpaired.paired,0);
  const huge=await inspectTowerFolder([file(A+".mp3"),file(A+".json",JSON.stringify(record),40000)]);
  assert.equal(huge.rejected,1);assert.equal(huge.paired,0);
});
test("conflicting metadata cannot silently select a random sidecar",async()=>{
  const variants=await inspectTowerFolder([
    file(A+".mp3"),file(A+".json",JSON.stringify(record)),
    file(A+".json",JSON.stringify({...record,title:"Different title"}))
  ]);
  assert.equal(variants.paired,0);assert.equal(variants.rejected,1);
});
test("ordinary music folders remain unaffected and unsupported Tower encodes are counted",async()=>{
  const report=await inspectTowerFolder([file("01 - Great Song.mp3"),file("notes.json"),
    file(B+".flac"),file(B+".json",'{}')]);
  assert.equal(report.paired,0);
  assert.equal(report.unsupported,1);
  assert.equal(report.rejected,1);
  assert.equal(report.towerAudioCount,1);
});
test("browser still stages through authenticated private R2, not direct public recording writes",()=>{
  const loader=readFileSync(new URL("../fm/load/loader.js",import.meta.url),"utf8");
  const html=readFileSync(new URL("../fm/load/index.html",import.meta.url),"utf8");
  assert.match(loader,/import \{inspectTowerFolder,towerAudioDigest\} from "\.\/tower-sidecars\.mjs"/);
  assert.match(loader,/await assertTowerSource\(item,mp3===item\.file\?hash:await digest\(item\.file\)\)/);
  assert.match(loader,/await assertTowerSource\(item,mp3===item\.file\?sha:await digest\(item\.file\)\)/);
  assert.match(loader,/r2Direct\(db,"prepare"/);
  assert.match(loader,/r2Direct\(db,"finalize"/);
  assert.match(loader,/r2Direct\(db,"publish"/);
  assert.match(html,/id="tower-note"/);
  assert.match(html,/id="pick-folder"[^>]*accept="[^"]*\.json/);
  assert.doesNotMatch(loader,/localStorage.*(aws|secret|R2_KEY)/i);
});
