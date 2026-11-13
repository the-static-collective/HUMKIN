import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {runInNewContext} from "node:vm";
const read=p=>readFileSync(p,"utf8");
for(const file of ["surprise.html","surprise.css","surprise.js","docs/RIGHTS-INVENTORY.md"])assert(existsSync(file),"Missing music relay asset "+file);
execFileSync(process.execPath,["--check","surprise.js"]);
const html=read("surprise.html");
const ids=new Set([...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
for(const match of read("surprise.js").matchAll(/byId\("([^"]+)"\)/g))assert(ids.has(match[1]),"Missing surprise page #"+match[1]);
assert(!html.includes("autoplay"),"Surprise player must not autoplay");
assert(html.includes('href="./somewhere.html"'),"Music gift must return to distribution station");
assert(html.includes('href="./#songs"'),"Must preserve main album link");
const a=JSON.parse(read("tracks.json")),arts=JSON.parse(read("postcards.json"));
assert.equal(a.tracks.length,12);
const rights=read("docs/RIGHTS-INVENTORY.md");
for(const t of a.tracks)assert(rights.includes(t.source)&&rights.includes(t.title),"Rights ledger missing "+t.title);
assert.equal(rights.split("\n").filter(line=>/^\|\s*\d{2}\s*\|/.test(line)&&line.includes("**Not cleared**")).length,12,"No songs may be assumed licensed for business playback");
const relay=read("relay.html");
const poster=read("poster.html");
const qr=relay.match(/const size=37,data="([^"]+)"/)?.[1];
const original=poster.match(/const data="([^"]+)"/)?.[1];
assert(qr&&qr!==original&&Buffer.from(qr,"base64").length===172,"Six music cards must have a separate 37x37 QR from the album poster");
assert(relay.includes("humkin.abundent.org/surprise.html"),"Printed cards must show the actual surprise page");
assert(read("somewhere.html").includes('href="./surprise.html"'),"Station must link surprise song");
assert(Number(read("sw.js").match(/humkin-shell-v(\d+)/)?.[1])>=8&&read("sw.js").includes('"./surprise.js"'),"SW needs fresh gift code");
assert(read("sitemap.xml").includes("/surprise.html</loc>"),"Sitemap must link surprise");
assert(!read("sitemap.xml").includes("\\n"),"Sitemap has literal backslash-n");

class El{
 constructor(id){this.id=id;this.value="";this.textContent="";this.disabled=true;this.src="";this.href="";this.download="";this.alt="";this.paused=true;this.playCount=0;this.listeners={};this.attributes={};}
 addEventListener(name,fn){this.listeners[name]=fn}
 setAttribute(key,value){this.attributes[key]=value}
 pause(){this.paused=true}
 load(){}
 play(){this.playCount++;this.paused=false;return Promise.resolve()}
 focus(){}
 select(){}
 click(){assert(this.listeners.click,"No handler for "+this.id);return this.listeners.click({preventDefault(){}})}
}
const flush=async()=>{await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve))};
function boot(initial,withShare=true){
 const elements=new Map(),handlers={};
 const get=id=>{if(!elements.has(id))elements.set(id,new El(id));return elements.get(id)};
 const location=new URL(initial),changes=[],copies=[],shares=[];
 const history={
   pushState(_,__,url){location.href=url;changes.push({kind:"push",url})},
   replaceState(_,__,url){location.href=url;changes.push({kind:"replace",url})}
 };
 const window={isSecureContext:true,addEventListener:(name,fn)=>{handlers[name]=fn}};
 const document={baseURI:"https://humkin.abundent.org/",getElementById:get,execCommand:()=>false};
 const navigator={clipboard:{writeText:async value=>copies.push(value)}};
 if(withShare)navigator.share=async value=>shares.push(value);
 const fetch=async u=>({ok:true,json:async()=>String(u).includes("postcards.json")?arts:a});
 runInNewContext(read("surprise.js"),{document,window,navigator,location,history,fetch,URL,URLSearchParams,Math,console});
 return {get,handlers,location,changes,copies,shares,window};
}
const start=boot("https://humkin.abundent.org/surprise.html");
await flush();
assert(start.location.searchParams.has("song"),"Random QR entry should freeze chosen song in URL");
assert(start.location.searchParams.has("art"),"Random QR entry should freeze chosen art in URL");
const initialSong=Number(start.location.searchParams.get("song"));
const initialArt=start.location.searchParams.get("art");
assert(initialSong>=1&&initialSong<=12);
assert(arts.published.some(x=>x.id===initialArt));
assert.equal(start.get("gift-audio").playCount,0,"Never autoplay on visit or query");
assert.equal(start.get("gift-play").disabled,false);
assert.equal(start.get("gift-send").disabled,false);
assert.equal(start.get("gift-next").disabled,false);
assert(start.get("gift-keep").href.endsWith(a.tracks[initialSong-1].url),"Keep must download selected MP3");
assert.equal(start.get("gift-keep").attributes["aria-disabled"],"false");
assert.equal(start.get("gift-link").value,start.location.href,"Share link must preserve the art/song selected");
await start.get("gift-play").click();
assert.equal(start.get("gift-audio").playCount,1,"Play button must start real audio element");
start.get("gift-next").click();
assert.notEqual(Number(start.location.searchParams.get("song")),initialSong,"Find another must not repeat the previous song");
assert.notEqual(start.location.searchParams.get("art"),initialArt,"New gift should get different art when choices available");
assert.equal(start.get("gift-audio").playCount,1,"Another should not autoplay the new song");
await start.get("gift-send").click();
assert.equal(start.shares.length,1,"Native share should be usable");
assert.equal(start.shares[0].url,start.location.href,"Native share uses permanent canonical link");
const link=start.location.href;
const received=boot(link,false);
await flush();
assert.equal(received.get("gift-link").value,link,"Deep link should recreate the exact art/song pair");
assert.equal(received.get("gift-audio").playCount,0,"Deep link must not autoplay");
await received.get("gift-send").click();
assert.deepEqual(received.copies,[link],"Clipboard fallback should share fixed link");
const before=received.get("song-title").textContent;
received.location.href="https://humkin.abundent.org/surprise.html?song=09&art=basil";
received.handlers.popstate();
assert.equal(received.get("song-title").textContent,"Rose Mary Blooms","Back/forward must restore chosen track");
assert.equal(received.get("gift-art").alt,arts.published.find(x=>x.id==="basil").alt);
assert.notEqual(received.get("song-title").textContent,before===undefined?null:"","Song title must exist");
console.log("One-song relay tests passed: QR entry, persistent art/song URLs, user-initiated audio, keep, share, another, navigation and all 12 rights holds.");
