/* Exact upstream Field Answer implementation in ./phonography, pinned in SOURCES.md.
 * Input: canonical WAV from already-decoded broadcast segment. Output: public-safe
 * proposal summary only. No raw audio, private data, MIDI or audition published. */
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {buildFieldAnswer} from "./phonography/field-answer.mjs";
const sha=b=>createHash("sha256").update(b).digest("hex");
const wav=readFileSync(0);
if(wav.length<44||wav.length>1500000)throw Error("Invalid bounded audio");
const sampleId=process.argv[2];
if(!/^[a-f0-9]{64}$/.test(sampleId||""))throw Error("Invalid source sample ID");
// Python supplies canonical PCM WAV with an exact standard 44-byte header.
if(wav.toString("ascii",0,4)!=="RIFF"||wav.toString("ascii",36,40)!=="data"||wav.readUInt32LE(40)!==wav.length-44||(wav.length-44)%4)throw Error("Invalid WAV carrier");
const duration=(wav.length-44)*1000/176400;
if(duration<1000||duration>8000)throw Error("Duration outside bounded sample");
const digest=sha(wav);
const result=buildFieldAnswer({schema:"haunted-phonograph/field-answer-request/v0",seed:sampleId,
 window:{window_id:"autodisco-audio-window-v0:"+sampleId,audio_sha256:digest,source_sha256:sampleId,
 requested_bounds:{start_ms:0,end_ms:duration},duration_ms:duration,media_type:"audio/wav",base64:wav.toString("base64")}});
const v=result.proposal.value;
process.stdout.write(JSON.stringify({pitches:v.pitches,tempo_bpm:v.tempoBpm,durations_quarter:v.durationsQuarter,
 receipt_hash:result.receipt.receipt_hash,signal_evidence_hash:result.receipt.signal_evidence_hash,
 proposal_hash:result.receipt.proposal_hash,source_audio_sha256:digest}));
