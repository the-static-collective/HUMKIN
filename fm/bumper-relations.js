/* HUMKIN RADIO — owner-directed relationships, never inferred from styles.
 * ATTRACT: move approved related recordings nearer if the fair lane bag allows.
 * REPEL: separate alternate cuts from the same recording when possible.
 * Day/time/date rules are opt-in; Same-Time keeps time-dependent rules off
 * to preserve its shared clock. No artistic category can disable a cart.
 */
(function(root){"use strict";
const ZONE="America/Chicago";
const days=["SUN","MON","TUE","WED","THU","FRI","SAT"];
function validGroups(value){
 if(!Array.isArray(value))return [];
 return value.slice(0,60).filter(g=>g&&g.enabled===true&&
  ["attract","repel"].includes(g.kind)&&Array.isArray(g.track_ids)&&
  new Set(g.track_ids.filter(x=>typeof x==="string")).size>=2)
  .map(g=>({...g,track_ids:[...new Set(g.track_ids)].filter(x=>typeof x==="string").slice(0,100)}));
}
function validRules(value){
 if(!Array.isArray(value))return [];
 return value.slice(0,60).filter(r=>r&&r.enabled===true&&
  ["hold","daypart","date"].includes(r.kind)&&Array.isArray(r.track_ids))
  .map(r=>({...r,track_ids:r.track_ids.filter(id=>typeof id==="string").slice(0,100)}));
}
function centralParts(when){
 const fmt=new Intl.DateTimeFormat("en-US",{timeZone:ZONE,
  year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",
  minute:"2-digit",hourCycle:"h23",weekday:"short"});
 const p=Object.fromEntries(fmt.formatToParts(when).map(x=>[x.type,x.value]));
 return {day:days.indexOf(String(p.weekday||"").toUpperCase()),
  minute:Number(p.hour)*60+Number(p.minute),
  date:p.year+"-"+p.month+"-"+p.day};
}
function permitted(id,rawRules,at=new Date(),mode="stream"){
 for(const r of validRules(rawRules)){
  if(!r.track_ids.includes(id))continue;
  if(r.kind==="hold")return false;
  if(mode==="clock")continue; // A dynamic exclusion would break fixed-cycle math.
  const p=centralParts(at instanceof Date?at:new Date(at));
  if(r.kind==="daypart"){
   if(!Array.isArray(r.days)||!r.days.includes(p.day)||
      !Number.isInteger(r.start_minute)||!Number.isInteger(r.end_minute)||
      p.minute<r.start_minute||p.minute>=r.end_minute)return false;
  }else if(r.kind==="date"){
   if(!/^\d{4}-\d\d-\d\d$/.test(r.start_date||"")||
      !/^\d{4}-\d\d-\d\d$/.test(r.end_date||"")||
      p.date<r.start_date||p.date>r.end_date)return false;
  }
 }
 return true;
}
const fields=["index","id","title","seconds","role","family","rare"];
function swapDetails(items,a,b){
 if(a===b)return;
 for(const key of fields)
  [items[a][key],items[b][key]]=[items[b][key],items[a][key]];
}
function arrange(breaks,rawGroups,bagSizes,near=3){
 const groups=validGroups(rawGroups);
 if(!groups.length||!Array.isArray(breaks)||breaks.length<2)return breaks;
 const lanes={short:[],medium:[],long:[]},pos=new Map();
 for(let i=0;i<breaks.length;i++){
  const lane=breaks[i].lane;
  if(!lanes[lane])continue;
  pos.set(i,{lane,ordinal:lanes[lane].length});
  lanes[lane].push(i);
 }
 const sameBag=(a,b)=>{
  const pa=pos.get(a),pb=pos.get(b);
  const size=bagSizes[pa?.lane]||0;
  return Boolean(size&&pa&&pb&&pa.lane===pb.lane&&
    Math.floor(pa.ordinal/size)===Math.floor(pb.ordinal/size));
 };
 // Attraction is voluntary proximity, not contiguous compulsory programming.
 for(let i=0;i<breaks.length-1;i++){
  for(const g of groups.filter(g=>g.kind==="attract"&&g.track_ids.includes(breaks[i].id))){
   const peers=new Set(g.track_ids.filter(id=>id!==breaks[i].id));
   let source=-1;
   for(let j=i+1;j<breaks.length;j++){
    if(peers.has(breaks[j].id)){source=j;break}
   }
   if(source<0||source-i<=near)continue;
   for(let target=i+1;target<=Math.min(breaks.length-1,i+near);target++){
    if(sameBag(source,target)){
     swapDetails(breaks,source,target);break;
    }
   }
  }
 }
 // Repulsion has priority over attraction when the same cart is in both.
 for(let i=1;i<breaks.length;i++){
  const conflicts=groups.filter(g=>g.kind==="repel"&&g.track_ids.includes(breaks[i].id)
    &&breaks.slice(Math.max(0,i-near),i).some(b=>g.track_ids.includes(b.id)));
  if(!conflicts.length)continue;
  const recent=breaks.slice(Math.max(0,i-near),i).map(b=>b.id);
  for(let j=i+1;j<breaks.length;j++){
   if(!sameBag(i,j))continue;
   const candidate=breaks[j];
   if(groups.some(g=>g.kind==="repel"&&g.track_ids.includes(candidate.id)
       &&recent.some(id=>g.track_ids.includes(id))))continue;
   swapDetails(breaks,i,j);break;
  }
 }
 return breaks;
}
const api=Object.freeze({validGroups,validRules,centralParts,permitted,arrange});
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.HUMKIN_BUMPER_RELATIONS=api;
})(typeof window!=="undefined"?window:globalThis);
