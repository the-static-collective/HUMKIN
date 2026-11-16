const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const core=require("../fm/studio/intake-core.js");
assert.equal(core.infer("Farm Report.m4a",17).department,"field_report");
assert.equal(core.infer("Top of Hour News.wav",14).caution,true);
assert.equal(core.infer("Newsman.mp3",59).department,"feature");
assert.equal(core.safeName("Hello!!! X/Y"),"hello-x-y");
assert.throws(()=>core.prepare([new Float32Array(1000)],44100),/silent/);
const rate=44100,signal=new Float32Array(rate*3);
for(let i=rate;i<2*rate;i++)signal[i]=.17*Math.sin(2*Math.PI*300*i/rate);
const out=core.prepare([signal],rate);
assert(out.duration>1&&out.duration<1.4,"trim silence but retain padding");
assert(out.trimmedHeadSeconds>.7&&out.trimmedTailSeconds>.7);
assert(out.mono.every(Number.isFinite));
assert(out.mono.reduce((peak,v)=>Math.max(peak,Math.abs(v)),0)<.93,"no clipping");
const html=fs.readFileSync(path.join(__dirname,"../fm/studio/index.html"),"utf8");
for(const id of ["intake-drop","intake-pick","intake-title","intake-department",
                 "intake-stage","intake-preview","intake-rights"])
 assert(html.includes('id="'+id+'"'),"Missing intake UI id: "+id);
assert(html.includes('<div id="workbench" class="hidden">'),"Intake remains under owner gated workbench");
const js=fs.readFileSync(path.join(__dirname,"../fm/studio/intake.js"),"utf8");
assert(js.includes('enabled:false'),"Staged carts must start disabled");
assert(js.includes('BUCKET="humkin-radio-inbox"'),"Only private storage bucket permitted");
assert(!js.includes("humkin-radio-live"),"No live bucket write");
assert(!js.includes("published_at:new Date"),"No auto publication");
console.log("Living Cart Machine: signal, classifications, UI, private-only stage checks passed.");
