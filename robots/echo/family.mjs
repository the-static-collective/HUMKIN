/* Local proposal genealogy. Every descendant is replayed from verified roots.
 * No automatic admission, ancestry inference or unconstrained evolutionary loop. */
import {findPairs,buildCross,crossReceipt} from "./pollinator.mjs";
export const MAX_NODES=128,MAX_GENERATION=8;
const ID=/^[a-f0-9]{64}$/;
const canonical=v=>v===null||typeof v!=="object"?JSON.stringify(v):Array.isArray(v)?"["+v.map(canonical).join(",")+"]":"{"+Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+canonical(v[k])).join(",")+"}";
const hash=async v=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(canonical(v)))),x=>x.toString(16).padStart(2,"0")).join("");
const same=(a,b)=>canonical(a)===canonical(b);
const uniq=a=>[...new Set(a)].sort();
const mutations=["none","up-2","down-2","rotate-rhythm"];
export const signature=p=>p.pitches.map(n=>n-p.pitches[0]).join(",")+"|"+p.durations_quarter.join(",");
export function rootNode(seed){if(!ID.test(seed?.id||""))throw Error("Invalid root");return {id:seed.id,kind:"root",generation:0,roots:[seed.id],ancestors:[],proposal:seed.proposal,track_title:seed.track_title||"Unidentified root",seed};}
export function eligible(a,b,allowRelated=false){
 if(!a||!b||a.id===b.id||Math.max(a.generation,b.generation)>=MAX_GENERATION||a.ancestors.includes(b.id)||b.ancestors.includes(a.id))return false;
 return allowRelated||!a.roots.some(x=>b.roots.includes(x));
}
export function familyPairs(nodes,allowRelated=false){
 const sorted=[...nodes].sort((a,b)=>a.id.localeCompare(b.id)),result=[];
 for(let i=0;i<sorted.length;i++)for(let j=i+1;j<sorted.length;j++){
  const a=sorted[i],b=sorted[j];if(!eligible(a,b,allowRelated))continue;
  const pair=findPairs([a,b],1)[0];if(!pair)continue;
  const shared=a.roots.filter(x=>b.roots.includes(x)).length;
  result.push({...pair,shared_roots:shared,diversity_score:Math.round((pair.score-15*shared)*100)/100});
 }
 // Limit repeated appearances of a parent in suggestions; do not invent eligibility.
 result.sort((a,b)=>b.diversity_score-a.diversity_score||a.a.localeCompare(b.a)||a.b.localeCompare(b.b));
 const counts=new Map(),out=[];
 for(const pair of result){if((counts.get(pair.a)||0)>=3||(counts.get(pair.b)||0)>=3)continue;out.push(pair);for(const id of [pair.a,pair.b])counts.set(id,(counts.get(id)||0)+1);if(out.length===12)break;}
 return out;
}
export async function makeChild(a,b,pair,mode,mutation="none",allowRelated=false){
 if(!eligible(a,b,allowRelated)||!mutations.includes(mutation))throw Error("Ineligible parents or mutation");
 const cross=await crossReceipt(buildCross(a,b,pair,mode));
 // Full performance is retained. Inheritable phrase is an explicit alternating
 // projection, not a claim that an eight-note duet was a four-note recording.
 const g=buildCross(a,b,pair,"graft").performance.events;
 let pitches=g.map(e=>e.note),durations=g.map(e=>e.durationTicks/480);
 if(mutation==="up-2"||mutation==="down-2"){
  const shift=mutation==="up-2"?2:-2;pitches=pitches.map(n=>n+shift);
  if(pitches.some(n=>n<36||n>84))throw Error("Mutation exceeds register");
 }
 if(mutation==="rotate-rhythm")durations=[...durations.slice(1),durations[0]];
 const proposal={pitches,durations_quarter:durations,tempo_bpm:cross.performance.tempoBpm};
 // Keep the performed crossing and inheritable phrase distinct. A mutation
 // changes the latter only; the original cross remains a replayable receipt.
 const body={schema:"humkin.echo-orchard.lineage/v1",kind:"child",state:"draft_for_owner_review",broadcast_authority:false,
 parents:[a.id,b.id],generation:1+Math.max(a.generation,b.generation),roots:uniq([...a.roots,...b.roots]),
 ancestors:uniq([a.id,b.id,...a.ancestors,...b.ancestors]),projection:"alternating-graft/v1",mutation,allow_related:allowRelated,
 proposal,cross};
 return {...body,id:await hash(body)};
}
export function admitChild(nodes,child){
 if(nodes.length>=MAX_NODES)throw Error("Family capacity reached; export before starting another family");
 if(nodes.some(n=>n.id===child.id))throw Error("Already cultivated");
 if(nodes.some(n=>signature(n.proposal)===signature(child.proposal)))throw Error("Equivalent interval/rhythm phrase already retained; try a different rhythm or parents");
 return [...nodes,child];
}
export function familyBundle(nodes){
 return {schema:"humkin.echo-orchard.family/v1",state:"draft_for_owner_review",broadcast_authority:false,nodes:nodes.map(n=>n.kind==="root"?{kind:"root",seed:n.seed}:n)};
}
export async function verifyFamily(bundle,verifyRoot){
 if(bundle?.schema!=="humkin.echo-orchard.family/v1"||bundle.state!=="draft_for_owner_review"||bundle.broadcast_authority!==false||!Array.isArray(bundle.nodes)||bundle.nodes.length>MAX_NODES)throw Error("Invalid family archive");
 let nodes=[];const byId=new Map();
 for(const item of bundle.nodes){
  let n;
  if(item?.kind==="root"){await verifyRoot(item.seed);n=rootNode(item.seed);}
  else if(item?.kind==="child"){
   if(!Array.isArray(item.parents)||item.parents.length!==2||typeof item.allow_related!=="boolean")throw Error("Invalid parents");
   const [a,b]=item.parents.map(id=>byId.get(id));if(!a||!b)throw Error("Missing or out-of-order parent");
   n=await makeChild(a,b,{a:a.id,b:b.id,shift:item.cross?.analysis?.shift},item.cross?.mode,item.mutation,item.allow_related);
   if(!same(n,item))throw Error("Lineage receipt or inherited phrase mismatch");
   nodes=admitChild(nodes,n);byId.set(n.id,n);continue;
  }else throw Error("Unknown lineage node");
  if(byId.has(n.id))throw Error("Duplicate root");
  nodes.push(n);byId.set(n.id,n);
 }
 return nodes;
}
export function germlinePerformance(n){
 const events=[];let tick=0;
 for(let i=0;i<4;i++){const durationTicks=n.proposal.durations_quarter[i]*480;events.push({tick,durationTicks,note:n.proposal.pitches[i],velocity:82,channel:0});tick+=durationTicks;}
 return {state:"draft_for_owner_review",broadcast_authority:false,performance:{ppq:480,tempoBpm:n.proposal.tempo_bpm,events}};
}
