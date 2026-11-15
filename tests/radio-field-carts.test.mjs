import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync,statSync} from "node:fs";
import {execFileSync} from "node:child_process";

const read=path=>readFileSync(path,"utf8");
const manifest=JSON.parse(read("fm/studio/recordings/field-carts.json"));
assert.equal(manifest.schema_version,"humkin.radio.field-carts/v1");
assert.equal(manifest.assets.length,27,"Preserve thirteen original microphone takes and fourteen radio edits");
const ids=new Set(),names=new Set();
for(const a of manifest.assets){
 assert(!ids.has(a.id)&&!names.has(a.file),"Every source recording must be unique");
 ids.add(a.id);names.add(a.file);
 assert(/^[a-z0-9-]+\.(mp3|m4a)$/.test(a.file),"Safe local source path");
 const path="fm/studio/recordings/"+a.file,bytes=readFileSync(path);
 assert.equal(bytes.length,a.bytes,"Exact source size: "+a.id);
 assert.equal(statSync(path).size,a.bytes);
 assert.equal(createHash("sha256").update(bytes).digest("hex"),a.sha256,
   "Exact recorded original bytes in repository: "+a.id);
 assert(a.duration_seconds>1&&a.duration_seconds<120,"Radio liners and short hosted monologues can run up to two minutes");
 assert(a.kind==="reference"||a.kind==="bumper");
 assert(a.can_stage===true?a.file.endsWith(".mp3"):true);
}
assert.equal(manifest.assets.filter(a=>a.can_stage).length,14);
// A separate, narrowly reviewed source-owned pack is allowed to be on air.
// All other auditions remain private-stage-only. This never invents audio.
const airPack=JSON.parse(read("fm/air-carts.json"));
assert.equal(airPack.schema_version,"humkin.radio.air-carts/v1");
assert.equal(airPack.carts.length,9,"Nine distinct site-hosted edits; five cloud-hosted edits already on air");
assert(airPack.owner_approval.includes("just make em all live"),
 "All radio edits were explicitly cleared for rotation by the owner");
const alreadyInCloud=new Set([
 "c551b49c56f29fd5a7fbb9d54d09cae7d44e68e851c60d3a443072074ce17f2f",
 "1bb0ba374f97aa314a10ba8e4994a27d40846c7c94ad86f12f907fc9fb31a24b",
 "a0e6421b1d9a96b3cadbe6d52f20507624fb358639bd4e1d67cfc54c9543d3da",
 "150edab64f854f246d12dd3608f69444ddd49d0d3d6ed1b5c683b5d2c191b05f",
 "21cd59043e0c0689be0bc8dba297a7f8bc93de4fb539c1150490ea923d76017e"
]);
const allEdited=manifest.assets.filter(a=>a.kind==="bumper"&&a.can_stage);
assert.equal(allEdited.length,14,"All fourteen edits retained in the studio");
assert.equal(alreadyInCloud.size+airPack.carts.length,allEdited.length,
 "Each finished edit must be on air from exactly one catalog source");
const onAirIds=new Set();
const onAirShas=new Set();
for(const cart of airPack.carts){
 assert(!onAirIds.has(cart.id),"Air carts may not appear twice");
 onAirIds.add(cart.id);
 const candidate=allEdited.find(a=>a.id===cart.id);
 assert(candidate,"Only recorded source-proven edited station carts may air");
 assert(!alreadyInCloud.has(candidate.sha256),"Do not double-air an identical cloud bumper");
 assert(!onAirShas.has(cart.sha256),"No duplicate audio in the on-air pack");
 onAirShas.add(cart.sha256);
 assert(cart.sha256===candidate.sha256&&cart.duration_seconds===candidate.duration_seconds,
  "Air pack must preserve recorded source integrity");
 assert(cart.src==="./studio/recordings/"+candidate.file,
  "Only existing original edited MP3s can enter the radio");
}
for(const item of allEdited)
 assert(alreadyInCloud.has(item.sha256)||onAirShas.has(item.sha256),
  "Every completed original HUMKIN edited bumper must now be on air: "+item.id);
for(const code of ["field-fm-009","field-fm-010","field-fm-011","field-fm-012","field-fm-013"])
 assert(airPack.carts.some(c=>c.id===code&&c.editorial_context),
  "Formerly held or situational recordings must keep their audible-context caveats");
for(let i=8;i<=13;i++){
 const code=String(i).padStart(3,"0");
 assert(manifest.assets.some(a=>a.id==="field-raw-"+code&&a.file.endsWith(".m4a")),"Preserve field recording "+code);
 assert(manifest.assets.some(a=>a.id==="field-fm-"+code&&a.file.endsWith(".mp3")),"Prepare radio mix "+code);
}
assert(manifest.assets.find(a=>a.id==="field-fm-013").note.includes("HOLD FOR EDITORIAL REVIEW"),"Truncated greeting must be held for owner review");
assert(manifest.assets.find(a=>a.id==="field-fm-012").note.includes("character farewell/endcap"),"Sign-off must not imply that the real station has closed");
assert(manifest.assets.find(a=>a.id==="field-fm-011").note.includes("HOLD FOR REQUEST-CONTACT REVIEW"),"Do not broadcast unverified request routing");
assert(manifest.assets.some(a=>a.id==="field-raw-007"&&a.file.endsWith(".m4a")),"Original HUMKIN Time recording retained");
assert(manifest.assets.some(a=>a.id==="field-fm-007"&&a.file.endsWith(".mp3")&&a.note.includes("not the actual time")),"Clock bumper is an artistic ID, not a factual time announcement");
assert(manifest.assets.some(a=>a.id==="field-raw-006"&&a.file.endsWith(".m4a")),"Direct-address original take retained");
assert(manifest.assets.some(a=>a.id==="field-fm-006"&&a.file.endsWith(".mp3")),"Lantern-bell More Music Warning cart staged for audition");
assert(manifest.assets.some(a=>a.id==="field-raw-004"&&a.file.endsWith(".m4a")),"Cold-weather original retained");
assert(manifest.assets.some(a=>a.id==="field-fm-004"&&a.file.endsWith(".mp3")&&a.note.includes("CONTENT FLAG")),"Winter bumper retains family-listening advisory");
assert(manifest.assets.some(a=>a.id==="field-raw-005"&&a.file.endsWith(".m4a")),"Sunday church-drive original retained");
assert(manifest.assets.some(a=>a.id==="field-fm-005"&&a.file.endsWith(".mp3")),"Sunday church-style bell mix added");
assert(manifest.assets.some(a=>a.id==="field-raw-003"&&a.file.endsWith(".m4a")),"Unedited original bumper monologue retained");
assert(manifest.assets.some(a=>a.id==="field-fm-003"&&a.file.endsWith(".mp3")),"Edited Bump It radio cart available for private staging");
assert(manifest.assets.some(a=>a.id==="field-raw-002"&&a.file.endsWith(".m4a")),"Original music-found take retained");
assert(manifest.assets.some(a=>a.id==="field-fm-002"&&a.file.endsWith(".mp3")),"Music-found bell bumper available for private staging");
const html=read("fm/studio/index.html"),js=read("fm/studio/studio.js");
assert(html.includes('id="field-carts-list"')&&html.includes('id="field-carts-status"'));
assert(html.indexOf('id="field-carts-list"')>html.indexOf('id="workbench"'),
 "Field auditions must be inside authenticated producer workbench");
assert(js.includes('loadFieldCarts();')&&js.includes('stageFieldCart('),
 "Private station owner must be able to stage a recording from the studio");
assert(js.includes('await requireOwner()')&&js.includes('crypto.subtle.digest("SHA-256",bytes)'),
 "No upload without owner session and recording hash integrity");
assert(js.includes('.upload(path,file,{upsert:false,contentType:"audio/mpeg"'),
 "Send MP3 only to authenticated private storage");
assert(js.includes('kind:"bumper",enabled:false'),
 "Preview import must never add enabled/on-air music");
const rotation=JSON.parse(read("fm/rotation.json"));
assert.equal(rotation.live_stream_url,null,"No real transmitter connected");
for(const a of manifest.assets)
 assert(!rotation.tracks.some(t=>String(t.src||"").includes(a.file)),
 "Audition clips must not be inserted into on-air static song rotation");
execFileSync(process.execPath,["--input-type=module","--check"],{input:js});
console.log("Twenty-seven source/edited recordings SHA-256 verified; fourteen owner-only disabled bumper staging candidates, no accidental airplay.");
