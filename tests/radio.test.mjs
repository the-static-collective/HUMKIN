import assert from "node:assert/strict";
import {readFileSync,existsSync,statSync} from "node:fs";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {runInNewContext} from "node:vm";
const read=f=>readFileSync(f,"utf8");
const html=read("fm/index.html"),css=read("fm/radio.css"),js=read("fm/radio.js"),schedulerJs=read("fm/scheduler.js"),autodjJs=read("fm/autodj.js"),artJs=read("fm/art-library.js"),memoryJs=read("fm/rotation-memory.js"),fairJs=read("fm/fair-rotation.js"),warmJs=read("fm/warm-signal.js"),clockJs=read("fm/clock-sync.js");
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
const approvedAirCarts=JSON.parse(read("fm/air-carts.json"));
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
 constructor(name){this.name=name;this.disabled=false;this.hidden=false;this.paused=true;this.readyState=1;this.duration=180;this.currentTime=0;this.src="";this.textContent="";this.alt="";this.listeners={};this.attributes={};this.style={};this.classList={toggle:(k,v)=>{this.attributes["class-"+k]=v}};this.playCount=0;this.playbackRate=1}
 get src(){return this._src}
 set src(src){this._src=src;this.currentTime=0}
 addEventListener(t,fn){(this.listeners[t]??=[]).push(fn)}
 emit(t){for(const fn of this.listeners[t]||[])fn({type:t,target:this})}
 setAttribute(k,v){this.attributes[k]=v}
 pause(){const was=this.paused;this.paused=true;if(!was)this.emit("pause")}
 load(){this.currentTime=0}
 play(){this.paused=false;this.playCount++;this.emit("play");return Promise.resolve()}
 click(){this.emit("click")}
}
async function flush(){await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve))}
function fixture(config=rotation,cloudRows=[],staticOverrides=[],programRows=[],clockMs=null,settingsRows=[],prefetchAudio=false,artRows=[],serverAheadMs=null,effectClass=null,airCarts=null){
 const elems=new Map(),listeners={},copies=[],downloads=[],time={now:clockMs??(Date.parse(rotation.synced_clock_epoch_utc)+135*1000)};
 function $(id){if(!elems.has(id))elems.set(id,new E(id));return elems.get(id)}
 const document={baseURI:"https://humkin.abundent.org/fm/",title:html.match(/<title>([^<]+)/)?.[1]||"HUMKIN RADIO",visibilityState:"visible",getElementById:$,addEventListener:(k,fn)=>{listeners[k]=fn},
 createElement:()=>({href:"",download:"",click(){downloads.push({href:this.href,name:this.download})},remove(){}}),
 body:{appendChild:()=>{}}};
 class Clock extends Date{static now(){return time.now}}
 const window={isSecureContext:true,addEventListener:(k,fn)=>{listeners[k]=fn}};
 const session={setActionHandler:(k,fn)=>{session[k]=fn}};
 const navigator={mediaSession:session,clipboard:{writeText:async s=>{copies.push(s)}}};
 const requests=[];
 const fetch=async url=>{
   const href=String(url);
   if(href.includes("/rest/v1/rpc/humkin_radio_clock_ms")){
     return {ok:serverAheadMs!==null,
       json:async()=>time.now+(serverAheadMs||0)};
   }
   if(/\.mp3(?:$|[?#])/i.test(href)){
     requests.push(href);
     if(!prefetchAudio)return {ok:false,status:403};
     return {ok:true,headers:{get:()=>String(4096)},
       blob:async()=>new Blob([new Uint8Array(4096)],{type:"audio/mpeg"})};
   }
   return {ok:true,json:async()=>
     href.endsWith("rotation.json")?config:
     href.endsWith("air-carts.json")?airCarts:
     href.includes("/rest/v1/humkin_radio_tracks")?cloudRows:
     href.includes("/rest/v1/humkin_radio_static_overrides")?staticOverrides:
     href.includes("/rest/v1/humkin_radio_programs")?programRows:
     href.includes("/rest/v1/humkin_radio_settings")?settingsRows:
     href.includes("/rest/v1/humkin_radio_art_assets")?artRows:songs};
 };
 class URLMock extends URL{
   static createObjectURL(blob){
     const url="blob:humkin-test-"+(++URLMock.created);
     URLMock.blobs.set(url,blob);return url;
   }
   static revokeObjectURL(url){URLMock.revoked.push(url)}
 }
 URLMock.created=0;URLMock.revoked=[];URLMock.blobs=new Map();
 const location=new URL(document.baseURI);
 const context={window,document,navigator,location,URL:URLMock,Blob,Date:Clock,Math,fetch,AbortController,
   setTimeout:()=>{},clearTimeout:()=>{},MediaMetadata:class{constructor(x){Object.assign(this,x)}}};
 runInNewContext(schedulerJs,context);
 runInNewContext(autodjJs,context);
 runInNewContext(artJs,context);
 runInNewContext(memoryJs,context);
 runInNewContext(fairJs,context);
 runInNewContext(warmJs,context);
 if(effectClass)window.HUMKIN_WARM_SIGNAL={WarmSignal:effectClass};
 runInNewContext(clockJs,context);
 runInNewContext(js,context);
 return {$,time,copies,listeners,session,window,document,requests,URLMock,downloads};
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
for(let i=0;i<40;i++){newTune.$("next-song").click();await flush();spotlightPlayed.add(newTune.window.HUMKIN_RADIO.state.index)}
assert.equal(spotlightPlayed.size,21,"Spotlight first still reaches every unique song despite extra plays");
const f=fixture();await flush();
assert.equal(f.$("listen").disabled,false,"Tune in should be enabled");
assert.equal(f.$("air").playCount,0,"No radio autoplay");
assert.equal(f.window.HUMKIN_RADIO.state.tracks,21);
const sample=f.window.HUMKIN_RADIO.tuneAt(f.time.now);
assert(sample&&sample.index>=0&&sample.index<rotation.tracks.length);
assert(sample.position>=0&&sample.position<initialTracks[sample.index].duration);
assert.equal(JSON.stringify(f.window.HUMKIN_RADIO.tuneAt(f.time.now)),JSON.stringify(sample),"Shared clock must be deterministic");
const featured=initialTracks.filter(t=>rotation.featured_rotation.albums.includes(t.album)||rotation.featured_rotation.singles.includes(t.id));
const cycleMs=[...initialTracks,...featured].reduce((a,t)=>a+Math.round(t.duration*1000),0);
const different=f.window.HUMKIN_RADIO.tuneAt(f.time.now+cycleMs);
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
for(let i=0;i<40;i++){f.$("next-song").click();await flush();played.add(f.window.HUMKIN_RADIO.state.index)}
assert.equal(played.size,21,"Road shuffle must reach every unique song with weighted replays");
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

const locked=fixture(rotation,[],[],[],null,[],true);await flush();
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

// Regression: a slow first request must never cause the NEXT song to be
// entered at +18 seconds. Only a manual CATCH UP may seek into an ongoing song.
const delayed=fixture();await flush();
delayed.$("listen").click();await flush();
const firstClock=delayed.$("air").src;
delayed.time.now+=18000; // Simulate 18 seconds of buffering after an ended event.
delayed.$("air").emit("ended");await flush();
assert.notEqual(delayed.$("air").src,firstClock,"Shared station should advance to the next scheduled recording");
assert.equal(delayed.$("air").currentTime,0,
  "Successor recording must begin at zero despite slow network/wall-clock drift");
const nextClockSource=delayed.$("air").src;
delayed.time.now+=25000;
delayed.document.visibilityState="visible";
delayed.listeners.visibilitychange();await flush();
delayed.$("air").currentTime=27;delayed.$("air").emit("timeupdate");await flush();
assert.equal(delayed.$("air").src,nextClockSource,
  "Returning to the foreground must not re-tune or jump over a song's opening");
assert.equal(delayed.$("air").currentTime,27,
  "Periodic wall-clock re-syncs must not seek mid-song");
delayed.$("catch-up").click();await flush();
assert.notEqual(delayed.$("air").currentTime,27,
  "Explicit CATCH UP remains available for listener-controlled re-sync");

// A second predownloaded audio file can switch from local Blob without pausing
// or calling load() during a normal background event. This tests the JS if its
// events execute, not whether Android keeps a suspended browser alive.
assert(locked.URLMock.created>0,"Next track should be preloaded into a Blob URL when network allows");

// An Android-native playlist removes the screen-off JavaScript boundary entirely
// for tracks in this snapshot. It must contain public MP3 URLs, not Blob tokens.
const portable=fixture();await flush();
assert.equal(portable.$("phone-playlist").disabled,false);
portable.$("phone-playlist").click();await flush();
assert.equal(portable.downloads.length,1,"Native playlist export must download once");
assert.equal(portable.downloads[0].name,"HUMKIN-RADIO.m3u");
const m3u=await portable.URLMock.blobs.get(portable.downloads[0].href).text();
assert(m3u.startsWith("#EXTM3U\n"),"Must export Extended M3U format");
assert.equal(m3u.split("\n").filter(s=>s.startsWith("#EXTINF:")).length,41,"Portable playlist should have 21 originals plus 20 featured bonus spins");
assert(m3u.includes("https://humkin.abundent.org/fm/audio/haileylu-bloom.mp3"));
assert(!m3u.includes("blob:humkin"),"Do not leak temporary playlist audio Blob URLs");

const friday=Date.parse("2026-11-13T13:30:00Z"); // 7:30 a.m. Central.
const cloudUUID="30303030-3030-4030-8030-303030303030";
const secondUUID="40404040-4040-4040-8040-404040404040";
const editableCloud=[
  {id:cloudUUID,title:"Evening Music",artist:"Hailey Lu",album:"Blue Roads",
   kind:"song",enabled:true,duration_seconds:120,
   storage_path:cloudUUID+"/"+digest+".mp3"},
  {id:secondUUID,title:"Station Bumper",artist:"HUMKIN",album:"IDs",
   kind:"bumper",enabled:true,duration_seconds:10,
   storage_path:secondUUID+"/"+digest+".mp3"}
];
const show={
 id:"50505050-5050-4050-8050-505050505050",name:"Morning Garden",days:[1,2,3,4,5],
 start_minute:420,end_minute:540,track_ids:["mutant-pop-01","crate-"+secondUUID,"crate-"+cloudUUID],
 is_active:true,priority:3
};
const managed=fixture(rotation,editableCloud,[
 {track_id:"mutant-pop-02",title:"Retitled",artist:"Another Credit",album:"Reissues",kind:"song",enabled:false},
 {track_id:"mutant-pop-03",title:"Radio Ident",artist:"HUMKIN",album:"Bumpers",kind:"bumper",enabled:true}
],[show],friday);
await flush();
assert.equal(managed.window.HUMKIN_RADIO.state.tracks,22,
  "One hidden original of 21 and two cloud tracks should leave 22 total");
assert.equal(managed.window.HUMKIN_RADIO.state.programs,1);
const onAir=managed.window.HUMKIN_RADIO.tuneAt(friday);
assert.equal(onAir.program,"Morning Garden","Program should override the shared rotation during scheduled hours");
assert([0,20,21].includes(onAir.index),"Scheduled selection must belong to the show line-up");
const outside=managed.window.HUMKIN_RADIO.tuneAt(Date.parse("2026-11-13T18:00:00Z"));
assert.equal(outside.program,undefined,"Outside a show the station must resume ordinary rotation");

// The owner's selected public field edits now enter the same genuine bumper
// rotation. Without the optional file, old listeners still receive the classic
// catalog plus whatever published cloud bumpers they have.
const approvedField=fixture(rotation,[],[],[],null,
 [{id:"main",bumper_every:3,station_label:"HUMKIN RADIO"}],
 false,[],null,null,approvedAirCarts);
await flush();
assert.equal(approvedAirCarts.carts.length,9,"All nine unique site-hosted field edits now approved");
assert.equal(approvedField.window.HUMKIN_RADIO.state.tracks,30,
 "21 songs plus 9 field recordings");
assert.equal(approvedField.window.HUMKIN_RADIO.state.bumperCount,9,
 "New recorded bumpers are actually discovered by the radio");
approvedField.$("mode-shuffle").click();approvedField.$("listen").click();await flush();
const heardFields=[];
for(let i=0;i<28;i++){
 const at=approvedField.window.HUMKIN_RADIO.state.index;
 if(at>=21)heardFields.push(at);
 approvedField.$("next-song").click();await flush();
}
assert.equal(heardFields.length,7,"Field cart appears after each three songs");
assert.equal(new Set(heardFields).size,7,"Seven distinct of nine new carts rotate across 21 test songs");
assert(approvedField.$("playlist-note").textContent.includes("STATION IDs EVERY 3 SONGS"),
 "On-air field cards must be shown as activated station IDs");

// AutoDJ adds *real marked recordings*, never fictional or duplicated songs.
const automix=fixture(rotation,[{
 id:"77777777-7777-4777-8777-777777777777",title:"HUMKIN Ident",artist:"HUMKIN",album:"ID",
 kind:"bumper",enabled:true,duration_seconds:12,
 storage_path:"77777777-7777-4777-8777-777777777777/"+digest+".mp3"
}],[],[],null,[{id:"main",bumper_every:3,station_label:"HUMKIN RADIO"}]);
await flush();
assert.equal(automix.window.HUMKIN_RADIO.state.bumperEvery,3,"Owner-selected cadence must propagate");
assert.equal(automix.window.HUMKIN_RADIO.state.bumperCount,1,"Actual station ID is loaded");
automix.$("mode-shuffle").click();automix.$("listen").click();await flush();
const autoSpins=[];
for(let i=0;i<54;i++){
 autoSpins.push(automix.window.HUMKIN_RADIO.state.index);
 automix.$("next-song").click();await flush();
}
const bumperIndex=21; // 21 static recordings plus one cloud bumper.
assert.equal(autoSpins.filter(i=>i===bumperIndex).length,13,"Station ID occurs after each group of three songs");
assert.equal(new Set(autoSpins.filter(i=>i!==bumperIndex)).size,21,"Every unique song remains in the weighted shuffle");
assert(automix.$("on-deck").textContent.includes("ON DECK"),"On-deck display missing");
const at=automix.window.HUMKIN_RADIO.tuneAt(Date.parse(rotation.synced_clock_epoch_utc)+1000);
assert(at&&at.index>=0&&at.index<22,"Same-Time AutoDJ cannot select an invalid index");


const ownerID="aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const trackCoverID="ffffffff-0000-4000-8000-ffffffffffff";
const showCoverID="eeeeeeee-0000-4000-8000-eeeeeeeeeeee";
const trackPath=ownerID+"/"+("1".repeat(64))+".jpg";
const showPath=ownerID+"/"+("2".repeat(64))+".jpg";
const incomingArts=[
 {id:trackCoverID,storage_path:trackPath},
 {id:showCoverID,storage_path:showPath}
];
const coverFixture=fixture(rotation,[],[
 {track_id:"haileylu-bloom",title:"HaileyLu Bloom",artist:"HUMKIN",
  album:"Radio",kind:"song",enabled:true,art_asset_id:trackCoverID}
],[],null,[],false,incomingArts);
await flush();
coverFixture.$("spotlight").click();await flush();
assert(coverFixture.$("current-art").src.endsWith(trackPath),
 "Current track should use its reusable artwork instead of the default album cover");
assert(coverFixture.session.metadata.artwork[0].src.endsWith(trackPath),
 "Android Media Session should display the assigned track cover");
const showWithArt={...show,art_asset_id:showCoverID};
const programmedCover=fixture(rotation,[],[
 {track_id:"mutant-pop-01",title:"Song",artist:"HUMKIN",album:"Radio",kind:"song",enabled:true,
  art_asset_id:trackCoverID}
],[showWithArt],friday,[],false,incomingArts);
await flush();
assert(programmedCover.$("current-art").src.endsWith(showPath),
 "Active program cover must override any track artwork");
assert(programmedCover.session.metadata.artwork[0].src.endsWith(showPath),
 "Media Session cover art must also prioritize the scheduled program cover");


assert.equal(newTune.window.HUMKIN_RADIO.state.hourWindowMs,3600000,
 "Road Shuffle must expose the one-hour repeat exclusion policy");
assert.equal(newTune.window.HUMKIN_RADIO.state.warmSignal.intensity,37.8,
 "The station should have a fixed 37.8% analogue listening profile");
assert.equal(newTune.window.HUMKIN_RADIO.state.warmSignal.enabled,false,
 "The browser must not start effects before a listening gesture");
assert(!html.includes('id="warm-toggle"')&&!html.includes('id="warm-intensity"'),
 "The audio texture should be part of radio, without a separate control panel");
assert(js.includes("startStationSound();"),
 "Listening events should activate the station's sound without user configuration");
class MockAtmosphere{
 constructor(_audio,options){this.intensity=options.intensity;this.enabled=false;this.playing=false}
 enable(){this.enabled=true;return Promise.resolve(true)}
 setPlayback(value){this.playing=!!value}
 status(){return {enabled:this.enabled,playing:this.playing,intensity:this.intensity}}
}
const modes=fixture(rotation,[],[],[],null,[],false,[],null,MockAtmosphere);
await flush();
modes.$("listen").click();await flush();
assert.equal(modes.window.HUMKIN_RADIO.state.warmSignal.playing,true,
 "Same-time radio turns on analogue static");
modes.$("mode-shuffle").click();await flush();
assert.equal(modes.$("air").paused,false,"Road Shuffle leaves music playing");
assert.equal(modes.window.HUMKIN_RADIO.state.warmSignal.playing,false,
 "Road Shuffle must play cleanly");
modes.$("mode-clock").click();await flush();
assert.equal(modes.window.HUMKIN_RADIO.state.warmSignal.playing,true,
 "Same-time radio restores the atmosphere");
modes.$("spotlight").click();await flush();
assert.equal(modes.window.HUMKIN_RADIO.state.warmSignal.playing,false,
 "The new single must play cleanly");

// Two receivers should reference the same server clock, even when one device's
// wall clock runs a second behind. JOIN can adjust its first song after
// buffering, but subsequent track transitions never skip the opening.
const synced=fixture(rotation,[],[],[],null,[],false,[],1000);
await flush();
assert.equal(synced.window.HUMKIN_RADIO.state.clockCalibrated,true);
assert.equal(synced.window.HUMKIN_RADIO.state.clockOffsetMs,1000);
synced.$("listen").click();await flush();
const expectedSynced=synced.window.HUMKIN_RADIO.tuneAt(synced.time.now+1000);
synced.$("air").currentTime=Math.max(0,expectedSynced.position-1.1);
synced.$("air").emit("playing");await flush();
assert(Math.abs(synced.$("air").currentTime-expectedSynced.position)<.2,
 "First actual playback should correct network latency against the common clock");
synced.$("air").currentTime=expectedSynced.position-.85;
synced.$("air").emit("timeupdate");await flush();
assert(synced.$("air").playbackRate>1&&synced.$("air").playbackRate<1.019,
 "A receiver behind the station can gradually catch up without skipping");
synced.$("air").currentTime=expectedSynced.position+.85;
synced.$("air").emit("timeupdate");await flush();
assert(synced.$("air").playbackRate<1&&synced.$("air").playbackRate>.981,
 "A receiver ahead of station time should gradually settle backward");
synced.$("air").currentTime=expectedSynced.position-18;
synced.$("air").emit("timeupdate");await flush();
assert.equal(synced.$("air").playbackRate,1,
 "A long buffering gap cannot trigger extreme speed-up or involuntary seek");

console.log("Radio tests passed: 21 real tracks (12+7+HaileyLu Bloom+Leave The Kettle On), verified uploaded MP3s, clock, no-repeat shuffle, non-autoplay and media keys.");
