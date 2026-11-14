import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const H=require("../fm/rotation-memory.js");
const F=require("../fm/warm-signal.js");
const read=p=>readFileSync(p,"utf8");
execFileSync(process.execPath,["--check","fm/rotation-memory.js"]);
execFileSync(process.execPath,["--check","fm/warm-signal.js"]);
assert.equal(H.WINDOW_MS,60*60*1000);
const now=Date.parse("2026-11-14T18:00:00Z");
const tracks=[{id:"a",kind:"song"},{id:"b",kind:"song"},{id:"c",kind:"song"},{id:"bumper",kind:"bumper"}];
const history=new Map([["a",now-20*60*1000],["b",now-61*60*1000],["c",now-5*60*1000]]);
assert.equal(H.fresh(history,"a",now),false);
assert.equal(H.fresh(history,"b",now),true);
assert.equal(H.fresh(history,"c",now),false);
assert.equal(H.chooseSlot([0,2,1],0,tracks,history,now),2,
  "Skip two recently heard recordings and choose the hour-safe one");
assert.deepEqual(H.freshFirst([2,0,1],tracks,history,now),[1,2,0],
  "Shuffle should preserve random order within eligible and ineligible partitions");
const allRecent=new Map([["a",now-15*60*1000],["b",now-41*60*1000],["c",now-12*60*1000]]);
assert.equal(H.chooseSlot([0,2,1],0,tracks,allRecent,now),2,
  "When hour exclusion impossible, choose least-recently heard");
assert.equal(H.chooseSlot([3,0,2,1],0,tracks,history,now),0,
  "Station ID remains at its programmed position; hour rule applies to songs only");
const storage=new Map();
const mockStore={setItem(k,v){storage.set(k,v)},getItem(k){return storage.get(k)||null}};
H.save(mockStore,history,now);
assert.equal(H.load(mockStore,now).get("a"),now-20*60*1000,
  "Refresh must preserve one-hour play history");
// Input validation prevents malformed localStorage or future timestamps forcing skips.
storage.set(H.KEY,JSON.stringify([["bad",now+3600*1000],["good",now-30*60*1000]]));
assert.deepEqual([...H.load(mockStore,now)],[["good",now-30*60*1000]]);

assert.equal(F.clamp(170,0,100),100);
assert.equal(F.clamp(-20,0,100),0);
assert(F.noiseGain(80)>F.noiseGain(25));
assert(F.intervalSeconds(()=>0,26)>0);
// Simulated AudioContext: verify the atmosphere does not route or replace the
// real media element, and that disabling restores listener volume.
class Param{
 constructor(v=0){this.value=v}
 setTargetAtTime(v){this.value=v}
 setValueAtTime(v){this.value=v}
 exponentialRampToValueAtTime(v){this.value=v}
}
class Node{
 constructor(){this.gain=new Param(1);this.frequency=new Param(0);this.listeners={}}
 connect(){return this}
 disconnect(){}
 start(){}
 stop(){}
}
class Context{
 constructor(){this.sampleRate=4000;this.currentTime=0;this.state="running";this.destination=new Node()}
 createBuffer(channels,length){const data=Array.from({length:channels},()=>new Float32Array(length));
   return {getChannelData:i=>data[i]}}
 createBufferSource(){return new Node()}
 createGain(){return new Node()}
 createBiquadFilter(){return new Node()}
 createOscillator(){return new Node()}
 createChannelSplitter(){return new Node()}
 createChannelMerger(){return new Node()}
 createMediaElementSource(){throw Error("Must not capture music: CORS failure can mute radio")}
 resume(){return Promise.resolve()}
 close(){return Promise.resolve()}
}
let nextId=0;const timers=new Map();
const fauxWin={AudioContext:Context,setTimeout(fn){const id=++nextId;timers.set(id,fn);return id},
 clearTimeout(id){timers.delete(id)}};
const media={volume:.8,listeners:{},addEventListener(type,cb){this.listeners[type]=cb}};
const effect=new F.WarmSignal(media,{window:fauxWin,intensity:26});
assert.equal(effect.status().enabled,false,"Effects must always start OFF");
await effect.enable();
assert.equal(effect.status().enabled,true);
assert.equal(new F.WarmSignal(media,{window:fauxWin}).status().intensity,37.8);
assert.equal(media.volume,.8,"Enabling effects must not change music volume by itself");
effect.setPlayback(true);
assert(effect.gain.gain.value>0,"Playing music should allow very soft static");
assert.equal(effect.popBus.gain.value,1,"Pops must pass through gated radio bus");
assert.equal(F.RADIO_BPM,92,"Radio rhythm must be based on 92 BPM");
assert(Math.abs(F.BEAT_SECONDS-60/92)<1e-10);
assert(Math.abs(F.SWELL_HZ-92/240)<1e-10,"One sine swell per four beats");
assert.equal(effect.swell.type,"sine");
assert.equal(effect.swell.frequency.value,F.SWELL_HZ);
assert(Math.abs(effect.swellDepth.gain.value-effect.gain.gain.value*.115)<.000001,
  "Warm static gently rises and falls around its radio-only bed");
const beatInterval=F.beatMappedInterval(()=>.45,42);
assert(Math.abs(beatInterval/F.BEAT_SECONDS-Math.round(beatInterval/F.BEAT_SECONDS))<1e-9,
  "Random atmospheric events should respect the soft 92 BPM timing grid");
effect.sag();
assert(media.volume<.8&&media.volume>.6,"Short signal dip should be modest");
effect.setPlayback(false);
assert.equal(media.volume,.8,"Switching away restores music volume");
assert.equal(effect.gain.gain.value,0,"Switching away mutes static");
assert.equal(effect.popBus.gain.value,0,"Switching away mutes pops");
assert.equal(effect.swellDepth.gain.value,0,"Switching away mutes swell");
effect.setPlayback(true);
effect.sag();
for(const [id,callback] of [...timers]){if(id===effect.restoreTimer)callback()}
assert.equal(media.volume,.8,"Signal dip must restore the listener's prior volume");
effect.disable();
assert.equal(effect.status().enabled,false);
assert.equal(effect.gain.gain.value,0,"Signal layer must fade out when disabled");
assert.equal(effect.swellDepth.gain.value,0,"The sine swell must stop modulating when paused");
assert.equal(media.volume,.8,"Disabling the layer must not leave music attenuated");

const page=read("fm/index.html"),css=read("fm/radio.css"),radio=read("fm/radio.js");
for(const id of ["warm-toggle","warm-intensity","warm-status","warm-level"]){
  assert(!page.includes('id="'+id+'"'),"Radio atmosphere should not be presented as a separate feature");
}
assert(!css.includes(".warm-dial"),"Remove no-longer-used atmosphere control CSS");
assert(radio.includes("intensity:37.8"),"Automatically use the 37.8% radio-only station texture");
assert(radio.includes("startStationSound();"),"Start the texture from a listening gesture");
assert(F.WarmSignal&&F.noiseGain(42)>F.noiseGain(26),
  "The analogue engine still supports the chosen warmth");
assert(page.indexOf('rotation-memory.js')<page.indexOf('radio.js'));
assert(page.indexOf('warm-signal.js')<page.indexOf('radio.js'));

assert(radio.includes("rememberShuffleTrack"),"Radio should record played music");
assert(radio.includes("chooseShuffleCandidate"),"Radio prefetch must honor 1-hour guard");
assert(radio.includes("shufflePolicy?.save"),"Radio should remember history after refresh");
assert(!read("fm/warm-signal.js").includes("createMediaElementSource"),
  "Warm static must not reroute cross-origin MP3 signal");
assert(read("sw.js").includes('"./fm/rotation-memory.js"'));
assert(read("sw.js").includes('"./fm/warm-signal.js"'));
console.log("HUMKIN warm signal + 60m memory tests passed: persistence, fresh choice, fallback, timed hiss, dips, volume restoration, no media rerouting and UI.");
