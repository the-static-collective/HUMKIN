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
// Walmart pitch gate: keep the full-album player as the home page.
const station=text("somewhere.html");
assert(html.includes("<title>HUMKIN — MUTANT POP | Free full album</title>"),"Home page must remain the full album for Walmart submissions");
assert(html.includes('id="album-heading"')&&html.includes('id="play-album"')&&html.includes('id="audio"'),"Homepage player must remain intact");
assert(html.includes('href="./somewhere.html"'),"Home must link to a separate distribution station");
assert(station.includes("Put HUMKIN Somewhere — Free Music Distribution Station"),"Distribution station must retain its own standalone HTML page");
assert(station.includes('href="./"'),"The station needs a route back to the main album page");
const album=JSON.parse(text("tracks.json"));
assert.equal(album.tracks.length,12);
for(const [i,track] of album.tracks.entries()){
  assert.equal(track.number,i+1);
  assert(existsSync(track.url),"Missing music file: "+track.url);
  assert(track.duration>0);
}
for(const id of ["feel","mixtape","received-postcard","received-play","mix-share","mix-copy","mix-play","mix-message","mix-one","mix-two","mix-three","save-offline"])assert(pageIds.has(id),"Missing interface id "+id);
for(const file of ["gifts.css","poster.html","manifest.webmanifest"])assert(existsSync(file));
assert(existsSync("approved-look.css"),"Approved hand-printed design stylesheet missing");
assert(html.includes('href="./approved-look.css"'),"Approved design stylesheet not linked");
assert(text("sw.js").includes('"./approved-look.css"'),"Offline shell does not cache approved design stylesheet");
assert(/src="\.\/gifts\.js\?v=[a-z0-9-]+"/.test(html),"Postcard script must have a versioned URL to bypass previously installed cache-first workers");
assert(text("sw.js").includes('fetch(request,{cache:"no-cache"})'),"Service worker must fetch matching UI code from network before old cache");
assert(text("sw.js").includes('url.pathname'),"Service worker must recognize versioned script URLs");
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
const emojiButtons=[...html.matchAll(/data-juke="(\d+)"/g)].map(m=>Number(m[1]));
assert.deepEqual(emojiButtons,Array.from({length:12},(_,i)=>i+1),"Jukebox must expose each track exactly once");
assert(!html.includes('class="mood-grid"'),"Old bulky song-machine layout must be absent");
const posterManifest=JSON.parse(text("postcards.json"));
assert(posterManifest.published.length>=1,"At least one real artwork must be available");
assert(posterManifest.published.some(a=>a.id==="mutant-pop"),"Original MUTANT POP cover must remain a safe fallback");
for(const art of posterManifest.published){
  assert(/^[a-z0-9-]+$/.test(art.id),"Invalid postcard art ID");
  assert(/^(cover\.jpg|postcards\/[a-z0-9-]+\.(jpg|png|webp))$/.test(art.src),"Unsafe art path");
  assert(existsSync(art.src),"Unpublished art file: "+art.src);
}
for(const id of ["mix-preview-art","received-art","mix-preview-art-wrap","received-art-wrap"])assert(pageIds.has(id),"Missing art UI #"+id);
for(const id of ["mix-art","mix-palette"])assert(!pageIds.has(id),"Manual postcard art/color field should be removed: "+id);
assert(!/\b(?:artPicker|palette\.value)\b/.test(src),"Postcard code must not read removed selectors");
assert(src.includes('chosenArtId=randomArtId()'),"A new postcard must get a random published image");
assert(src.includes('url.searchParams.set("art",chosenArtId)'),"Share link must preserve random illustration");
assert(src.includes('url.searchParams.set("card",chosenTheme)'),"Share link must preserve random paper color");
assert(src.includes('drawArt("received",params.get("art")||"mutant-pop")'),"Previously shared postcard art must be preserved");

console.log("HUMKIN site checks passed: 12 emoji tracks, media, postcard art manifest, offline, poster.");
