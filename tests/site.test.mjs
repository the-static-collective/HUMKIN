import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {execFileSync} from "node:child_process";
const text=p=>readFileSync(p,"utf8");
const html=text("index.html");
const pageIds=new Set([...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
const scripts=["player.js","gifts.js","signup.js","offline.js","sw.js"];
for(const file of scripts){
  execFileSync(process.execPath,["--check",file],{stdio:"pipe"});
  const src=text(file);
  if(file!=="sw.js")for(const match of src.matchAll(/(?:byId|\$|getElementById)\("([^"]+)"\)/g)){
    if(match[1]!=="source-link")assert(pageIds.has(match[1]),file+": missing #"+match[1]);
  }
}
const album=JSON.parse(text("tracks.json"));
assert.equal(album.tracks.length,12);
for(const [i,track] of album.tracks.entries()){
  assert.equal(track.number,i+1);
  assert(existsSync(track.url),"Missing music file: "+track.url);
  assert(track.duration>0);
}
for(const id of ["feel","mixtape","received-postcard","received-play","mix-share","mix-copy","mix-play","mix-message","mix-palette","mix-one","mix-two","mix-three","save-offline"])assert(pageIds.has(id),"Missing interface id "+id);
for(const file of ["gifts.css","poster.html","manifest.webmanifest"])assert(existsSync(file));
const src=text("gifts.js");
const parseSource=src.slice(src.indexOf("function parseMix("),src.indexOf("function chosen("));
assert(parseSource.startsWith("function parseMix("));
const parseMix=new Function(parseSource+";return parseMix")();
assert.deepEqual(parseMix("1.5.12"),[1,5,12]);
assert.deepEqual(parseMix("01.05.09"),[1,5,9]);
assert.equal(parseMix("1.1.5"),null);
assert.equal(parseMix("1.13.5"),null);
assert.equal(parseMix("not a mix"),null);
const qr=text("poster.html").match(/const data="([^"]+)"/)?.[1];
assert(qr&&Buffer.from(qr,"base64").length===172,"Poster QR missing or malformed");
console.log("HUMKIN site checks passed: scripts, UI bindings, 12 songs, gifts, offline and poster.");
