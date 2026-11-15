import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync,statSync} from "node:fs";
import {execFileSync} from "node:child_process";

const read=path=>readFileSync(path,"utf8");
const manifest=JSON.parse(read("fm/studio/recordings/field-carts.json"));
assert.equal(manifest.schema_version,"humkin.radio.field-carts/v1");
assert.equal(manifest.assets.length,15,"Preserve seven microphone takes and eight radio-bumper edits");
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
 assert(a.duration_seconds>1&&a.duration_seconds<40,"Radio liners may include longer comedic pauses");
 assert(a.kind==="reference"||a.kind==="bumper");
 assert(a.can_stage===true?a.file.endsWith(".mp3"):true);
}
assert.equal(manifest.assets.filter(a=>a.can_stage).length,8);
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
console.log("Fifteen source/edited recordings SHA-256 verified; eight owner-only disabled bumper staging candidates, no accidental airplay.");
