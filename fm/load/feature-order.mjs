/* Draft-only drag contract. Slots are insertion boundaries in the pre-move order. */
export function editOrder(ids,drag,slot,{station,revision,eligible,limit=200}){
 if(!Array.isArray(ids)||!drag||drag.station!==station||drag.revision!==revision||!Number.isInteger(slot)||slot<0||slot>ids.length)throw Error("Draft changed. Start the drag again.");
 const out=ids.slice();
 if(drag.kind==="catalog"){
  if(out.length>=limit)throw Error("Maximum "+limit+" positions.");
  if(!eligible.has(drag.id))throw Error("Recording no longer eligible. Refresh the crate.");
  out.splice(slot,0,drag.id);
 }else if(drag.kind==="order"){
  if(!Number.isInteger(drag.index)||drag.index<0||drag.index>=out.length||out[drag.index]!==drag.id)throw Error("Draft position changed. Start again.");
  out.splice(drag.index,1);out.splice(slot-(slot>drag.index?1:0),0,drag.id);
 }else throw Error("Unsupported drag.");
 return out;
}
export function projectCues(ids,lookup){
 let elapsed=0,known=true;
 return ids.map(id=>{
  const row=lookup.get(id),n=Number(row?.duration_seconds),duration=Number.isFinite(n)&&n>0?n:null;
  const cue={id,offset:known?elapsed:null,duration};
  if(duration===null)known=false;else elapsed+=duration;
  return cue;
 });
}
export function formatOffset(seconds){
 if(seconds===null)return "—";
 const n=Math.floor(seconds);
 return [Math.floor(n/3600),Math.floor(n/60)%60,n%60].map(x=>String(x).padStart(2,"0")).join(":");
}
