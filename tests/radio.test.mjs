import assert from "node:assert/strict";
import {readFileSync,existsSync,statSync} from "node:fs";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {runInNewContext} from "node:vm";
const read=f=>readFileSync(f,"utf8");
const html=read("fm/index.html"),css=read("fm/radio.css"),js=read("fm/radio.js");
for(const p of ["fm/index.html","fm/radio.css","fm/radio.js","fm/rotation.json","fm/manifest.webmanifest","docs/RADIO-OPERATIONS.md"])assert(existsSync(p),"Missing radio file "+p);
execFileSync(process.execPath,["--check","fm/radio.js"]);
const ids=new Set([...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
for(const m of js.matchAll(/\$\("([^"]+)"\)/g))assert(ids.has(m[1]),"Missing HTML element #"+m[1]);
assert(html.includes('rel="manifest"'),"Radio installable manifest missing");
assert(!/<audio[^>]*\\sautoplay(?:\\s|>)/i.test(html),"Do not autoplay radio");
assert(!html.includes("88.1"),"Do not mislead with a real-sounding FM frequency");
assert(html.includes("SAME-TIME RADIO")&&html.includes("ROAD SHUFFLE"));
assert(html.includes("not yet a dedicated broadcast stream"),"Simulated radio must be labeled");
assert(html.includes('href="../"'),"Album homepage link missing");
assert(css.includes("@media(max-width:480px)"),"Must support phone screens");
const rotation=JSON.parse(read("fm/rotation.json"));
const songs=JSON.parse(read("tracks.json"));
const ep=JSON.parse(read("releases/everywhere-near-you/tracks.json"));
const initialTracks=rotation.tracks;
assert.equal(rotation.source_type,"track_list");
assert.equal(rotation.status,"expanded_rotation");
assert.equal(rotation.live_stream_url,null,"Do not invent streaming server");
assert.equal(rotation.tracks.length,21);
assert.equal(new Set(rotation.tracks.map(t=>t.id)).size,21,"Radio track IDs must be unique");
assert.equal(rotation.tracks.filter(t=>t.album==="MUTANT POP").length,12);
assert.equal(rotation.tracks.filter(t=>t.album==="everywhere;near you").length,7);
assert.equal(ep.tracks.length,7);
const single=rotation.tracks.find(t=>t.id==="haileylu-bloom");
assert(single&&single.title==="HaileyLu Bloom","New single must be in radio rotation");
assert.equal(single.src,"./audio/haileylu-bloom.mp3");
assert(Math.abs(single.duration-147.864)<.01);
const mp3Path="fm/audio/haileylu-bloom.mp3";
assert.equal(statSync(mp3Path).size,3428213,"Real uploaded MP3 must be committed in full");
assert.equal(createHash("sha256").update(readFileSync(mp3Path)).digest("hex"),"1c92c36b078586a3bc795e4431dd63cec8d0733349d9d61bcec83dbc080aced6","Exact uploaded audio must be preserved");
const kettle=rotation.tracks.find(t=>t.id==="leave-the-kettle-on");
assert(kettle&&kettle.title==="Leave The Kettle On"&&Math.abs(kettle.duration-173.952)<.01,"New Kettle single must be present");
assert.equal(kettle.src,"./audio/leave-the-kettle-on.mp3");
const kettlePath="fm/audio/leave-the-kettle-on.mp3";
assert.equal(statSync(kettlePath).size,3925398,"Full Kettle MP3 must be uploaded");
assert.equal(createHash("sha256").update(readFileSync(kettlePath)).digest("hex"),"c855100c353b8f229c0811bf67c079f5e038dca4316b5a08a90cf10225e08d3d","Uploaded Kettle song must retain exact bytes");
for(const t of rotation.tracks){
 assert(t.title&&t.artist==="HUMKIN"&&Number.isFinite(t.duration)&&t.duration>0,"Invalid radio metadata");
 const url=new URL(t.src,"https://humkin.abundent.org/fm/");
 assert(url.origin==="https://humkin.abundent.org"&&url.pathname.endsWith(".mp3"),"Invalid radio MP3 path");
 assert(existsSync(new URL(t.src,"file://"+process.cwd()+"/fm/")),"Radio track MP3 not assembled: "+t.src);
}
assert(html.includes("EVERYWHERE;NEAR YOU · 7 SONGS"),"New EP should link from radio page");
assert(songs.tracks.length===12);
assert(read("sw.js").includes('"./fm/radio.js"'),"Radio script not in offline shell");
assert(!read("sw.js").includes("dj-pack.zip"),"Do not pre-cache giant ZIP");
assert(read("index.html").includes('href="./fm/"'),"Homepage must link the standalone station");
assert(read("sitemap.xml").includes("https://humkin.abundent.org/fm/"),"Sitemap entry missing");

class E {
 constructor(name){this.name=name;this.disabled=false;this.hidden=false;this.paused=true;this.readyState=1;this.duration=180;this.currentTime=0;this.src="";this.textContent="";this.alt="";this.listeners={};this.attributes={};this.style={};this.classList={toggle:(k,v)=>{this.attributes["class-"+k]=v}};this.playCount=0}
 addEventListener(t,fn){(this.listeners[t]??=[]).push(fn)}
 emit(t){for(const fn of this.listeners[t]||[])fn()}
 setAttribute(k,v){this.attributes[k]=v}
 pause(){const was=this.paused;this.paused=true;if(!was)this.emit("pause")}
 load(){this.currentTime=0}
 play(){this.paused=false;this.playCount++;this.emit("play");return Promise.resolve()}
 click(){this.emit("click")}
}
async function flush(){await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve))}
function fixture(config=rotation,cloudRows=[]){
 const elems=new Map(),listeners={},copies=[],time={now:Date.parse(rotation.synced_clock_epoch_utc)+135*1000};
 function $(id){if(!elems.has(id))elems.set(id,new E(id));return elems.get(id)}
 const document={baseURI:"https://humkin.abundent.org/fm/",title:html.match(/<title>([^<]+)/)?.[1]||"HUMKIN RADIO",visibilityState:"visible",getElementById:$,addEventListener:(k,fn)=>{listeners[k]=fn}};
 class Clock extends Date{static now(){return time.now}}
 const window={isSecureContext:true,addEventListener:(k,fn)=>{listeners[k]=fn}};
 const session={setActionHandler:(k,fn)=>{session[k]=fn}};
 const navigator={mediaSession:session,clipboard:{writeText:async s=>{copies.push(s)}}};
 const fetch=async url=>({ok:true,json:async()=>
  String(url).endsWith("rotation.json")?config:
  String(url).includes("/rest/v1/humkin_radio_tracks")?cloudRows:songs});
 const location=new URL(document.baseURI);
 runInNewContext(js,{window,document,navigator,location,URL,Date:Clock,Math,fetch,AbortController,setTimeout:()=>{},clearTimeout:()=>{},MediaMetadata:class{constructor(x){Object.assign(this,x)}}});
 return {$,time,copies,listeners,session,window,document};
}
const newTune=fixture();await flush();
const uuid="10293847-1029-4837-9029-abcdefabcdef";
const digest="a".repeat(64);
const imported=fixture(rotation,[{id:uuid,title:"New Road Song",artist:"HUMKIN",
 album:"CRATE ONE",duration_seconds:184.4,storage_path:uuid+"/"+digest+".mp3"}]);
await flush();
assert.equal(imported.window.HUMKIN_RADIO.state.tracks,22,"Creator's approved cloud track must join the original 21");
assert(imported.window.HUMKIN_RADIO.tracks===undefined,"Public player surface should stay compact");
assert.equal(newTune.window.HUMKIN_RADIO.state.tracks,21,"Original radio must survive an empty cloud catalog");
assert.equal(newTune.$("spotlight").disabled,false);
assert.equal(newTune.$("air").playCount,0,"Spotlight must never autoplay");
newTune.$("spotlight").click();await flush();
assert.equal(newTune.window.HUMKIN_RADIO.state.mode,"shuffle","Spotlight must enter Road Shuffle");
assert.equal(newTune.window.HUMKIN_RADIO.state.index,19,"Spotlight must select HaileyLu Bloom");
assert(newTune.$("current-title").textContent==="HaileyLu Bloom");
assert(newTune.$("air").src.endsWith("/fm/audio/haileylu-bloom.mp3"));
assert.equal(newTune.$("air").playCount,1,"One click must actually start HaileyLu Bloom");
assert(html.includes("HEAR THE NEW ONE · HAILEYLU BLOOM"),"Button label must match its song");
const spotlightPlayed=new Set([newTune.window.HUMKIN_RADIO.state.index]);
for(let i=0;i<20;i++){newTune.$("next-song").click();await flush();spotlightPlayed.add(newTune.window.HUMKIN_RADIO.state.index)}
assert.equal(spotlightPlayed.size,21,"Spotlight-first radio must still play all twenty-one tracks without repeats");
const f=fixture();await flush();
assert.equal(f.$("listen").disabled,false,"Tune in should be enabled");
assert.equal(f.$("air").playCount,0,"No radio autoplay");
assert.equal(f.window.HUMKIN_RADIO.state.tracks,21);
const sample=f.window.HUMKIN_RADIO.tuneAt(f.time.now);
assert(sample&&sample.index>=0&&sample.index<rotation.tracks.length);
assert(sample.position>=0&&sample.position<initialTracks[sample.index].duration);
assert.equal(JSON.stringify(f.window.HUMKIN_RADIO.tuneAt(f.time.now)),JSON.stringify(sample),"Shared clock must be deterministic");
const different=f.window.HUMKIN_RADIO.tuneAt(f.time.now+initialTracks.reduce((a,t)=>a+Math.round(t.duration*1000),0));
assert.equal(different.cycle,sample.cycle+1,"Station rotation must continue into a new cycle");
f.$("listen").click();await flush();
assert.equal(f.$("air").playCount,1,"Tune-in must start playback");
assert.equal(f.$("air").paused,false);
assert.equal(f.$("air").src,new URL(initialTracks[sample.index].src,"https://humkin.abundent.org/fm/").href,"Same-time radio must select a real published recording");
assert(f.$("air").currentTime>0,"Tuning in should seek into the current shared clock position");
f.$("mode-shuffle").click();await flush();
assert.equal(f.window.HUMKIN_RADIO.state.mode,"shuffle");
assert.equal(f.$("next-song").hidden,false);
const played=new Set([f.window.HUMKIN_RADIO.state.index]);
for(let i=0;i<20;i++){f.$("next-song").click();await flush();played.add(f.window.HUMKIN_RADIO.state.index)}
assert.equal(played.size,21,"Road shuffle must hear all 21 unique tracks before repeat");
assert(played.has(19),"Road shuffle must play HaileyLu Bloom before the cycle repeats");
assert(played.has(20),"Road shuffle must play Leave The Kettle On before the cycle repeats");
assert([...played].some(i=>i>=12),"Road shuffle never reached the newly added EP");
assert.equal(f.$("air").paused,false,"Shuffle should continuously play");
f.$("mode-clock").click();await flush();
assert.equal(f.window.HUMKIN_RADIO.state.mode,"clock");
assert.equal(f.$("next-song").hidden,true,"No track skipping in shared clock");
const nowTitle=f.$("current-title").textContent;
f.time.now+=240*1000;
f.$("catch-up").click();await flush();
assert.equal(f.$("current-title").textContent,initialTracks[f.window.HUMKIN_RADIO.tuneAt(f.time.now).index].title,"Catch up must synchronize to station clock");
f.$("share-station").click();await flush();
assert.equal(f.copies[0],"https://humkin.abundent.org/fm/","Share station should link this URL");
f.$("listen").click();await flush();
assert.equal(f.$("air").paused,true,"Radio must be pausable");
assert(f.session.play&&f.session.pause&&f.session.nexttrack,"Media key hooks missing");
const custom={...rotation,source_type:"track_list",status:"curated",tracks:[
 {id:"a",title:"New Track One",artist:"HUMKIN",src:"./audio/track-one.mp3",duration:183.4},
 {id:"b",title:"New Track Two",artist:"HUMKIN",src:"./audio/track-two.mp3",duration:154.7}
]};
const customF=fixture(custom);await flush();
assert.equal(customF.window.HUMKIN_RADIO.state.tracks,2,"Curated JSON should work without modifying JavaScript");
assert(customF.$("air").src.includes("/fm/audio/"),"Custom track URLs should resolve relative to the FM directory");
assert(customF.$("playlist-note").textContent.includes("demo")||customF.$("playlist-note").textContent.length>0);

const locked=fixture();await flush();
locked.$("mode-shuffle").click();locked.$("listen").click();await flush();
const lockedAudio=locked.$("air"),firstSource=lockedAudio.src;
locked.document.visibilityState="hidden";
let transitionsPaused=0,transitionsLoaded=0;
const nativePause=lockedAudio.pause.bind(lockedAudio),nativeLoad=lockedAudio.load.bind(lockedAudio);
lockedAudio.pause=()=>{transitionsPaused++;return nativePause()};
lockedAudio.load=()=>{transitionsLoaded++;return nativeLoad()};
lockedAudio.duration=180;lockedAudio.currentTime=179.8;
lockedAudio.emit("timeupdate");await flush();
assert.notEqual(lockedAudio.src,firstSource,"Locked-screen shuffle should pre-advance at track end");
assert.equal(transitionsPaused,0,"A new track must not explicitly pause the media session");
assert.equal(transitionsLoaded,0,"A new track must not explicitly load and reset the media session");
assert.equal(locked.session.playbackState,"playing","Media Session must stay playing across track transitions");
const secondSource=lockedAudio.src;lockedAudio.emit("ended");await flush();
assert.notEqual(lockedAudio.src,secondSource,"Ended fallback must also advance when screen is hidden");
locked.$("listen").click();await flush();
assert.equal(locked.session.playbackState,"paused","Explicit pause should stop the media session");
const hiddenClock=fixture();await flush();
hiddenClock.$("listen").click();await flush();
hiddenClock.document.visibilityState="hidden";
const clockSource=hiddenClock.$("air").src;
hiddenClock.time.now+=240000;hiddenClock.$("air").currentTime=15;
hiddenClock.$("air").emit("timeupdate");await flush();
assert.equal(hiddenClock.$("air").src,clockSource,"Hidden clock should not force resync mid-song");

console.log("Radio tests passed: 21 real tracks (12+7+HaileyLu Bloom+Leave The Kettle On), verified uploaded MP3s, clock, no-repeat shuffle, non-autoplay and media keys.");
