import test from "node:test";import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const bridge=fileURLToPath(new URL("../tools/listening-council/field-answer-bridge.mjs",import.meta.url));
test("native donor generates receipt-bound reply from canonical synthetic fixture",()=>{
 const wav=Buffer.alloc(44+176400);wav.write("RIFF",0);wav.writeUInt32LE(wav.length-8,4);wav.write("WAVEfmt ",8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(44100,24);wav.writeUInt32LE(176400,28);wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);wav.write("data",36);wav.writeUInt32LE(wav.length-44,40);
 for(let i=44;i<wav.length;i+=4){let n=Math.round(1000*Math.sin((i-44)/4*.04));wav.writeInt16LE(n,i);wav.writeInt16LE(n,i+2);}
 const run=()=>spawnSync(process.execPath,[bridge,"a".repeat(64)],{input:wav,encoding:"utf8",timeout:20000});
 const a=run(),b=run();assert.equal(a.status,0,a.stderr);assert.equal(b.status,0,b.stderr);assert.equal(a.stdout,b.stdout);
 const p=JSON.parse(a.stdout);assert.equal(p.pitches.length,4);assert.ok(p.receipt_hash);assert.equal("base64" in p,false);
});
