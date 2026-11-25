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
export async function midiBytes(seed){
 if(!validSeed(seed))throw Error("Invalid seed");
 const p=seed.proposal.midi,bytes=Uint8Array.from(atob(p.base64),x=>x.charCodeAt(0));
 if(bytes.length!==p.byte_length||bytes.length>4096||String.fromCharCode(...bytes.slice(0,4))!=="MThd")throw Error("Malformed MIDI");
 const actual=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),x=>x.toString(16).padStart(2,"0")).join("");
 if(actual!==p.sha256.replace(/^sha256:/,""))throw Error("MIDI checksum mismatch");
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
  try{await midiBytes(seed);if(token!==version)return;const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw Error("Audio unavailable");ctx=ctx||new Audio();await ctx.resume();if(token!==version)return;
   let time=ctx.currentTime+.05;const p=seed.proposal;
   for(let i=0;i<4;i++){const duration=p.durations_quarter[i]*60/p.tempo_bpm;const osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.type="sine";osc.frequency.value=440*2**((p.pitches[i]-69)/12);gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(.12,time+.025);gain.gain.linearRampToValueAtTime(0,time+duration);osc.connect(gain).connect(ctx.destination);osc.start(time);osc.stop(time+duration+.01);voices.push(osc);time+=duration;}
   action.textContent="Auditioning original proposed notes. This is a simple synthesized preview, not the broadcast recording.";
  }catch{action.textContent="Could not verify or audition this seed.";}
 }
 const button=(label,fn)=>{const b=document.createElement("button");b.type="button";b.textContent=label;b.addEventListener("click",fn);return b};
 function renderBasket(){el("count").textContent=String(saved.length);const box=el("basket");box.replaceChildren();for(const s of saved){const row=document.createElement("div"),text=document.createElement("span");row.className="saved";text.textContent=s.proposal.pitches.map(noteName).join(" · ")+" — "+(s.track_title||"Unknown source recording");row.append(text,button("Remove",()=>save(saved.filter(x=>x.id!==s.id))));box.append(row);}}
 function render(seeds){const box=el("seeds");box.replaceChildren();for(const s of seeds){const card=document.createElement("article");card.id=s.id;const title=document.createElement("h2");title.textContent=s.track_title?"Reply to "+s.track_title:"Reply to unidentified broadcast fragment";const notes=document.createElement("p");notes.className="notes";notes.textContent=s.proposal.pitches.map(noteName).join(" · ")+" / "+s.proposal.tempo_bpm+" BPM";const credit=document.createElement("small");credit.textContent=new Date(s.created_at).toLocaleString()+" · Native Field Answer · Proposal only";const controls=document.createElement("div");controls.className="actions";
  controls.append(button("Audition",()=>void audition(s)),button("Download MIDI",async()=>{try{download(await midiBytes(s),"humkin-echo-"+s.id.slice(0,12)+".mid","audio/midi");action.textContent="MIDI checksum verified."}catch{action.textContent="MIDI verification failed.";}}),button("Harvest",async()=>{try{await midiBytes(s);if(saved.some(x=>x.id===s.id)){action.textContent="Already harvested.";return}if(saved.length>=128){action.textContent="Export and remove seeds before harvesting more.";return}save([...saved,s]);}catch{action.textContent="Seed verification failed.";}}));
  const details=document.createElement("details"),summary=document.createElement("summary"),code=document.createElement("code");summary.textContent="Source and proposal receipt";code.textContent="Source sample: "+s.source_sample_id+" | Receipt: "+s.id;details.append(summary,code);card.append(title,notes,credit,controls,details);box.append(card);}
  const target=location.hash.slice(1);if(/^[a-f0-9]{64}$/.test(target))document.getElementById(target)?.scrollIntoView();
 }
 let requestVersion=0;
 async function fetchJSON(path){const result=await fetch(ROOT+path,{cache:"no-store",credentials:"omit",signal:AbortSignal.timeout(10000)});if(result.status===404)return null;if(!result.ok)throw Error("Archive unavailable");const raw=await result.text();if(raw.length>5000000)throw Error("Archive exceeds bound");return JSON.parse(raw);}
 async function load(value){if(!validDay(value)){status.textContent="Choose a valid UTC date.";return}const req=++requestVersion;day.value=value;status.textContent="Opening harvest…";try{const data=await fetchJSON("days/"+value+".json");if(req!==requestVersion)return;const seeds=data?readDay(data,value):[];render(seeds);status.textContent=seeds.length?seeds.length+" original musical proposals · "+value+" UTC":"No archived proposals for "+value+" UTC.";}catch{if(req===requestVersion)status.textContent="Archive unavailable; previous displayed seeds are historical.";}}
 async function latest(){try{const i=await fetchJSON("index.json");if(i?.schema==="humkin.echo-orchard/index/v1"&&validDay(i.latest_day))await load(i.latest_day);else if(!i||i.latest_day===null){render([]);status.textContent="No musical proposals have been received yet.";}else throw Error("Invalid index");}catch{status.textContent="Archive unavailable.";}}
 el("load").addEventListener("click",()=>void load(day.value));el("latest").addEventListener("click",()=>void latest());el("stop").addEventListener("click",()=>{version++;stop()});el("export").addEventListener("click",()=>{if(!saved.length){action.textContent="Harvest at least one seed first.";return}download(JSON.stringify(harvestBundle(saved),null,2),"humkin-echo-harvest.json","application/json");});
 renderBasket();const requested=new URLSearchParams(location.search).get("day");day.value=new Date().toISOString().slice(0,10);if(validDay(requested))void load(requested);else void latest();
}
if(typeof document!=="undefined")mount();
