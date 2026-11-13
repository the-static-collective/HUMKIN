import assert from "node:assert/strict";
import {readFileSync, existsSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {runInNewContext} from "node:vm";

const read=p=>readFileSync(p,"utf8");
const html=read("dj.html"),js=read("dj.js"),catalog=JSON.parse(read("tracks.json"));
for(const path of ["dj.html","dj.css","dj.js","docs/DJ-PERMISSION.md","scripts/build_dj_pack.py","dj-pack.zip","dj-crate.csv","dj-crate.m3u8"]){
  assert(existsSync(path), "Missing DJ desk asset: "+path);
}
execFileSync(process.execPath,["--check","dj.js"]);
assert(html.includes('href="./dj-pack.zip"'),"No full ZIP download on DJ desk");
assert(html.includes('href="./dj-crate.csv"'),"No metadata download");
assert(html.includes('href="./dj-crate.m3u8"'),"No local playlist download");
assert(html.includes("not published here yet"),"Page must not pretend WAV/stems already exist");
assert(html.includes("Public DJ performance may require venue/platform licenses"),"DJ license warning absent");
assert(read("index.html").includes('href="./dj.html"'),"Home must link to DJ desk without altering full album");
assert(read("somewhere.html").includes('href="./dj.html"'),"Station must link to DJ desk");
assert(read("sw.js").includes("humkin-shell-v10"),"DJ service worker needs version bump");
assert(read("sw.js").includes('"./dj.js"'),"Service worker must cache DJ interface");
assert(!read("sw.js").includes('"./dj-pack.zip"'),"Do not automatically pre-cache large audio ZIP");
assert(read("sitemap.xml").includes("https://humkin.abundent.org/dj.html"),"Sitemap missing DJ desk");
const rights=read("docs/RIGHTS-INVENTORY.md");
assert(rights.includes("generated while subscribed to Suno Premier"),"Creator's source testimony must be preserved");
assert(rights.split("\n").filter(line=>/^\|\s*\d{2}\s*\|/.test(line)&&line.includes("**Not cleared**")).length===12,"No blanket business rights claim");
const permission=read("docs/DJ-PERMISSION.md");
assert(permission.includes("approved Suno channel"),"Suno approved-download rights condition missing");
assert(permission.includes("No blanket public performance clearance"),"Venue rights warning missing");
assert(permission.includes("No public remix or re-release authorization"),"Rights category boundary missing");
const ids=new Set([...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
for(const match of js.matchAll(/\$\("([^"]+)"\)/g))assert(ids.has(match[1]),"Missing element #"+match[1]);
// Validate actual production ZIP made in CI rather than checking fabricated URLs.
const py=[
  "import csv,json,zipfile",
  "from pathlib import Path",
  "tracks=json.loads(Path('tracks.json').read_text())['tracks']",
  "with zipfile.ZipFile('dj-pack.zip') as z:",
  " assert z.testzip() is None",
  " names=set(z.namelist())",
  " assert all(t['url'] in names for t in tracks)",
  " assert len([n for n in names if n.endswith('.mp3')]) == 12",
  " assert {'dj-crate.csv','dj-crate.m3u8','DJ-PERMISSION.md','HUMKIN_DJ_README.txt'} <= names",
  " assert 'audio/'+tracks[0]['filename'] in names",
  "rows=list(csv.DictReader(open('dj-crate.csv',encoding='utf-8-sig',newline='')))",
  "assert len(rows)==12",
  "assert all(not r['bpm'] and not r['musical_key'] for r in rows)",
  "assert '#EXTM3U' in Path('dj-crate.m3u8').read_text()",
  "print('Verified real 12-MP3 DJ ZIP, CSV and local M3U8')",
].join("\n");
execFileSync("python3",["-c",py],{stdio:"inherit"});
class El{
 constructor(tag){this.tag=tag;this.children=[];this.textContent="";this.className="";this.dataset={};this.listeners={};this.attributes={};this.src="";this.href="";this.playCount=0;this.paused=true;this.classList={toggle(){}}}
 append(...x){this.children.push(...x)}replaceChildren(...x){this.children=x}
 addEventListener(k,fn){this.listeners[k]=fn}
 setAttribute(k,v){this.attributes[k]=v}
 pause(){this.paused=true} load(){}
 play(){this.paused=false;this.playCount++;return Promise.resolve()}
 click(){assert(this.listeners.click);return this.listeners.click()}
}
const elm=new Map();
const $=id=>{if(!elm.has(id))elm.set(id,new El("div"));return elm.get(id)};
const document={baseURI:"https://humkin.abundent.org/",getElementById:$,createElement:tag=>new El(tag),querySelectorAll:selector=>selector===".track"?$("track-grid").children:[]};
const fetch=async url=>({ok:true,json:async()=>catalog});
runInNewContext(js,{document,URL,fetch,console});
await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));
const cards=$("track-grid").children;
assert.equal(cards.length,12,"DJ page must list all 12 songs");
assert.equal(cards[0].children[1].children[0].textContent,catalog.tracks[0].title);
const controls=cards[0].children[2].children;
assert.equal(controls.length,2);
assert(controls[1].href.endsWith(catalog.tracks[0].url),"Track must link to official MP3");
assert.equal(controls[1].download,catalog.tracks[0].filename);
assert.equal($("preview-audio").playCount,0,"No autoplay on DJ desk");
controls[0].click();
await new Promise(resolve=>setImmediate(resolve));
assert.equal($("preview-audio").playCount,1,"DJ preview button must play real selected audio");
assert($("preview-audio").src.endsWith(catalog.tracks[0].url));
assert($("stem-mail").href.includes(encodeURIComponent(catalog.tracks[0].title)),"Stems request must name selected song");
console.log("DJ desk tests passed: 12 real MP3s, accessible auditioner, pack, metadata, playlist, rights gates and retained album homepage.");
