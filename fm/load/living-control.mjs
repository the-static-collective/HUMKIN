/* TOWER 010 · owner-only mobile/desktop station controls.
 * Browser sends append-only intents through Supabase RLS; ONLY the protected
 * broadcaster can make an R2 schedule revision and issue an effective receipt.
 */
const OWNER="us@abundent.org";
const CLOUD="https://humkin-long-wave.joyvolcanomusic.workers.dev/autopilot/station-one/schedule";
const ACTIONS=[
 ["queue_next","QUEUE NEXT"],["queue_end","QUEUE AT END"],
 ["more","MORE OF THIS"],["less","LESS OF THIS"],
 ["hold","HOLD FROM ROTATION"],["release","RELEASE HOLD"]
];
const $=id=>document.getElementById(id);

export function controlReceipt(intent,cloud){
 const id=Number(intent?.id);
 if(!Number.isSafeInteger(id)||id<1)return "UNVERIFIED REQUEST";
 const status=cloud?.control;
 if(!status||!Number.isSafeInteger(status.effective_cursor)){
   return "REQUESTED · not confirmed by Cloud HOUSE";
 }
 if(status.effective_cursor>=id && cloud.on_air===true){
   return "EFFECTIVE CLOUD SCHEDULE · not individual playback proof";
 }
 if((status.pending_cursor??0)>=id||status.effective_cursor>=id){
   return "ACCEPTED · awaiting verified on-air boundary";
 }
 return "REQUESTED · waiting for cloud scheduler";
}

export function mountLivingControl({db,rows,onStatus,onMetadataSaved}){
 const root=$("living-control");
 if(!root)return;
 let busy=false,selected="",recent=[];
 const eligible=()=>rows().filter(r=>
   r.enabled===true&&r.published_at&&r.storage_provider==="r2"&&
   ["song","bumper"].includes(r.kind)&&
   (r.kind==="song"||Number(r.duration_seconds)<=180));
 function message(value){$("living-control-status").textContent=value;onStatus?.(value)}
 function choices(){
   const selector=$("living-track"),prior=selector.value;
   const term=$("living-search").value.trim().toLocaleLowerCase();
   const found=eligible().filter(r=>!term||
     [r.title,r.artist,r.album].some(x=>String(x||"").toLocaleLowerCase().includes(term)));
   selector.replaceChildren(new Option("Choose approved R2 recording…",""));
   for(const row of found.slice(0,150)){
     selector.add(new Option((row.kind==="bumper"?"CART · ":"SONG · ")+
       row.title+" — "+(row.artist||"HUMKIN"),row.id));
   }
   selector.value=found.some(r=>r.id===prior)?prior:"";
   selected=selector.value;
   $("living-catalog-count").textContent=found.length+" approved matching recordings"+
     (found.length>150?" · search to narrow":"");
   fillMetadata();
   controls();
 }
 function fillMetadata(){
   const row=eligible().find(r=>r.id===selected);
   $("living-edit-title").value=row?.title||"";
   $("living-edit-artist").value=row?.artist||"";
   $("living-edit-album").value=row?.album||"";
 }
 function controls(){
   const selectedRow=eligible().find(r=>r.id===selected);
   for(const action of ACTIONS){
     const button=$("living-"+action[0]);
     button.disabled=busy||!selectedRow||(selectedRow.kind==="bumper"&&["more","less"].includes(action[0]));
   }
   $("living-metadata-save").disabled=busy||!selectedRow;
   $("living-refresh").disabled=busy;
 }
 async function owner(){
   const {data,error}=await db.auth.getUser();
   const u=data?.user;
   if(error||!u||u.email?.toLowerCase()!==OWNER)
     throw Error("Sign in as the verified HUMKIN owner first.");
   return u;
 }
 async function submit(action){
   if(busy||!ACTIONS.some(x=>x[0]===action))return;
   const row=eligible().find(r=>r.id===selected);
   if(!row)return message("Choose an approved recording.");
   if(row.kind!=="song"&&["more","less"].includes(action))
     return message("Only songs have music rotation weights.");
   if(!confirm(ACTIONS.find(x=>x[0]===action)[1]+" · "+row.title+
     "? This records an OWNER REQUEST; it does not immediately interrupt the on-air song."))return;
   busy=true;controls();
   try{
     const user=await owner();
     const {data,error}=await db.from("humkin_tower_control_intents")
       .insert({owner_id:user.id,track_id:row.id,action})
       .select("id,track_id,action,requested_at").single();
     if(error||!data?.id)throw Error(error?.message||"Control request was not confirmed.");
     message("REQUEST #"+data.id+" RECORDED · "+row.title+
       ". The cloud scheduler must separately accept it and publish a safe-boundary revision.");
     await refreshReceipts();
   }catch(error){message("NOT REQUESTED: "+error.message)}
   finally{busy=false;controls()}
 }
 async function saveMetadata(){
   if(busy)return;
   const row=eligible().find(r=>r.id===selected);
   if(!row)return message("Choose an approved recording.");
   const next={
     title:$("living-edit-title").value.trim(),
     artist:$("living-edit-artist").value.trim(),
     album:$("living-edit-album").value.trim()
   };
   if(!next.title||next.title.length>160||!next.artist||next.artist.length>160||next.album.length>160)
     return message("Title and artist are required (160 characters max).");
   if(!confirm("Update approved metadata for "+row.title+"? Original audio bytes are unchanged."))return;
   busy=true;controls();
   try{
     const user=await owner();
     const {data,error}=await db.from("humkin_radio_tracks").update(next)
       .eq("id",row.id).eq("uploaded_by",user.id)
       .select("id,title,artist,album").single();
     if(error||data?.id!==row.id)throw Error(error?.message||"Metadata update not confirmed.");
     // Metadata is already stored in the owner-authenticated catalog.
     // Request a *separate* sooner cloud revision, never claim immediate air.
     const submitted=await db.from("humkin_tower_control_intents")
       .insert({owner_id:user.id,track_id:row.id,action:"metadata_refresh"})
       .select("id,track_id,action,requested_at").single();
     message(submitted.error
       ? "CATALOG SAVED · cloud quick-refresh request failed: "+submitted.error.message+
         ". Regular Cloud HOUSE catalog refresh may still pick it up."
       : "CATALOG SAVED · REQUEST #"+submitted.data.id+
         " for a future cloud metadata refresh. Original audio bytes unchanged.");
     try{await onMetadataSaved?.()}catch(error){message("Metadata saved; reload catalog: "+error.message)}
     await refreshReceipts();
   }catch(error){message("METADATA NOT SAVED: "+error.message)}
   finally{busy=false;controls()}
 }
 async function refreshReceipts(){
   const list=$("living-control-receipts");
   try{
     await owner();
     const {data,error}=await db.from("humkin_tower_control_intents")
       .select("id,track_id,action,requested_at")
       .order("id",{ascending:false}).limit(12);
     if(error)throw Error(error.message);
     recent=data||[];
     let cloud=null;
     try{
       const response=await fetch(CLOUD,{cache:"no-store"});
       if(response.ok)cloud=await response.json();
     }catch{ /* Fail closed: no schedule acceptance claimed. */ }
     list.replaceChildren();
     if(!recent.length)list.append(document.createElement("li")).textContent="No station-control requests yet.";
     for(const item of recent){
       const li=document.createElement("li");
       const label=ACTIONS.find(a=>a[0]===item.action)?.[1]||(item.action==="metadata_refresh"?"REFRESH TRACK INFO":item.action);
       const track=rows().find(r=>r.id===item.track_id);
       li.textContent="#"+item.id+" · "+label+" · "+(track?.title||"recording")+
         " — "+controlReceipt(item,cloud);
       list.append(li);
     }
   }catch(error){
     list.replaceChildren();
     const li=document.createElement("li");
     li.textContent="Sign in to inspect station control receipts ("+error.message+").";
     list.append(li);
   }
 }
 $("living-search").addEventListener("input",choices);
 $("living-track").addEventListener("change",event=>{selected=event.target.value;fillMetadata();controls()});
 for(const [action] of ACTIONS)$("living-"+action).addEventListener("click",()=>submit(action));
 $("living-metadata-save").addEventListener("click",saveMetadata);
 $("living-refresh").addEventListener("click",refreshReceipts);
 choices();refreshReceipts();
 return {refresh(){choices();refreshReceipts()}};
}
