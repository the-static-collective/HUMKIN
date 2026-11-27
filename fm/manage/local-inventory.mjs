// Read-only comparison of local transmitter inventory with the loaded web catalog.
const ID=/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,159}$/;
const FREQ=/^[a-z0-9][a-z0-9-]{0,39}$/;
const SHA=/^[a-f0-9]{64}$/;
export function compareInventory(packet,catalog){
 if(packet?.schema!=="humkin.tower.local-inventory/v1"||!FREQ.test(packet.frequency||"")||
 !Number.isFinite(Date.parse(packet.observed_at))||!Array.isArray(packet.records)||packet.records.length>20000||!Array.isArray(catalog))throw Error("Invalid local inventory");
 const exact=new Map(),byHash=new Map(),seen=new Set();
 for(const row of catalog){
  if(typeof row.id==="string"){if(!exact.has(row.id))exact.set(row.id,[]);exact.get(row.id).push(row);}
  if(SHA.test(row.sha256||"")){if(!byHash.has(row.sha256))byHash.set(row.sha256,[]);byHash.get(row.sha256).push(row);}
 }
 const rows=packet.records.map(row=>{
  if(!row||typeof row.id!=="string"||!ID.test(row.id)||seen.has(row.id))throw Error("Invalid or duplicate local recording ID");
  seen.add(row.id);
  let matches=exact.get(row.id)||[],basis="stable-id";
  if(!matches.length&&row.id.startsWith("upload-")&&SHA.test(row.id.slice(7))){matches=byHash.get(row.id.slice(7))||[];basis="exact-source-sha256";}
  return {id:row.id,title:String(row.title||"").slice(0,240),status:matches.length===1?"matched":matches.length>1?"ambiguous":"not-in-loaded-catalog",basis:matches.length?basis:null,web_ids:matches.map(r=>r.id),local:{held:row.held===true,disabled:row.disabled===true,rotation:row.rotation===true,in_lineup:row.in_lineup===true,weight:Number.isInteger(row.weight)?row.weight:null}};
 });
 return {frequency:packet.frequency,observed_at:packet.observed_at,preview:packet.preview===true,counts:{total:rows.length,matched:rows.filter(r=>r.status==="matched").length,ambiguous:rows.filter(r=>r.status==="ambiguous").length,not_in_loaded_catalog:rows.filter(r=>r.status==="not-in-loaded-catalog").length},rows};
}
