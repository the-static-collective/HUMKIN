#!/usr/bin/env node
import {appendFile, mkdir, readFile} from "node:fs/promises";
import {dirname} from "node:path";
import {pathToFileURL} from "node:url";
import {inspectWorker} from "./night-shift-aircheck.mjs";

export const ORIGIN = "https://humkin-long-wave.joyvolcanomusic.workers.dev";
export const STATIONS = Object.freeze([
  {id:"station-one", name:"Night Shift", enabled:true},
  {id:"lo-fi", name:"Lo-Fi Study", enabled:false},
  {id:"mutant", name:"Mutant Radio", enabled:false},
]);
const validId = id => typeof id==="string" && /^[a-z0-9][a-z0-9-]{0,31}$/.test(id);
const validSequence = n => Number.isSafeInteger(n) && n>=0;
export async function sampleStation(id, inspect=inspectWorker, now=()=>new Date()) {
  if(!validId(id)) throw new Error("BAD_STATION");
  let sample;
  try { sample=await inspect(ORIGIN,id); }
  catch { sample={ok:false,stage:"transport-or-validation",reason:"PROBE_FAILED"}; }
  const ok=sample.ok===true && validSequence(sample.media_sequence);
  return {schema:"humkin.transmission-observation/v1",station:id,
    observed_at:now().toISOString(),ok,
    stage:ok?"api-and-media":String(sample.stage||"invalid-receipt").slice(0,80),
    reason:ok?null:String(sample.reason||"INVALID_OR_UNAVAILABLE").slice(0,100),
    revision:ok?sample.revision??null:null,
    media_sequence:ok?sample.media_sequence:null,
    track_title:ok?sample.track_title??null:null,
    media_bytes_checked:ok?sample.media_bytes_checked??null:null,
    receiver_audio_verified:false,continuous_uptime_verified:false};
}
export function summarize(records, maxGapMs=180000, now=Date.now()) {
  if(!Number.isFinite(maxGapMs)||maxGapMs<=0) throw new Error("BAD_GAP");
  const groups=new Map();
  for(const r of records){
    if(r?.schema!=="humkin.transmission-observation/v1"||!validId(r.station)||
       !Number.isFinite(Date.parse(r.observed_at))) throw new Error("BAD_LEDGER_RECORD");
    if(!groups.has(r.station)) groups.set(r.station,[]);
    groups.get(r.station).push(r);
  }
  return [...groups].map(([station,rows])=>{
    rows.sort((a,b)=>Date.parse(a.observed_at)-Date.parse(b.observed_at));
    let start=null, previous=null, longest=0, breaks=0, advances=0, current=0;
    for(const r of rows){
      const t=Date.parse(r.observed_at);
      const good=r.ok===true && validSequence(r.media_sequence);
      if(!good){if(start!==null)breaks++; start=null; previous=null; current=0; continue;}
      if(previous){
        const gap=t-previous.t;
        if(gap<=0 || gap>maxGapMs || r.media_sequence<=previous.seq){
          breaks++;start=null;
        }else advances++;
      }
      if(start===null)start=t;
      current=t-start;longest=Math.max(longest,current);
      previous={t,seq:r.media_sequence};
    }
    const last=rows.at(-1),age=now-Date.parse(last.observed_at);
    const fresh=age>=0 && age<=maxGapMs;
    return {station,samples:rows.length,successful_samples:rows.filter(r=>r.ok===true && validSequence(r.media_sequence)).length,
      advancing_intervals:advances,breaks,last_observation:last.observed_at,
      last_revision:last.revision??null,last_media_sequence:last.media_sequence??null,
      latest_state:!fresh?"stale":last.ok===true&&validSequence(last.media_sequence)?"media_observed":"probe_failed",
      current_sampled_span_ms:fresh?current:0,longest_sampled_span_ms:longest,
      continuous_uptime_verified:false};
  });
}
export async function readLedger(path) {
  try {return (await readFile(path,"utf8")).split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));}
  catch(error){if(error.code==="ENOENT")return [];throw error;}
}
export async function appendObservation(path,record) {
  await mkdir(dirname(path),{recursive:true});
  await appendFile(path,JSON.stringify(record)+"\n",{encoding:"utf8",mode:0o600});
}
async function main(){
  const args=process.argv.slice(2);
  const value=(flag,fallback)=>{const i=args.indexOf(flag);return i<0?fallback:args[i+1];};
  const ledger=value("--ledger","./humkin-transmission-ledger.jsonl");
  const ids=value("--stations",STATIONS.filter(s=>s.enabled).map(s=>s.id).join(",")).split(",");
  if(ids.length>8||new Set(ids).size!==ids.length||ids.some(id=>!validId(id)))throw new Error("BAD_STATIONS");
  const gap=Number(value("--max-gap-seconds","180"))*1000;
  if(!Number.isFinite(gap)||gap<=0)throw new Error("BAD_GAP");
  const samples=[];
  if(!args.includes("--summary-only")){
    for(const id of ids){
      const r=await sampleStation(id);await appendObservation(ledger,r);samples.push(r);
    }
  }
  console.log(JSON.stringify({schema:"humkin.transmission-ledger-summary/v1",read_only_playout:true,
    max_gap_ms:gap,samples,stations:summarize(await readLedger(ledger),gap)},null,2));
  if(samples.some(r=>!r.ok))process.exitCode=1;
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
  main().catch(e=>{console.error(e.message);process.exitCode=1;});
}
