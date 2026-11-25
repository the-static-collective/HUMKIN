import {findPairs,buildCross,crossMidi,crossReceipt} from "./pollinator.mjs";
import {MAX_NODES,rootNode,familyPairs,makeChild,admitChild,familyBundle,verifyFamily,germlinePerformance} from "./family.mjs";
const ROOT="https://raw.githubusercontent.com/the-static-collective/HUMKIN/return-signal-feed/robots/echo-orchard/";
const PIN="f5709e096756055e1a28c95ac5f9e79873319631",KEY="humkin.echo-orchard.harvest/v1";
const HASH=/^(?:sha256:)?[a-f0-9]{64}$/;
export const validDay=d=>typeof d==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
export function validSeed(s){
 const p=s?.proposal;
 return s?.state==="proposal_only"&&/^[a-f0-9]{64}$/.test(s.id)&&s.engine_commit===PIN&&s.station_id==="station-one"&&
 typeof s.track_title==="string"&&s.track_title.length<=160&&typeof s.created_at==="string"&&Number.isFinite(Date.parse(s.created_at))&&
 Array.isArray(p?.pitches)&&p.pitches.length===4&&p.pitches.every(n=>Number.isInteger(n)&&n>=36&&n<=84)&&
 Number.isInteger(p.tempo_bpm)&&p.tempo_bpm>=76&&p.tempo_bpm<=116&&Array.isArray(p.durations_quarter)&&p.durations_quarter.length===4&&p.durations_quarter.every(n=>[.5,.75,1].includes(n))&&
 typeof p.midi?.base64==="string"&&p.midi.base64.length<=5500&&HASH.test(p.midi.sha256)&&
 HASH.test(p.receipt_hash)&&p.receipt_hash.replace(/^sha256:/,"")===s.id&&p.native_receipt?.receipt_hash===p.receipt_hash;
}
export function readDay(data,day){
 if(data?.schema!=="humkin.echo-orchard/day/v1"||data.day!==day||!Array.isArray(data.seeds)||data.seeds.length>288)throw Error("Invalid archive day");
 return data.seeds.filter(validSeed).reverse();
}
export const noteName=n=>["C","C♯","D","D♯","E","F","F♯","G","G♯","A","A♯","B"][n%12]+(Math.floor(n/12)-1);
export function harvestBundle(seeds){return {schema:"humkin.echo-orchard.harvest/v1",state:"draft_for_owner_review",broadcast_authority:false,seeds:seeds.filter(validSeed).slice(0,128)};}
const canonical=value=>value===null||typeof value!=="object"?JSON.stringify(value):Array.isArray(value)?"["+value.map(canonical).join(",")+"]":"{"+Object.keys(value).sort().map(k=>JSON.stringify(k)+":"+canonical(value[k])).join(",")+"}";
const sha256=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),x=>x.toString(16).padStart(2,"0")).join("");
export async function midiBytes(seed){
 if(!validSeed(seed))throw Error("Invalid seed");
 const p=seed.proposal.midi,bytes=Uint8Array.from(atob(p.base64),x=>x.charCodeAt(0));
 if(bytes.length!==p.byte_length||bytes.length>4096||String.fromCharCode(...bytes.slice(0,4))!=="MThd")throw Error("Malformed MIDI");
 const actual=await sha256(bytes);
 if(actual!==p.sha256.replace(/^sha256:/,""))throw Error("MIDI checksum mismatch");
 const {receipt_hash,...receipt}=seed.proposal.native_receipt;
 const hash=async value=>"sha256:"+await sha256(new TextEncoder().encode(canonical(value)));
 if(await hash(receipt)!==receipt_hash||await hash(seed.proposal.native_proposal)!==receipt.proposal_hash||await hash(seed.proposal.signal_evidence.signal_profile)!==receipt.signal_evidence_hash||receipt.midi.sha256!==p.sha256||receipt.midi.byte_length!==p.byte_length||receipt.source_window.source_sha256!==seed.source_segment_sha256)throw Error("Native receipt mismatch");
 const v=seed.proposal.native_proposal.value;
 if(JSON.stringify(v.pitches)!==JSON.stringify(seed.proposal.pitches)||v.tempoBpm!==seed.proposal.tempo_bpm||JSON.stringify(v.durationsQuarter)!==JSON.stringify(seed.proposal.durations_quarter))throw Error("Proposal summary mismatch");
 return bytes;
}
function download(bytes,name,type){const a=document.createElement("a"),url=URL.createObjectURL(new Blob([bytes],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function mount(){
 const el=id=>document.getElementById(id),status=el("status"),action=el("action"),day=el("day");
 let saved=[],ctx=null,voices=[],version=0;
 try{const data=JSON.parse(localStorage.getItem(KEY)||"[]");saved=Array.isArray(data)?data.filter(validSeed).slice(0,128):[];}catch{}
 function save(next){try{localStorage.setItem(KEY,JSON.stringify(next));saved=next;renderBasket();}catch{action.textContent="Could not save on this device; download the MIDI instead.";}}
 function stop(){for(const n of voices){try{n.stop()}catch{}}voices=[];}
 async function audition(seed){
  stop();const token=++version;
  try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw Error("Audio unavailable");ctx=ctx||new Audio();await ctx.resume();await midiBytes(seed);if(token!==version)return;
   let time=ctx.currentTime+.05;const p=seed.proposal;
   for(let i=0;i<4;i++){const duration=p.durations_quarter[i]*60/p.tempo_bpm;const osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.type="sine";osc.frequency.value=440*2**((p.pitches[i]-69)/12);gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(.12,time+.025);gain.gain.linearRampToValueAtTime(0,time+duration);osc.connect(gain).connect(ctx.destination);osc.start(time);osc.stop(time+duration+.01);voices.push(osc);time+=duration;}
   action.textContent="Auditioning original proposed notes. This is a simple synthesized preview, not the broadcast recording.";
  }catch{action.textContent="Could not verify or audition this seed.";}
 }
 const button=(label,fn)=>{const b=document.createElement("button");b.type="button";b.textContent=label;b.addEventListener("click",fn);return b};
 function renderBasket(){el("pairs").replaceChildren();el("pollinator-status").textContent="Harvest changed. Run the search again.";el("count").textContent=String(saved.length);const box=el("basket");box.replaceChildren();for(const s of saved){const row=document.createElement("div"),text=document.createElement("span");row.className="saved";text.textContent=s.proposal.pitches.map(noteName).join(" · ")+" — "+(s.track_title||"Unknown source recording");row.append(text,button("Remove",()=>save(saved.filter(x=>x.id!==s.id))));box.append(row);}}
 function render(seeds){const box=el("seeds");box.replaceChildren();for(const s of seeds){const card=document.createElement("article");card.id=s.id;const title=document.createElement("h2");title.textContent=s.track_title?"Reply to "+s.track_title:"Reply to unidentified broadcast fragment";const notes=document.createElement("p");notes.className="notes";notes.textContent=s.proposal.pitches.map(noteName).join(" · ")+" / "+s.proposal.tempo_bpm+" BPM";const credit=document.createElement("small");credit.textContent=new Date(s.created_at).toLocaleString()+" · Native Field Answer · Proposal only";const controls=document.createElement("div");controls.className="actions";
  controls.append(button("Audition",()=>void audition(s)),button("Download MIDI",async()=>{try{download(await midiBytes(s),"humkin-echo-"+s.id.slice(0,12)+".mid","audio/midi");action.textContent="MIDI checksum verified."}catch{action.textContent="MIDI verification failed.";}}),button("Harvest",async()=>{try{await midiBytes(s);if(saved.some(x=>x.id===s.id)){action.textContent="Already harvested.";return}if(saved.length>=128){action.textContent="Export and remove seeds before harvesting more.";return}save([...saved,s]);}catch{action.textContent="Seed verification failed.";}}));
  const details=document.createElement("details"),summary=document.createElement("summary"),code=document.createElement("code");summary.textContent="Source and proposal receipt";code.textContent="Source sample: "+s.source_sample_id+" | Receipt: "+s.id;details.append(summary,code);card.append(title,notes,credit,controls,details);box.append(card);}
  const target=location.hash.slice(1);if(/^[a-f0-9]{64}$/.test(target))document.getElementById(target)?.scrollIntoView();
 }
 let searchVersion=0;
 async function playCross(cross){
  stop();const token=++version;
  try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw Error("Audio unavailable");ctx=ctx||new Audio();await ctx.resume();if(token!==version)return;
   const start=ctx.currentTime+.05,p=cross.performance;
   for(const e of p.events){const t=start+e.tick/p.ppq*60/p.tempoBpm,d=e.durationTicks/p.ppq*60/p.tempoBpm,osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=e.channel?"triangle":"sine";osc.frequency.value=440*2**((e.note-69)/12);gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.07,t+.02);gain.gain.linearRampToValueAtTime(0,t+d);osc.connect(gain).connect(ctx.destination);osc.start(t);osc.stop(t+d+.01);voices.push(osc);}
   action.textContent="Auditioning a new composition proposal, not the source broadcast.";
  }catch{action.textContent="Unable to audition this cross.";}
 }
 async function pollinate(){
  const req=++searchVersion, snapshot=saved.slice(),status=el("pollinator-status"),box=el("pairs");box.replaceChildren();status.textContent="Verifying parent receipts…";
  const checked=[];for(const seed of snapshot){try{await midiBytes(seed);checked.push(seed)}catch{}}
  if(req!==searchVersion||snapshot.length!==saved.length||snapshot.some((s,i)=>s.id!==saved[i]?.id))return;
  const pairs=findPairs(checked),byId=new Map(checked.map(s=>[s.id,s]));
  status.textContent=checked.length<2?"Harvest at least two verified seeds.":pairs.length+" candidate pairings from "+checked.length+" verified seeds (ranked by heuristic compatibility).";
  for(const pair of pairs){const a=byId.get(pair.a),b=byId.get(pair.b),card=document.createElement("article"),title=document.createElement("h2"),desc=document.createElement("p"),actions=document.createElement("div");
   title.textContent=(a.track_title||a.id.slice(0,8))+" × "+(b.track_title||b.id.slice(0,8));
   desc.textContent="Score "+pair.score+" · transpose second phrase "+pair.shift+" semitones · tempo difference "+pair.tempo_distance+" BPM · clash overlap "+Math.round(pair.clash_fraction*100)+"%";
   const mode=document.createElement("select");mode.setAttribute("aria-label","Composition form");for(const [v,label] of [["duet","Duet"],["call-response","Call & response"],["graft","Alternating graft"]]){const option=document.createElement("option");option.value=v;option.textContent=label;mode.append(option);}
   const build=()=>buildCross(a,b,pair,mode.value);actions.className="actions";
   actions.append(mode,button("Audition cross",()=>void playCross(build())),button("Download MIDI",()=>{const cross=build();download(crossMidi(cross),"humkin-cross-"+a.id.slice(0,8)+"-"+b.id.slice(0,8)+".mid","audio/midi")}),button("Export ancestry",async()=>{try{const cross=await crossReceipt(build());download(JSON.stringify({schema:"humkin.echo-orchard.cross-export/v1",cross,parents:[a,b]},null,2),"humkin-cross-"+cross.id.slice(0,12)+".json","application/json");}catch{action.textContent="Could not export cross receipt.";}}));
   card.append(title,desc,actions);box.append(card);
  }
 }
 el("pollinate").addEventListener("click",()=>void pollinate());
 const FAMILY_KEY="humkin.echo-orchard.family/v1",familyStatus=el("family-status");
 let family=[],familyBusy=false;
 function renderFamily(){
  const box=el("family-nodes");box.replaceChildren();el("family-pairs").replaceChildren();
  familyStatus.textContent=family.length+" retained nodes · "+family.filter(n=>n.kind==="root").length+" roots · "+family.filter(n=>n.kind==="child").length+" descendants.";
  for(const n of family){const row=document.createElement("article"),title=document.createElement("h2"),notes=document.createElement("p"),detail=document.createElement("p"),controls=document.createElement("div");
   title.textContent=(n.kind==="root"?"Root":"Generation "+n.generation)+" · "+(n.track_title||n.id.slice(0,12));
   notes.className="notes";notes.textContent=n.proposal.pitches.map(noteName).join(" · ");
   detail.textContent=n.kind==="root"?"Original receipt "+n.id:"Parents "+n.parents.map(id=>id.slice(0,12)).join(" × ")+" · "+n.roots.length+" original roots · "+n.mutation;
   controls.className="actions";controls.append(button("Audition inherited phrase",()=>void playCross(germlinePerformance(n))),button("Inherited MIDI",()=>download(crossMidi(germlinePerformance(n)),"humkin-lineage-"+n.id.slice(0,12)+".mid","audio/midi")));
   if(n.kind==="child")controls.append(button("Audition full cross",()=>void playCross(n.cross)),button("Full cross MIDI",()=>download(crossMidi(n.cross),"humkin-cross-"+n.id.slice(0,12)+".mid","audio/midi")));
   row.append(title,notes,detail,controls);box.append(row);
  }
 }
 function storeFamily(next){
  try{localStorage.setItem(FAMILY_KEY,JSON.stringify(familyBundle(next)));}catch{throw Error("Local storage unavailable or full; export current family first");}
  family=next;renderFamily();
 }
 async function familyAction(fn){if(familyBusy)return;familyBusy=true;try{await fn()}catch(e){familyStatus.textContent=e.message||"Family operation failed."}finally{familyBusy=false}}
 void familyAction(async()=>{const raw=localStorage.getItem(FAMILY_KEY);if(raw)family=await verifyFamily(JSON.parse(raw),midiBytes);renderFamily();});
 el("family-roots").addEventListener("click",()=>void familyAction(async()=>{
  let next=family.slice();for(const s of saved){if(next.some(n=>n.id===s.id))continue;if(next.length>=MAX_NODES)throw Error("Family capacity reached");await midiBytes(s);next.push(rootNode(s));}
  storeFamily(next);
 }));
 el("family-search").addEventListener("click",()=>void familyAction(async()=>{
  const related=el("family-related").checked,pairs=familyPairs(family,related),byId=new Map(family.map(n=>[n.id,n])),box=el("family-pairs");box.replaceChildren();
  familyStatus.textContent=pairs.length+" diverse candidate pairings. Shared ancestry is "+(related?"penalized.":"excluded.");
  for(const pair of pairs){
   const a=byId.get(pair.a),b=byId.get(pair.b),card=document.createElement("article"),title=document.createElement("h2"),info=document.createElement("p"),controls=document.createElement("div");
   title.textContent="G"+a.generation+" "+a.id.slice(0,8)+" × G"+b.generation+" "+b.id.slice(0,8);
   info.textContent="Compatibility "+pair.score+" · diversity adjusted "+pair.diversity_score+" · shared roots "+pair.shared_roots+" · displacement "+pair.shift;
   const select=(label,options)=>{const x=document.createElement("select");x.setAttribute("aria-label",label);for(const [v,l] of options){const o=document.createElement("option");o.value=v;o.textContent=l;x.append(o)}return x};
   const mode=select("Composition form",[["duet","Duet"],["call-response","Call & response"],["graft","Graft"]]),mutation=select("Inherited phrase mutation",[["none","No mutation"],["up-2","Transpose +2"],["down-2","Transpose -2"],["rotate-rhythm","Rotate rhythm"]]);
   const build=()=>makeChild(a,b,pair,mode.value,mutation.value,related);
   controls.className="actions";controls.append(mode,mutation,button("Audition candidate",async()=>{try{await playCross(germlinePerformance(await build()))}catch(e){familyStatus.textContent=e.message}}),button("Cultivate descendant",()=>void familyAction(async()=>{
    if(!family.some(n=>n.id===a.id)||!family.some(n=>n.id===b.id))throw Error("Parents changed; run search again");
    const child=await build();storeFamily(admitChild(family,child));familyStatus.textContent="Cultivated generation "+child.generation+" · "+child.id.slice(0,12)+". Run search again for the next generation.";
   })));card.append(title,info,controls);box.append(card);
  }
 }));
 el("family-related").addEventListener("change",()=>{el("family-pairs").replaceChildren();familyStatus.textContent="Ancestry policy changed. Run search again.";});
 el("family-export").addEventListener("click",()=>download(JSON.stringify(familyBundle(family),null,2),"humkin-family.json","application/json"));
 el("family-import").addEventListener("change",()=>void familyAction(async()=>{const file=el("family-import").files[0];if(!file)return;if(file.size>4000000)throw Error("Family file exceeds 4 MB");const next=await verifyFamily(JSON.parse(await file.text()),midiBytes);
  if(family.length&&!window.confirm("Replace this device’s current family? Export it first to preserve it."))return;storeFamily(next);
 }));
 let requestVersion=0;
 async function fetchJSON(path){const result=await fetch(ROOT+path,{cache:"no-store",credentials:"omit",signal:AbortSignal.timeout(10000)});if(result.status===404)return null;if(!result.ok)throw Error("Archive unavailable");const raw=await result.text();if(raw.length>5000000)throw Error("Archive exceeds bound");return JSON.parse(raw);}
 async function load(value){if(!validDay(value)){status.textContent="Choose a valid UTC date.";return}const req=++requestVersion;day.value=value;status.textContent="Opening harvest…";try{const data=await fetchJSON("days/"+value+".json");if(req!==requestVersion)return;const seeds=data?readDay(data,value):[];render(seeds);status.textContent=seeds.length?seeds.length+" original musical proposals · "+value+" UTC":"No archived proposals for "+value+" UTC.";}catch{if(req===requestVersion)status.textContent="Archive unavailable; previous displayed seeds are historical.";}}
 async function latest(){try{const i=await fetchJSON("index.json");if(i?.schema==="humkin.echo-orchard/index/v1"&&validDay(i.latest_day))await load(i.latest_day);else if(!i||i.latest_day===null){render([]);status.textContent="No musical proposals have been received yet.";}else throw Error("Invalid index");}catch{status.textContent="Archive unavailable.";}}
 el("load").addEventListener("click",()=>void load(day.value));el("latest").addEventListener("click",()=>void latest());el("stop").addEventListener("click",()=>{version++;stop()});el("export").addEventListener("click",()=>{if(!saved.length){action.textContent="Harvest at least one seed first.";return}download(JSON.stringify(harvestBundle(saved),null,2),"humkin-echo-harvest.json","application/json");});
 renderBasket();const requested=new URLSearchParams(location.search).get("day");day.value=new Date().toISOString().slice(0,10);if(validDay(requested))void load(requested);else void latest();
}
if(typeof document!=="undefined")mount();
