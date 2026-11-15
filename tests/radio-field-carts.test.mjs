import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync,statSync} from "node:fs";
import {execFileSync} from "node:child_process";

const read=path=>readFileSync(path,"utf8");
const manifest=JSON.parse(read("fm/studio/recordings/field-carts.json"));
assert.equal(manifest.schema_version,"humkin.radio.field-carts/v1");
assert.equal(manifest.assets.length,3,"Preserve original take and both bumper edits");
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
 assert(a.duration_seconds>1&&a.duration_seconds<20);
 assert(a.kind==="reference"||a.kind==="bumper");
 assert(a.can_stage===true?a.file.endsWith(".mp3"):true);
}
assert.equal(manifest.assets.filter(a=>a.can_stage).length,2);
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
console.log("Three original/edited field recordings verified by SHA-256; two owner-only disabled bumper staging candidates, no accidental airplay.");
