// Read-only signed Door Registry 012 -> HUMKIN static recipient door manifest.
// Usage: node tools/receptacle/export-jubilee.mjs --registry ./private/registry.json
//   --pin ./private/steward-public.pem --approval humkin-publication-001
//   --door humkin-cashapp-001 --confirm-recipient HUMKIN --out ./support-doors.json
// The --pin file is an independently obtained, trusted steward public key.
import {createHash,createPublicKey,verify} from "node:crypto";
import {readFileSync,writeFileSync} from "node:fs";
import {pathToFileURL} from "node:url";
import {safeLink,parseReceptacle} from "../../support-logic.mjs";

const DOMAIN="JUBILEE-DOOR-REGISTRY-012\n";
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;
const assert=(ok,message)=>{if(!ok)throw Error("RECEPTACLE_HOLD: "+message);};
export function canonical(value){
  if(value===null||typeof value==="string"||typeof value==="boolean")return JSON.stringify(value);
  if(typeof value==="number"&&Number.isFinite(value))return JSON.stringify(value);
  if(Array.isArray(value))return "["+value.map(canonical).join(",")+"]";
  assert(value&&typeof value==="object"&&Object.getPrototypeOf(value)===Object.prototype,"non-portable JSON");
  return "{"+Object.keys(value).sort().map(k=>JSON.stringify(k)+":"+canonical(value[k])).join(",")+"}";
}
const digest=value=>createHash("sha256").update(canonical(value)).digest("hex");
const exact=(item,keys)=>item&&typeof item==="object"&&!Array.isArray(item)&&
  Object.keys(item).sort().join("|")===keys.slice().sort().join("|");
export function inspectSignedRegistry(registry,pinnedKey){
  assert(exact(registry,["schema","stewardPublicKey","events"])&&
    registry.schema==="jubilee.door-registry/v0.1"&&Array.isArray(registry.events)&&
    registry.events.length<=100000,"incompatible signed registry");
  const publicKey=createPublicKey(pinnedKey).export({type:"spki",format:"pem"});
  assert(registry.stewardPublicKey===publicKey,"steward key differs from independent pin");
  const entries=new Map();
  let previous=null;
  for(const [i,event] of registry.events.entries()){
    assert(exact(event,["seq","type","payload","previous","createdAt","signature"])&&
      event.seq===i+1&&event.previous===previous&&typeof event.createdAt==="string"&&
      Number.isFinite(Date.parse(event.createdAt))&&
      new Date(event.createdAt).toISOString()===event.createdAt,"invalid event ordering or timestamp");
    const {signature,...unsigned}=event;
    assert(typeof signature==="string"&&signature.length<=128,"malformed event signature");
    let valid=false;
    try{
      const bytes=Buffer.from(signature,"base64");
      valid=bytes.length===64&&bytes.toString("base64")===signature&&
        verify(null,Buffer.from(DOMAIN+canonical(unsigned)),publicKey,bytes);
    }catch{}
    assert(valid,"invalid registry event signature");
    if(event.type==="OPEN"){
      const door=event.payload;
      assert(exact(door,["id","kind","purposeId","termsRef","publicationRef","target"])&&
        [door.id,door.purposeId,door.termsRef,door.publicationRef].every(s=>typeof s==="string"&&ID.test(s))&&
        !entries.has(door.id),"duplicate or invalid signed door");
      entries.set(door.id,{...door,withdrawn:false});
    }else if(event.type==="WITHDRAW"){
      assert(exact(event.payload,["doorId","evidenceRef"])&&
        typeof event.payload.doorId==="string"&&ID.test(event.payload.doorId)&&
        typeof event.payload.evidenceRef==="string"&&ID.test(event.payload.evidenceRef),"invalid withdrawal");
      const door=entries.get(event.payload.doorId);
      assert(door&&!door.withdrawn,"invalid withdrawal target");
      door.withdrawn=true;
    }else throw Error("RECEPTACLE_HOLD: unsupported event");
    previous=digest(event);
  }
  return {head:previous,entries};
}
export function prepareManifest(registry,pinnedKey,{approvedDoorIds,ownerApprovalRef,confirmedRecipient}={}){
  assert(confirmedRecipient==="HUMKIN","recipient identity must be manually confirmed");
  assert(typeof ownerApprovalRef==="string"&&ID.test(ownerApprovalRef),"explicit owner publication reference required");
  assert(Array.isArray(approvedDoorIds)&&approvedDoorIds.length>0&&approvedDoorIds.length<=12&&
    new Set(approvedDoorIds).size===approvedDoorIds.length,"explicit unique door allowlist required");
  const {head,entries}=inspectSignedRegistry(registry,pinnedKey);
  const doors=approvedDoorIds.map(id=>{
    const door=entries.get(id);
    assert(door&&!door.withdrawn,"requested door not currently open");
    assert(door.kind==="payment_link"&&
      door.purposeId==="purpose-humkin-listener-support-001"&&
      door.publicationRef===ownerApprovalRef,"door purpose or authorization mismatch");
    assert(exact(door.target,["provider","url"]),"invalid payment target");
    safeLink(door.target.provider,door.target.url);
    return {id:door.id,provider:door.target.provider,url:door.target.url};
  });
  const manifest={schema:"humkin.receptacle/v0.1",mode:"live",recipient:"HUMKIN",
    purposeId:"purpose-humkin-listener-support-001",ownerApproved:true,
    ownerApprovalRef,sourceHead:head,doors};
  parseReceptacle(manifest);
  return manifest;
}
function parseArgs(args){
  const result={approvedDoorIds:[]};
  for(let i=0;i<args.length;i++){
    const key=args[i],v=args[++i];
    assert(key.startsWith("--")&&typeof v==="string"&&!v.startsWith("--"),"options require values");
    if(key==="--door")result.approvedDoorIds.push(v);
    else if(key==="--registry")result.registryPath=v;
    else if(key==="--pin")result.pinPath=v;
    else if(key==="--approval")result.ownerApprovalRef=v;
    else if(key==="--confirm-recipient")result.confirmedRecipient=v;
    else if(key==="--out")result.outPath=v;
    else throw Error("RECEPTACLE_HOLD: unknown option "+key);
  }
  assert(result.registryPath&&result.pinPath&&result.outPath,"registry, independent pin and output required");
  return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const options=parseArgs(process.argv.slice(2));
    const registry=JSON.parse(readFileSync(options.registryPath,"utf8"));
    const key=readFileSync(options.pinPath,"utf8");
    const manifest=prepareManifest(registry,key,options);
    writeFileSync(options.outPath,JSON.stringify(manifest,null,2)+"\n",{flag:"w",mode:0o644});
    process.stdout.write("Verified "+manifest.doors.length+" signed door(s). Published MANIFEST ONLY; no payment verified.\n");
  }catch(error){console.error(error.message);process.exitCode=1;}
}
