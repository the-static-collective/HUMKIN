/* Pure owner-reviewed feature draft contract. No audio upload, no auto-air. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HHMM=/^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export function availableRecordings(rows){
 return (Array.isArray(rows)?rows:[]).filter(row=>
   row && UUID.test(String(row.id||"")) && row.enabled===true &&
   Boolean(row.published_at) && ["song","bumper"].includes(row.kind) &&
   Number(row.duration_seconds)>0);
}

export function minutes(value){
 if(typeof value!=="string"||!HHMM.test(value))throw Error("Choose a valid Central time.");
 const [h,m]=value.split(":").map(Number);
 return h*60+m;
}

export function buildPausedFeature({name,days,start,end,trackIds},approved,ownerId){
 const label=String(name||"").trim();
 if(!label||label.length>100)throw Error("Give the feature a name (up to 100 characters).");
 if(!UUID.test(String(ownerId||"")))throw Error("Sign in as the station owner.");
 if(!Array.isArray(trackIds)||trackIds.length<1||trackIds.length>200)
   throw Error("Choose between 1 and 200 approved recordings.");
 if(!Array.isArray(days)||days.length<1||days.length>7||
    days.some(d=>!Number.isInteger(d)||d<0||d>6)||
    new Set(days).size!==days.length)throw Error("Choose the days for this recurring block.");
 const startMinute=minutes(start),endMinute=minutes(end);
 if(startMinute>=endMinute)throw Error("The block must end after it starts on the same day.");
 const library=new Set(availableRecordings(approved).map(r=>r.id));
 if(trackIds.some(id=>!library.has(id)))
   throw Error("An item is hidden, unpublished or unavailable. Refresh the crate.");
 return {
  owner_id:ownerId,name:label,days:[...days].sort((a,b)=>a-b),
  start_minute:startMinute,end_minute:endMinute,
  track_ids:trackIds.map(id=>"crate-"+id),is_active:false,priority:0
 };
}

export function move(sequence,index,direction){
 const items=sequence.slice(),target=index+direction;
 if(!Number.isInteger(index)||![-1,1].includes(direction)||index<0||
    target<0||target>=items.length)return items;
 [items[index],items[target]]=[items[target],items[index]];
 return items;
}
