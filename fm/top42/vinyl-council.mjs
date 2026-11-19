/**
 * HUMKIN VINYL COUNCIL — deterministic monthly nominations from distinct
 * evidence streams. NO manufacturing or public record release actions.
 *
 * Existing HUMKIN:
 *  - Top 42: qualifying RADIO and PLAYLIST plays, separate counters.
 *  - Listener Weather: one self-reported feeling / song / device key / week.
 *  - Record League: six-track daily EP, twelve-track weekly album.
 *  - Guild events: not a chart vote; only an independently reviewed event
 *    packet can supply future limited nomination credit.
 */
export const SNAPSHOT_SCHEMA="humkin.monthly-feedback-snapshot/v1";
export const VINYL_SCHEMA="humkin.vinyl-nomination/v1";
const MONTH=/^\d{4}-(0[1-9]|1[0-2])$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const FEELINGS=new Set(["hope","tears","seen","laugh","move","stayed"]);
const MAX=20000;
export const DEFAULT_WEIGHTS=Object.freeze({chart:70,feedback:20,events:10});

export function chicagoMonth(date=new Date()){
 const p=Object.fromEntries(new Intl.DateTimeFormat("en-US",{
   timeZone:"America/Chicago",year:"numeric",month:"2-digit"
 }).formatToParts(date).map(x=>[x.type,x.value]));
 return p.year+"-"+p.month;
}
function int(value,max=100000000){
 const n=Number(value);
 return Number.isSafeInteger(n)&&n>=0&&n<=max?n:null;
}
function validMonth(value){return typeof value==="string"&&MONTH.test(value)}
function trackSet(snapshot){
 const tracks=Array.isArray(snapshot.catalog)?snapshot.catalog:[];
 if(tracks.length>MAX)throw Error("CATALOG_TOO_LARGE");
 const map=new Map();
 for(const t of tracks){
   if(!t||typeof t.id!=="string"||t.id.length>100||map.has(t.id))
     throw Error("BAD_OR_DUPLICATE_CATALOG_ID");
   map.set(t.id,t);
 }
 return map;
}
function countByTrack(rows,field){
 const map=new Map();
 for(const row of rows||[]){
   const id=String(row.id||row.track_id||"");
   if(!id)continue;
   if(map.has(id))throw Error("DUPLICATE_"+field.toUpperCase()+"_SUMMARY");
   map.set(id,row);
 }
 return map;
}
function auditedEvents(snapshot){
 const result=new Map(),used=new Set();
 if(snapshot.event_feed_status!=="owner_verified")return result;
 for(const event of snapshot.events||[]){
   // Only use a well-formed, reviewed, linked real-world event candidate.
   // An owner-pasted packet is still a provisional input and never gives
   // on-air chart votes, wallet credit or physical manufacturing rights.
   if(event?.reviewed!==true||typeof event.event_id!=="string"||
      !/^[a-z0-9-]{6,100}$/.test(event.event_id)||
      typeof event.record_id!=="string"||!UUID.test(event.record_id)||
      typeof event.proof_ref!=="string"||!event.proof_ref.trim())continue;
   if(used.has(event.event_id))throw Error("DUPLICATE_EVENT_ID");
   used.add(event.event_id);
   result.set(event.record_id,Math.min(10,(result.get(event.record_id)||0)+1));
 }
 return result;
}
function validatedRecord(record,catalog,month){
 if(!record||!UUID.test(record.id||"")||
    !["ep","album"].includes(record.kind)||
    typeof record.issue_key!=="string"||!record.issue_key.startsWith(month+"-")||
    !Array.isArray(record.tracks||record.track_ids))return null;
 const ids=record.tracks||record.track_ids;
 const ep=record.kind==="ep",total=ep?6:12,released=ep?2:4;
 if(ids.length!==total||new Set(ids).size!==ids.length)return null;
 const members=ids.map(id=>catalog.get(id));
 if(members.some(t=>!t||t.approved===false||t.enabled===false||
    t.published===false||t.kind==="bumper"))return null;
 // League's existing radio-only vs released edition rule is preserved.
 if(members.filter(t=>t.featured===true).length!==released)return null;
 return {id:record.id,kind:record.kind,format:ep?"EP":"LP",
   title:String(record.title||"Untitled").slice(0,160),
   curator:String(record.curator||"Anonymous curator").slice(0,120),
   issue_key:record.issue_key,
   tracks:ids,members};
}
function scoresFor(record,plays,weather,events){
 let chart=0,radio=0,playlist=0,feeling=0,move=0;
 for(const id of record.tracks){
   const p=plays.get(id)||{};
   const r=int(p.radio??p.radio_plays??0),l=int(p.playlist??p.playlist_plays??0);
   if(r===null||l===null)throw Error("BAD_PLAY_COUNTER");
   radio+=r;playlist+=l;chart+=r+l;
   const w=weather.get(id)||{},emotions=w.feelings||{};
   for(const [kind,count] of Object.entries(emotions)){
     if(!FEELINGS.has(kind)||int(count)===null)throw Error("BAD_FEEDBACK_COUNTER");
     // Bound the influence of a single recording's self-reported response.
     feeling+=Math.min(5,count);
     if(kind==="move")move+=count;
   }
 }
 return {chart,radio,playlist,feeling,move,verified_events:events.get(record.id)||0};
}
function ranks(records){
 const maxima={
   chart:Math.max(1,...records.map(x=>x.evidence.chart)),
   feedback:Math.max(1,...records.map(x=>x.evidence.feeling)),
   events:Math.max(1,...records.map(x=>x.evidence.verified_events))
 };
 return records.map(row=>{
   const s=row.evidence;
   const score=100*(DEFAULT_WEIGHTS.chart*s.chart/maxima.chart+
     DEFAULT_WEIGHTS.feedback*s.feeling/maxima.feedback+
     DEFAULT_WEIGHTS.events*s.verified_events/maxima.events)/100;
   return {...row,score:Math.round(score*1000)/1000,
     factors:{chart:Math.round(1000*s.chart/maxima.chart)/1000,
       feedback:Math.round(1000*s.feeling/maxima.feedback)/1000,
       events:Math.round(1000*s.verified_events/maxima.events)/1000}};
 }).sort((a,b)=>b.score-a.score||b.evidence.chart-a.evidence.chart||
   a.issue_key.localeCompare(b.issue_key)||a.id.localeCompare(b.id));
}
export function monthlyCouncil(snapshot){
 if(snapshot?.schema!==SNAPSHOT_SCHEMA||!validMonth(snapshot.month))
   throw Error("BAD_MONTHLY_SNAPSHOT");
 for(const f of ["catalog","plays","weather","records"])
   if(!Array.isArray(snapshot[f])||snapshot[f].length>MAX)
     throw Error("BAD_MONTHLY_"+f.toUpperCase());
 const catalog=trackSet(snapshot);
 const plays=countByTrack(snapshot.plays,"plays");
 const weather=countByTrack(snapshot.weather,"weather");
 const events=auditedEvents(snapshot);
 const records=[];
 const seenRecords=new Set();
 for(const item of snapshot.records){
   const r=validatedRecord(item,catalog,snapshot.month);
   if(!r)continue;
   if(seenRecords.has(r.id))throw Error("DUPLICATE_RECORD");
   seenRecords.add(r.id);
   const evidence=scoresFor(r,plays,weather,events);
   // Chart support is required; one person's reaction cannot win a record
   // by itself. No count here is copied into Top 42 official plays.
   if(evidence.chart<=0)continue;
   const {members,...safe}=r;
   records.push({...safe,evidence});
 }
 const lp=ranks(records.filter(r=>r.format==="LP"));
 const ep=ranks(records.filter(r=>r.format==="EP"));
 const finalizable=snapshot.complete===true&&snapshot.truncated!==true&&
   snapshot.closed===true&&snapshot.month<chicagoMonth();
 return {schema:"humkin.vinyl-council/v1",month:snapshot.month,
   state:finalizable?"NOMINATION_SLATE_REVIEW_REQUIRED":"PROVISIONAL_INCOMPLETE",
   rules:{
     ep:"six-track daily EP: four radio-only plus two released",
     lp:"twelve-track weekly album: eight radio-only plus four released",
     chart:"qualifying RADIO and PLAYLIST listens are counted separately",
     feedback:"one provisional current feeling per song/anonymous device key/station week",
     weights:DEFAULT_WEIGHTS,
     participation:"Only a separately reviewed, proof-linked event feed can add at most 10 percent",
     rights:"Physical manufacture is never authorized by chart results"
   },
   completeness:{closed:snapshot.closed===true,complete:snapshot.complete===true,
     truncated:snapshot.truncated===true,
     event_feed_status:snapshot.event_feed_status||"not_connected"},
   ep:{leader:ep[0]||null,nominees:ep.slice(0,42)},
   lp:{leader:lp[0]||null,nominees:lp.slice(0,42)}};
}
export function vinylNominationPacket(council,kind,catalogRows=[]){
 const lane=kind==="ep"?"ep":kind==="lp"?"lp":null;
 if(!lane||council?.schema!=="humkin.vinyl-council/v1")throw Error("BAD_VINYL_PACKET");
 const record=council[lane]?.leader;if(!record)return null;
 const map=new Map(catalogRows.map(t=>[t.id,t]));
 const tracks=record.tracks.map(id=>{
   const t=map.get(id)||{};
   return {id,title:String(t.title||id).slice(0,160),
     artist:String(t.artist||"Credit unverified").slice(0,160),
     duration_seconds:int(t.duration_seconds??t.duration,14400),
     master_sha256:null,rights_for_physical:"NOT_VERIFIED",
     artwork_rights:"NOT_VERIFIED"};
 });
 return {schema:VINYL_SCHEMA,source:"HUMKIN monthly Top 42/record league",
   proposed_for:"lemonPRESS physical preflight, NOT its proof format",
   source_month:council.month,format:record.format,
   state:"HOLD_NOT_MANUFACTURABLE",nomination_state:council.state,
   digital_record_id:record.id,record_title:record.title,
   curator:record.curator,score:record.score,
   evidence:record.evidence,
   sides:{A:tracks.slice(0,Math.ceil(tracks.length/2)),
     B:tracks.slice(Math.ceil(tracks.length/2))},
   gating:{
     rights_and_suno_entitlements:"UNVERIFIED",
     all_artists_and_master_owners_consented:false,
     source_masters_verified:false,vinyl_side_timing_checked:false,
     artwork_and_label_proofs:false,manufacturer_quote:false,
     artist_copies_and_fulfillment:false,house_admission:false,
     owner_physical_approval:false,pressing_ordered:false},
   note:"NOMINATION != RELEASE. PLAY != PERMISSION. Chart winner != authorized manufacturing."};
}
