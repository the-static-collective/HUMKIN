import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {runInNewContext} from "node:vm";
const read=p=>readFileSync(p,"utf8");
const album=JSON.parse(read("tracks.json"));
const html=read("somewhere.html"),miniHtml=read("embed.html");
for(const path of ["somewhere.html","somewhere.css","somewhere.js","embed.html","embed.css","embed.js","discovery.json","docs/DISTRIBUTION.md","relay.html"])assert(existsSync(path),"Missing station asset: "+path);
for(const js of ["somewhere.js","embed.js"])execFileSync(process.execPath,["--check",js]);
const discovery=JSON.parse(read("discovery.json"));
assert.equal(discovery.catalog,"https://humkin.abundent.org/tracks.json");
assert.equal(Object.keys(discovery.presets).length,5);
assert.equal(album.tracks.length,12);
for(const entries of Object.values(discovery.presets))assert(entries.length===3&&new Set(entries).size===3&&entries.every(n=>n>=1&&n<=12));
assert(read("index.html").includes('href="./somewhere.html"'),"Home does not link to station");
assert(read("sw.js").includes('"./somewhere.js"')&&read("sw.js").includes('"./embed.js"'),"Offline shell must include player assets");
assert(read("sw.js").includes("humkin-shell-v9"),"Offline shell version not bumped");
for(const [page,script] of [[html,"somewhere.js"],[miniHtml,"embed.js"]]){
 const ids=new Set([...page.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
 for(const match of read(script).matchAll(/\$\("([^"]+)"\)/g))assert(ids.has(match[1]),script+" references missing #"+match[1]);
}
assert(html.includes("Commercial sync")||html.includes("Commercial sync,"),"Station must mention actual licensing gate");
assert(!html.includes("Google Analytics"),"Unexpected analytics");
assert(html.includes('href="./relay.html"'),"Station does not link six-up physical relay");
assert(miniHtml.includes('GET THIS PLAYER ↗'),"Embeds must make it possible to create more embeds");
const RELAY=read("relay.html");
assert((RELAY.match(/class="card"/g)||[]).length===6,"Print sheet must have six unique cards");
const QR=read("poster.html").match(/const data="([^"]+)"/)?.[1];
assert(QR&&Buffer.from(QR,"base64").length===172,"Existing local poster QR must survive");
class El{
 constructor(id){this.id=id;this.value="";this.textContent="";this.disabled=false;this.hidden=false;this.href="";this.src="";this.children=[];this.listeners={};this.attributes={};this.dataset={};this.playCount=0;this.currentTime=0;this.paused=true;this.classList={toggle(){}}}
 addEventListener(type,fn){this.listeners[type]=fn}
 setAttribute(k,v){this.attributes[k]=v}
 append(...items){this.children.push(...items)}
 replaceChildren(...items){this.children=items}
 get firstElementChild(){return this.children[0]}
 pause(){this.paused=true}
 load(){}
 play(){this.paused=false;this.playCount++;return Promise.resolve()}
 click(){assert(this.listeners.click,"Missing click handler on "+this.id);return this.listeners.click({preventDefault(){}})}
 focus(){}
 select(){}
}
const dataArt=JSON.parse(read("postcards.json"));
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(script,url){
 const els=new Map(),roomButtons=["coffee","work","gym","table","night"].map(id=>{const e=new El("room-"+id);e.dataset.room=id;return e});
 const embedButtons=["mix","one","all"].map(id=>{const e=new El("embed-"+id);e.dataset.embed=id;return e});
 const get=id=>{if(!els.has(id))els.set(id,new El(id));return els.get(id)};
 const document={baseURI:"https://humkin.abundent.org/",getElementById:get,createElement:name=>new El(name),execCommand:()=>true,querySelectorAll:selector=>selector==="[data-room]"?roomButtons:selector==="[data-embed]"?embedButtons:[]};
 const copies=[],shares=[];
 const navigator={clipboard:{writeText:async x=>{copies.push(x)}},share:async x=>{shares.push(x)}};
 const window={isSecureContext:true};
 const fetch=async url=>({ok:true,json:async()=>String(url).includes("postcards.json")?dataArt:album});
 runInNewContext(script,{document,window,navigator,location:new URL(url),URL,fetch,console,Math});
 return {get,roomButtons,embedButtons,copies,shares,window};
}
const station=fixture(read("somewhere.js"),"https://humkin.abundent.org/somewhere.html?room=work");
await flush();await flush();
assert.equal(station.get("room-name").textContent,"MAKING / WORKING");
assert.equal(station.get("room-play").disabled,false);
assert.equal(station.get("room-tracks").children.length,3);
station.roomButtons[2].click();
assert.equal(station.get("room-name").textContent,"MOVING / ENERGY");
station.get("room-play").click();
assert(station.get("room-audio").src.endsWith("03_Bright_Blue_Rose.mp3"),"Room start should match gym preset");
assert.equal(station.get("room-audio").playCount,1,"Room must play on button click");
await station.get("room-copy").click();
assert(station.copies.some(x=>x.includes("room=gym")),"Room sharing must copy selected playlist");
station.embedButtons[2].click();
assert(station.get("embed-code").value.includes("all=1"),"All 12 embed mode broken");
await station.get("embed-copy").click();
assert(station.copies.some(x=>x.includes("<iframe")&&x.includes("all=1")),"Embed code copy failed");
station.get("seed-make").click();
assert(station.get("seed-link").value.includes("mix="),"Random postcard link missing");
assert(station.get("seed-link").value.includes("art="),"Random postcard must preserve illustration");
assert.equal(station.get("seed-tracks").children.length,3,"Postcard must have three songs");
await station.get("seed-share").click();
assert.equal(station.shares.length,1,"Native postcard share not called");
assert.equal(new URL(station.shares[0].url).searchParams.get("mix").split(".").length,3);
const widget=fixture(read("embed.js"),"https://humkin.abundent.org/embed.html?mix=01.05.09");
await flush();await flush();
assert.equal(widget.get("mini-list").children.length,3,"Embed should show 3 songs");
assert.equal(widget.get("mini-play").disabled,false,"Embed playback button stays disabled");
widget.get("mini-play").click();
assert.equal(widget.get("mini-audio").playCount,1,"Embed play button does not play");
widget.get("mini-next").click();
assert(widget.get("mini-audio").src.endsWith("05_Room_Enough_for_Two.mp3"),"Embed next should advance to next selected song");
const single=fixture(read("embed.js"),"https://humkin.abundent.org/embed.html?track=12");await flush();await flush();
assert.equal(single.get("mini-list").children.length,1);
assert.equal(single.get("mini-next").disabled,true);
const all=fixture(read("embed.js"),"https://humkin.abundent.org/embed.html?all=1");await flush();await flush();
assert.equal(all.get("mini-list").children.length,12);
console.log("Distribution smoke tests passed: five rooms, play/next, copy, three embed formats, real random postcard + original postcard buttons intact.");
