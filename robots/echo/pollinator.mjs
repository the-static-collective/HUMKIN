/* Local bounded compositional search. No source pitch inference or publication.
 * Interval displacement adapted from Haunted Phonography mutation.mjs; paired
 * rhythm/harmony scoring is new, explicitly heuristic. */
const mod=n=>(n%12+12)%12;
const consonance=[4,-4,-1,2,3,1,-4,4,2,3,-1,-3];
const offsets=[0,-2,2,-5,5,-7,7,-12,12];
const valid=p=>Array.isArray(p?.pitches)&&p.pitches.length===4&&p.pitches.every(n=>Number.isInteger(n)&&n>=36&&n<=84)&&Array.isArray(p.durations_quarter)&&p.durations_quarter.length===4&&p.durations_quarter.every(n=>[.5,.75,1].includes(n))&&Number.isInteger(p.tempo_bpm)&&p.tempo_bpm>=76&&p.tempo_bpm<=116;
const idOK=s=>typeof s?.id==="string"&&/^[a-f0-9]{64}$/.test(s.id)&&valid(s.proposal);
const starts=p=>{let t=0;return p.durations_quarter.map(d=>{const start=t;t+=d;return start})};
export function scorePair(a,b,shift=0){
 if(!valid(a)||!valid(b)||!offsets.includes(shift)||b.pitches.some(n=>n+shift<36||n+shift>84))throw Error("Invalid pair");
 const as=starts(a),bs=starts(b);let overlap=0,total=0,clashes=0;
 for(let i=0;i<4;i++)for(let j=0;j<4;j++){
  const duration=Math.max(0,Math.min(as[i]+a.durations_quarter[i],bs[j]+b.durations_quarter[j])-Math.max(as[i],bs[j]));
  if(!duration)continue;
  const value=consonance[mod(b.pitches[j]+shift-a.pitches[i])];
  overlap+=duration;total+=duration*value;if(value<=-3)clashes+=duration;
 }
 const tempoDistance=Math.abs(a.tempo_bpm-b.tempo_bpm);
 const contour=a.pitches.slice(1).reduce((sum,n,i)=>sum+(Math.sign(n-a.pitches[i])===Math.sign(b.pitches[i+1]-b.pitches[i])?1:0),0);
 const harmony=overlap?total/overlap:0;
 const score=Math.round((harmony*10-clashes/Math.max(overlap,.25)*12-tempoDistance*.35+contour*2-Math.abs(shift)*.5)*100)/100;
 return {score,shift,harmony:Math.round(harmony*100)/100,clash_fraction:Math.round(clashes/Math.max(overlap,.25)*100)/100,tempo_distance:tempoDistance,contour_matches:contour,overlap_quarters:overlap};
}
export function findPairs(seeds,limit=12){
 const unique=new Map();for(const s of seeds.slice(0,128))if(idOK(s)&&!unique.has(s.id))unique.set(s.id,s);
 const sorted=[...unique.values()].sort((a,b)=>a.id.localeCompare(b.id));const result=[];
 for(let i=0;i<sorted.length;i++)for(let j=i+1;j<sorted.length;j++){
  const a=sorted[i],b=sorted[j];let best=null;
  for(const shift of offsets){if(b.proposal.pitches.some(n=>n+shift<36||n+shift>84))continue;const s=scorePair(a.proposal,b.proposal,shift);if(!best||s.score>best.score)best=s;}
  result.push({a:a.id,b:b.id,...best});
 }
 return result.sort((a,b)=>b.score-a.score||a.a.localeCompare(b.a)||a.b.localeCompare(b.b)).slice(0,Math.max(0,Math.min(12,Number.isInteger(limit)?limit:12)));
}
export function buildCross(a,b,pair,mode="duet"){
 if(!idOK(a)||!idOK(b)||a.id===b.id||pair.a!==a.id||pair.b!==b.id||!["duet","call-response","graft"].includes(mode))throw Error("Invalid cross");
 const evidence=scorePair(a.proposal,b.proposal,pair.shift);
 const events=[];let tick=0;const add=(note,duration,channel)=>{events.push({tick,durationTicks:Math.round(duration*480),note,velocity:channel?66:82,channel});};
 const ap=a.proposal,bp=b.proposal;
 if(mode==="duet"){
  for(let i=0;i<4;i++){add(ap.pitches[i],ap.durations_quarter[i],0);tick+=ap.durations_quarter[i]*480;}
  tick=0;for(let i=0;i<4;i++){add(bp.pitches[i]+pair.shift,bp.durations_quarter[i],1);tick+=bp.durations_quarter[i]*480;}
 }else if(mode==="call-response"){
  for(const [p,shift,channel] of [[ap,0,0],[bp,pair.shift,1]])for(let i=0;i<4;i++){add(p.pitches[i]+shift,p.durations_quarter[i],channel);tick+=p.durations_quarter[i]*480;}
 }else{
  for(let i=0;i<4;i++){const p=i%2?bp:ap;add(p.pitches[i]+(i%2?pair.shift:0),p.durations_quarter[i],0);tick+=p.durations_quarter[i]*480;}
 }
 return {schema:"humkin.echo-orchard.cross/v1",state:"draft_for_owner_review",broadcast_authority:false,parents:[a.id,b.id],law:"interval-displacement-and-composition/v1",mode,analysis:evidence,performance:{ppq:480,tempoBpm:Math.round((ap.tempo_bpm+bp.tempo_bpm)/2),events}};
}
// Adapted SMF0 projection from the pinned native MIDI exporter: typed bytes
// rather than Node Buffer, same event ordering and 480 PPQ.
const vlq=n=>{const out=[n&127];while((n>>=7)>0)out.unshift((n&127)|128);return out};
const u32=n=>[n>>>24&255,n>>>16&255,n>>>8&255,n&255];
export function crossMidi(cross){
 const p=cross?.performance;if(cross?.state!=="draft_for_owner_review"||cross.broadcast_authority!==false||p?.ppq!==480||!Number.isInteger(p.tempoBpm)||p.tempoBpm<76||p.tempoBpm>116||!Array.isArray(p.events)||p.events.length<4||p.events.length>8)throw Error("Invalid performance");
 const tempo=Math.round(60000000/p.tempoBpm),timeline=[{tick:0,priority:0,bytes:[255,81,3,tempo>>16&255,tempo>>8&255,tempo&255]}];
 for(const e of p.events){
  if(!Number.isInteger(e.tick)||e.tick<0||e.tick>3840||!Number.isInteger(e.durationTicks)||e.durationTicks<240||e.durationTicks>480||!Number.isInteger(e.note)||e.note<36||e.note>84||![0,1].includes(e.channel)||!Number.isInteger(e.velocity)||e.velocity<1||e.velocity>127)throw Error("Invalid event");
  timeline.push({tick:e.tick,priority:2,bytes:[144|e.channel,e.note,e.velocity]},{tick:e.tick+e.durationTicks,priority:1,bytes:[128|e.channel,e.note,0]});
 }
 timeline.sort((a,b)=>a.tick-b.tick||a.priority-b.priority);let prev=0;const track=[];
 for(const e of timeline){track.push(...vlq(e.tick-prev),...e.bytes);prev=e.tick;}
 track.push(0,255,47,0);return Uint8Array.from([77,84,104,100,0,0,0,6,0,0,0,1,1,224,77,84,114,107,...u32(track.length),...track]);
}
export async function crossReceipt(cross){
 const canonical=v=>v===null||typeof v!=="object"?JSON.stringify(v):Array.isArray(v)?"["+v.map(canonical).join(",")+"]":"{"+Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+canonical(v[k])).join(",")+"}";
 const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),x=>x.toString(16).padStart(2,"0")).join("");
 const midi=crossMidi(cross),body={...cross,midi_sha256:await hash(midi)};
 return {...body,id:await hash(new TextEncoder().encode(canonical(body)))};
}
