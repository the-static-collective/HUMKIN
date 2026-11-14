import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const Art=require("../fm/art-library.js");
const read=path=>readFileSync(path,"utf8");
for(const f of ["fm/art-library.js","fm/manage/art-upload.js","fm/manage/index.html","fm/manage/manager.js"])
 assert(existsSync(f),"Missing artwork file "+f);
const owner="aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",digest="f".repeat(64);
const url=Art.publicUrl(owner+"/"+digest+".jpg");
assert.equal(url,"https://kbhqacsdvjsstzyplqij.supabase.co/storage/v1/object/public/humkin-radio-art/"+owner+"/"+digest+".jpg");
assert.equal(Art.publicUrl("../../other-bucket/bad.jpg"),null);
assert.equal(Art.publicUrl(owner+"/not-valid.png"),null);
assert.equal(Art.publicUrl("javascript:alert(1)"),null);
const assets=Art.libraryMap([
 {id:"song-cover",storage_path:owner+"/"+digest+".jpg"},
 {id:"show-cover",storage_path:owner+"/"+("e".repeat(64))+".jpg"},
 {id:"malicious",storage_path:"../../no.jpg"}
]);
assert.equal(assets.size,2,"Only safely addressable stored art is allowed");
const song={art_asset_id:"song-cover",artwork:"https://humkin.abundent.org/cover.jpg"};
const show={art_asset_id:"show-cover"};
assert.equal(Art.effective(song,show,assets),assets.get("show-cover").url,
  "An active program cover takes priority over a track cover");
assert.equal(Art.effective(song,null,assets),assets.get("song-cover").url,
  "Without a program cover, use the song cover");
assert.equal(Art.effective(song,{art_asset_id:"missing"},assets),assets.get("song-cover").url,
  "Missing program art must fall back safely");
assert.equal(Art.effective({artwork:"https://humkin.abundent.org/cover.jpg"},null,assets),
  "https://humkin.abundent.org/cover.jpg","Missing cover defaults to familiar artwork");

const page=read("fm/manage/index.html"),manager=read("fm/manage/manager.js");
const player=read("fm/radio.js"),radioHtml=read("fm/index.html");
const ids=new Set([...page.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
for(const id of ["art-upload","art-library","art-status","art-count",
 "edit-art","edit-art-preview","show-art","show-art-preview"])
 assert(ids.has(id),"Missing artwork interface "+id);
for(const match of manager.matchAll(/\$\("([^"]+)"\)/g))
 assert(ids.has(match[1]),"Manager script uses absent element "+match[1]);
execFileSync(process.execPath,["--check","fm/art-library.js"]);
execFileSync(process.execPath,["--input-type=module","--check"],{input:read("fm/manage/art-upload.js")});
execFileSync(process.execPath,["--input-type=module","--check"],{input:manager});
assert(manager.includes("prepareCover(original)"),"Cover must be prepared locally");
assert(manager.includes('crypto.subtle.digest("SHA-256"'),"Cover needs hashed dedup");
assert(manager.includes('db.storage.from(ART).upload'),"Cover upload must use separated storage bucket");
assert(manager.includes("art_asset_id:track.art_asset_id||null"),"Legacy track toggle must preserve artwork");
assert(manager.includes('art_asset_id:$(\x22edit-art\x22).value||null'),"Track editor must save art ID");
assert(manager.includes('art_asset_id:$(\x22show-art\x22).value||null'),"Program editor must save art ID");
assert(player.includes("art_asset_id"),"Radio must load linked art assets");
assert(player.includes('fetchExtras("humkin_radio_art_assets"'),"Radio must load the reusable art shelf");
assert(player.includes("setMediaInfo({...t,artwork:cover})"),"Lockscreen metadata should reflect chosen art");
assert(radioHtml.indexOf('art-library.js')<radioHtml.indexOf('radio.js'),"Artwork helper must load before radio");
assert(read("sw.js").includes('"./fm/art-library.js"'),"Offline shell must cache resolver");
assert(read("fm/manage/art-upload.js").includes("canvas.toBlob("),"Images must be optimized to JPEG");
assert(!/sb_secret_|service_role/.test(manager),"No privileged Supabase key in browser");
console.log("HUMKIN art library checks passed: safe path, precedence, legacy/cloud/show assignments, image prep, dedup, UI and lockscreen artwork.");
