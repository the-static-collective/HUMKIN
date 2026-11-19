/**
 * HUMKIN COUNTERPOINT — deterministic station-contract graph.
 *
 * No chain, cryptocurrency, ML claims or unattended publication. This
 * module projects approved catalog + Mainline's *planned* program into
 * relative rotation preferences. An absent play ledger is NOT invented.
 */
import {resolveStation} from "./stations.mjs";

export const CONTRACT_SCHEMA="humkin.radio.station-contract/v1";
export const MAINLINE_ID="mainline";
export const RELATIONSHIPS=Object.freeze(["echo","counterpoint","inverse","independent"]);
const ID=/^[a-z0-9][a-z0-9-]{1,39}$/;
const MAX_NODES=100;
const MAX_DEPTH=32;

function ordered(obj){
  if(Array.isArray(obj))return obj.map(ordered);
  if(obj&&typeof obj==="object")return Object.fromEntries(
    Object.keys(obj).sort().map(k=>[k,ordered(obj[k])]));
  return obj;
}
export function stableStringify(value){return JSON.stringify(ordered(value))}
export function fingerprint(value){
  // Stable non-cryptographic cache identifier. NOT a signature or blockchain hash.
  const input=stableStringify(value);
  let h=2166136261;
  for(let i=0;i<input.length;i++){
    h=Math.imul(h^input.charCodeAt(i),16777619)>>>0;
  }
  return h.toString(16).padStart(8,"0");
}
function normalizedRelationship(station){
  const relation=station?.relationship||{kind:"independent",influence:0};
  return {kind:relation.kind,influence:relation.influence};
}
export function validateContractGraph(stations){
  if(!Array.isArray(stations)||stations.length>MAX_NODES)throw Error("CONTRACT_COUNT_INVALID");
  const graph=new Map();
  for(const station of stations){
    if(!station||!ID.test(station.id||"")||station.id===MAINLINE_ID||graph.has(station.id))
      throw Error("CONTRACT_ID_INVALID_OR_DUPLICATE");
    if(station.contract_version!==undefined&&station.contract_version!==1)
      throw Error("CONTRACT_VERSION_UNSUPPORTED:"+station.id);
    if(station.revision!==undefined&&(!Number.isSafeInteger(station.revision)||station.revision<1))
      throw Error("CONTRACT_REVISION_INVALID:"+station.id);
    if(!["personal","virtual","live"].includes(station.mode))
      throw Error("CONTRACT_MODE_INVALID:"+station.id);
    const r=normalizedRelationship(station);
    if(!RELATIONSHIPS.includes(r.kind)||!Number.isInteger(r.influence)||
       r.influence<0||r.influence>100)
      throw Error("CONTRACT_RELATIONSHIP_INVALID:"+station.id);
    graph.set(station.id,station);
  }
  const finished=new Set(),visiting=new Set();
  function walk(id,depth){
    if(depth>MAX_DEPTH)throw Error("CONTRACT_DEPTH_EXCEEDED");
    if(id===MAINLINE_ID)return;
    if(visiting.has(id))throw Error("CONTRACT_CYCLE:"+id);
    if(finished.has(id))return;
    const node=graph.get(id);
    if(!node)throw Error("CONTRACT_PARENT_MISSING:"+id);
    visiting.add(id);
    const parent=node.parent_id||MAINLINE_ID;
    if(parent!==MAINLINE_ID&&!graph.has(parent))throw Error("CONTRACT_PARENT_MISSING:"+parent);
    walk(parent,depth+1);
    visiting.delete(id);finished.add(id);
  }
  for(const id of graph.keys())walk(id,0);
  return graph;
}
function clamp(value,min,max){return Math.max(min,Math.min(max,value))}
function baseWeight(track){
  return clamp(1+Number(track.featured===true)+Number(track.seasonal===true),1,5);
}
/**
 * Mainline is a reference projection, not a newly added broadcast station.
 * Program track IDs come from the existing published Supabase radio program
 * schedule. No raw "on air" events are assumed to exist.
 */
export function projectMainline(catalog,at=new Date()){
  const programs=Array.isArray(catalog.mainline_programs)?catalog.mainline_programs:[];
  const root={id:MAINLINE_ID,name:"HUMKIN MAINLINE · programming reference",
    enabled:true,mode:"virtual",filter:{kinds:["song"]},
    include_bumpers:false,programs};
  const out=resolveStation(root,catalog,at);
  return {...out,tracks:(out?.tracks||[]).map(t=>({...t,rotation_weight:baseWeight(t)})),
    lineage:[MAINLINE_ID],revision:1,
    program_source:programs.length?"published_mainline_schedule":"approved_catalog_baseline"};
}
function derivedWeight(child,parent,track){
  const r=normalizedRelationship(child),factor=r.influence/100;
  if(!factor||r.kind==="independent")return null;
  const p=parent.tracks.find(t=>t.key===track.key);
  const strength=p?clamp((p.rotation_weight||baseWeight(p))/5,0,1):0;
  const sign=r.kind==="echo"?1:-1;
  const intensity=r.kind==="counterpoint"?0.75:1;
  return clamp(Math.round(3+sign*(strength-0.5)*4*factor*intensity),1,5);
}
/**
 * Resolve a station through its ancestors. Descendants inherit the *signal*
 * (weighted preferences), never authorization or exclusive membership.
 * Their own filters select from approved catalog; parent programming only
 * changes relative weights. Every invalid graph fails closed.
 */
export function resolveContract(station,catalog,at=new Date(),stations=[station]){
  if(!station?.id||station.enabled!==true)return null;
  const graph=validateContractGraph(stations);
  if(!graph.has(station.id))throw Error("CONTRACT_NOT_REGISTERED");
  const memo=new Map();
  function visit(id){
    if(memo.has(id))return memo.get(id);
    if(id===MAINLINE_ID){
      const root=projectMainline(catalog,at);memo.set(id,root);return root;
    }
    const item=graph.get(id);
    if(item.enabled!==true)throw Error("CONTRACT_PARENT_DISABLED:"+id);
    if(item.mode==="live"&&id!==station.id)
      throw Error("CONTRACT_LIVE_PARENT_UNSUPPORTED:"+id);
    const parent=visit(item.parent_id||MAINLINE_ID);
    const base=resolveStation(item,catalog,at);
    if(!base)throw Error("CONTRACT_RESOLUTION_FAILED:"+id);
    const tracks=base.tracks.map(t=>{
      if(t.kind!=="song")return t;
      const weight=derivedWeight(item,parent,t);
      return weight===null?t:{...t,rotation_weight:weight};
    });
    tracks.bumper_groups=base.tracks.bumper_groups||[];
    tracks.bumper_rules=base.tracks.bumper_rules||[];
    const lineage=[...parent.lineage,id];
    const version=item.contract_version||1,revision=item.revision||1;
    const selection=tracks.filter(t=>t.kind==="song").map(t=>[
      t.key,t.rotation_weight||baseWeight(t)]);
    const key=fingerprint({station:id,version,revision,parent:parent.key||MAINLINE_ID,
      program:base.slot?.id||null,selection});
    const result={...base,tracks,key:id+":"+key,lineage,
      contract_version:version,revision,
      relationship:normalizedRelationship(item),
      parent_id:item.parent_id||MAINLINE_ID,
      program_source:parent.program_source||"derived",
      fingerprint:key};
    memo.set(id,result);
    return result;
  }
  return visit(station.id);
}
export function describeContractStations(catalog,at,stations){
  // Validate once, and fail the whole route if the revision introduces an
  // invalid graph. Individual disabled station definitions stay visible.
  validateContractGraph(stations);
  return stations.map(station=>{
    const resolved=station.enabled?resolveContract(station,catalog,at,stations):null;
    return {id:station.id,name:station.name,description:station.description,
      mode:station.mode,enabled:station.enabled,
      ready:Boolean(resolved?.tracks?.some(t=>t.kind==="song")),
      approved_tracks:resolved?.tracks?.filter(t=>t.kind==="song").length||0,
      program:resolved?.program_name||null,stream:station.enabled?
        "/stations/"+station.id+"/live.mp3":null,
      parent_id:station.parent_id||MAINLINE_ID,
      relationship:normalizedRelationship(station),
      contract_version:station.contract_version||1,
      revision:station.revision||1,
      fingerprint:resolved?.fingerprint||null,
      lineage:resolved?.lineage||null,
      program_source:resolved?.program_source||null};
  });
}
/** Read-only explanation/receipt; intentionally NOT persistent audit events. */
export function contractReceipt(resolved){
  if(!resolved)return null;
  return {schema:CONTRACT_SCHEMA,station_id:resolved.station.id,
    contract_version:resolved.contract_version,revision:resolved.revision,
    parent_id:resolved.parent_id,relationship:resolved.relationship,
    lineage:resolved.lineage,program:resolved.program_name,
    program_source:resolved.program_source,selection_fingerprint:resolved.fingerprint,
    selected_count:resolved.tracks.filter(t=>t.kind==="song").length,
    source:"approved_catalog_and_published_mainline_program",
    claim:"deterministic_selection_not_proof_of_actual_airplay"};
}
