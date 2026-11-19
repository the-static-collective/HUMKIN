import {getStation,resolveStation,describeStations,STATIONS} from "./stations.mjs";
import {resolveContract,describeContractStations,contractReceipt} from "./contracts.mjs";
/**
 * HUMKIN LONG WAVE — Cloudflare Workers + R2 live MP3 connection.
 * Source metadata comes only from the public, owner-approved Supabase crate
 * and the owner-reviewed R2 manifest. R2 binding never exposes credentials.
 *
 * Deploy with an R2 binding named RADIO_MEDIA to humkin-radio-media.
 * The `/live.mp3` response stays one continuous HTTP audio stream; no
 * listener-side JS transition is required between songs or station carts.
 */
const SUPABASE="https://kbhqacsdvjsstzyplqij.supabase.co";
const PUBLIC_KEY="sb_publishable_Bv9JuOctSQTmnE3O1dP8RA_MKRNSD-o";
const PUBLIC_MANIFEST="https://humkin.abundent.org/fm/r2-tracks.json";
const PUBLIC_SETTINGS=SUPABASE+"/rest/v1/humkin_radio_settings?select=bumper_groups,bumper_rules&id=eq.main&limit=1";
const MAINLINE_PROGRAMS=SUPABASE+"/rest/v1/humkin_radio_programs?select=id,name,days,start_minute,end_minute,priority,track_ids,is_active&is_active=eq.true&limit=500";
const UUID="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const R2_KEY=new RegExp("^tracks/"+UUID+"/[0-9a-f]{64}\\.mp3$","i");
const MAX_TRACKS=1500;
const TTL_MS=5*60*1000;
const ORIGIN='*'; // Read-only approved radio, no credentials, cookies, or private data.
let cached=null,cacheUntil=0,loading=null;

function validManualKey(key){
 if(typeof key!=="string" || key.length<8||key.length>400||!key.startsWith("tracks/")||!/\.mp3$/i.test(key))return false;
 const parts=key.split("/");
 return parts.length>=2&&parts.length<=8&&parts.every(part=>
   part&&part!=="."&&part!==".."&&!/[\\?#\x00-\x1f\x7f]/.test(part));
}
export function approvedCatalog(rows,manual){
 const approved=[],seen=new Set();
 for(const row of Array.isArray(rows)?rows.slice(0,MAX_TRACKS):[]){
   if(row?.storage_provider!=="r2"||row.enabled!==true||!row.published_at)continue;
   const key=String(row.r2_object_key||"");
   const id=String(row.id||"");
   const secs=Number(row.duration_seconds);
   if(!R2_KEY.test(key)||!key.startsWith("tracks/"+id+"/")||!(secs>0&&secs<14400)||seen.has(key))continue;
   const kind=row.kind==="bumper"?"bumper":"song";
   seen.add(key);
   approved.push({id:"crate-"+id,key,title:String(row.title||"HUMKIN").slice(0,160),
     artist:String(row.artist||"HUMKIN").slice(0,160),
     album:String(row.album||"HUMKIN RADIO").slice(0,200),
     tags:[],duration:secs,kind,featured:row.is_single===true});
 }
 if(manual?.schema==="humkin.radio.r2/v1"&&Array.isArray(manual.tracks)){
   for(const row of manual.tracks.slice(0,MAX_TRACKS)){
     if(row?.approved!==true||!validManualKey(row.object_key))continue;
     const seconds=Number(row.duration_seconds);
     if(!(seconds>0&&seconds<14400)||seen.has(row.object_key))continue;
     const id=String(row.id||"");
     if(!/^[a-z0-9][a-z0-9-]{2,79}$/.test(id))continue;
     seen.add(row.object_key);
     approved.push({id:"r2-"+id,key:row.object_key,title:String(row.title||"HUMKIN").slice(0,160),
       artist:String(row.artist||"HUMKIN").slice(0,160),
       album:String(row.album||"HUMKIN RADIO").slice(0,200),
       tags:Array.isArray(row.tags)?row.tags.filter(x=>typeof x==="string"&&x.length<50).slice(0,20):[],
       duration:seconds,kind:"song",featured:row.seasonal===true,seasonal:row.seasonal===true});
   }
 }
 return approved;
}
async function queryPublicCatalog(fetcher){
 const query="?select=id,title,artist,album,kind,enabled,published_at,duration_seconds,is_single,storage_provider,r2_object_key"+
   "&published_at=not.is.null&enabled=eq.true&storage_provider=eq.r2&limit=1500";
 const response=await fetcher(SUPABASE+"/rest/v1/humkin_radio_tracks"+query,
  {headers:{apikey:PUBLIC_KEY,Accept:"application/json"},cache:"no-store"});
 if(!response.ok)throw Error("Public station catalog unavailable: "+response.status);
 const cloud=await response.json();
 let manual=null;
 try{
   const other=await fetcher(PUBLIC_MANIFEST,{cache:"no-store"});
   if(other.ok)manual=await other.json();
 }catch{/* Approved Supabase crate alone is sufficient to stay on air. */}
 const tracks=approvedCatalog(cloud,manual);
 if(!tracks.some(t=>t.kind==="song"))throw Error("No approved music in R2");
 // Active owner-defined grouping/rules are public read-only programming
 // metadata. Failure to load optional settings does NOT invent restrictions.
 tracks.bumper_groups=[];tracks.bumper_rules=[];tracks.mainline_programs=[];
 try{
   const response=await fetcher(PUBLIC_SETTINGS,
     {headers:{apikey:PUBLIC_KEY,Accept:"application/json"},cache:"no-store"});
   if(response.ok){
     const rows=await response.json(),settings=Array.isArray(rows)?rows[0]||{}:{};
     tracks.bumper_groups=Array.isArray(settings.bumper_groups)?settings.bumper_groups:[];
     tracks.bumper_rules=Array.isArray(settings.bumper_rules)?settings.bumper_rules:[];
   }
 }catch{/* No owner groups/rules means the unmodified original art plays. */}
 // Approved, published Mainline *plans*, not proof of actual playout.
 try{
   const response=await fetcher(MAINLINE_PROGRAMS,
     {headers:{apikey:PUBLIC_KEY,Accept:"application/json"},cache:"no-store"});
   if(response.ok){
     const rows=await response.json();
     tracks.mainline_programs=(Array.isArray(rows)?rows:[]).filter(r=>
       r?.is_active===true&&Array.isArray(r.days)&&Array.isArray(r.track_ids))
       .slice(0,500).map(r=>({
         id:String(r.id||""),name:String(r.name||"Mainline").slice(0,160),
         days:r.days.filter(x=>Number.isInteger(x)&&x>=0&&x<=6),
         start_minute:Number(r.start_minute),end_minute:Number(r.end_minute),
         priority:Number(r.priority)||0,track_ids:r.track_ids.slice(0,1500),
         enabled:true
       }));
   }
 }catch{/* Continue with the approved catalog baseline if Mainline plans are unreachable. */}
 return tracks;
}
export async function getCatalog(fetcher=fetch,now=Date.now(),allowStale=true){
 if(cached&&now<cacheUntil)return cached;
 if(!loading)loading=queryPublicCatalog(fetcher).then(list=>{
   cached=list;cacheUntil=Date.now()+TTL_MS;return list;
 }).finally(()=>{loading=null});
 try{return await loading}catch(error){
   // An existing working stream should not fail because metadata briefly went offline.
   if(cached&&allowStale)return cached;
   throw error;
 }
}
function prng(seed){
 let x=seed>>>0;
 return ()=>{x=(x+0x6d2b79f5)>>>0;let t=x;
  t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);
  return ((t^(t>>>14))>>>0)/4294967296;
 };
}
function shuffled(items,random){
 const out=items.slice();
 for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]]}
 return out;
}
// Continuous stream evaluates opt-in scheduling restrictions on each break.
function allowedBumper(item,rawRules,at=new Date()){
 const rules=Array.isArray(rawRules)?rawRules:[];
 for(const r of rules.slice(0,60)){
  if(!r||r.enabled!==true||!Array.isArray(r.track_ids)||!r.track_ids.includes(item.id))continue;
  if(r.kind==="hold")return false;
  if(r.kind==="daypart"||r.kind==="date"){
   const parts=Object.fromEntries(new Intl.DateTimeFormat("en-US",{
    timeZone:"America/Chicago",weekday:"short",year:"numeric",month:"2-digit",day:"2-digit",
    hour:"2-digit",minute:"2-digit",hourCycle:"h23"
   }).formatToParts(at).map(p=>[p.type,p.value]));
   const minute=Number(parts.hour)*60+Number(parts.minute);
   const day=["SUN","MON","TUE","WED","THU","FRI","SAT"].indexOf(String(parts.weekday).toUpperCase());
   const date=parts.year+"-"+parts.month+"-"+parts.day;
   if(r.kind==="daypart"&&(!Array.isArray(r.days)||!r.days.includes(day)||
     !(minute>=r.start_minute&&minute<r.end_minute)))return false;
   if(r.kind==="date"&&(!r.start_date||!r.end_date||date<r.start_date||date>r.end_date))return false;
  }
 }
 return true;
}
function arrangeBumperGroups(order,rawGroups,carts){
 const active=(Array.isArray(rawGroups)?rawGroups:[]).slice(0,60).filter(g=>
  g&&g.enabled===true&&["attract","repel"].includes(g.kind)&&
  Array.isArray(g.track_ids)&&new Set(g.track_ids).size>1);
 if(!active.length)return order;
 const bp=order.map((t,i)=>t.kind==="bumper"?{i,track:t,lane:t.duration<=19?"short":t.duration<60?"medium":"long"}:null).filter(Boolean);
 const size={short:carts.filter(x=>x.duration<=19).length,
  medium:carts.filter(x=>x.duration>19&&x.duration<60).length,
  long:carts.filter(x=>x.duration>=60).length};
 const counters={short:0,medium:0,long:0};
 bp.forEach(x=>x.ordinal=counters[x.lane]++);
 const sameBag=(a,b)=>a.lane===b.lane&&size[a.lane]>1&&
  Math.floor(a.ordinal/size[a.lane])===Math.floor(b.ordinal/size[b.lane]);
 const swap=(a,b)=>{const x=a.track;a.track=b.track;b.track=x};
 for(let i=0;i<bp.length;i++){
  for(const g of active){
   if(g.kind!=="attract"||!g.track_ids.includes(bp[i].track.id))continue;
   const source=bp.findIndex((x,j)=>j>i&&x.track.id!==bp[i].track.id&&g.track_ids.includes(x.track.id));
   if(source<0||source-i<=3)continue;
   const target=bp.findIndex((x,j)=>j>i&&j<=i+3&&sameBag(bp[source],x));
   if(target>=0)swap(bp[source],bp[target]);
  }
 }
 for(let i=1;i<bp.length;i++){
  const recent=bp.slice(Math.max(0,i-3),i).map(x=>x.track.id);
  const conflicts=active.some(g=>g.kind==="repel"&&g.track_ids.includes(bp[i].track.id)&&
   recent.some(id=>g.track_ids.includes(id)));
  if(!conflicts)continue;
  for(let j=i+1;j<bp.length;j++){
   if(!sameBag(bp[i],bp[j]))continue;
   if(active.some(g=>g.kind==="repel"&&g.track_ids.includes(bp[j].track.id)&&
      recent.some(id=>g.track_ids.includes(id))))continue;
   swap(bp[i],bp[j]);break;
  }
 }
 const adjusted=order.slice();for(const x of bp)adjusted[x.i]=x.track;
 return adjusted;
}
/** A per-listener continuous radio rotation. No clock-sync promises. */
export function program(tracks,seed){
 const random=prng(seed);
 const songs=tracks.filter(t=>t.kind==="song");
 const carts=tracks.filter(t=>t.kind==="bumper"&&t.duration<=180&&
   !(Array.isArray(tracks.bumper_rules)&&tracks.bumper_rules.some(r=>
     r?.enabled===true&&r.kind==="hold"&&r.track_ids?.includes(t.id))));
 if(!songs.length)return [];
 const slots=[];
 for(const song of songs){
   // Explicit contract weights override the legacy single/seasonal bonus.
   // Ordinary Long Wave has no rotation_weight and keeps its old rules.
   const repeats=Number.isInteger(song.rotation_weight)?
     Math.max(1,Math.min(5,song.rotation_weight)):
     1+Number(song.featured===true)+Number(song.seasonal===true);
   for(let n=0;n<repeats;n++)slots.push(song);
 }
 const music=shuffled(slots,random);
 const buckets={short:shuffled(carts.filter(t=>t.duration<=19),random),
   medium:shuffled(carts.filter(t=>t.duration>19&&t.duration<60),random),
   long:shuffled(carts.filter(t=>t.duration>=60),random)};
 const cursor={short:0,medium:0,long:0};
 function pick(lane){
   const arr=buckets[lane];if(!arr.length)return null;
   if(cursor[lane]>=arr.length){
     const oldLast=arr[arr.length-1]?.id;
     buckets[lane]=shuffled(arr,random);
     if(buckets[lane].length>1&&buckets[lane][0].id===oldLast){
       [buckets[lane][0],buckets[lane][1]]=[buckets[lane][1],buckets[lane][0]];
     }
     cursor[lane]=0;
   }
   return buckets[lane][cursor[lane]++];
 }
 const out=[],PHI=(1+Math.sqrt(5))/2;
 let elapsed=0,nextMedium=690,nextLong=1350,pulse=0;
 let nextShort=1+Math.floor(((++pulse)*PHI%1)*4);
 for(let i=0;i<music.length;i++){
   const song=music[i];out.push(song);elapsed+=song.duration;
   let choice=null;
   if(elapsed>=nextLong){choice=pick("long");nextLong+=1350;nextMedium=Math.max(nextMedium,elapsed+690)}
   else if(elapsed>=nextMedium){choice=pick("medium");nextMedium+=690;}
   else if(i+1>=nextShort){choice=pick("short");}
   if(i+1>=nextShort)nextShort+=(1+Math.floor(((++pulse)*PHI%1)*4));
   if(choice){out.push(choice);elapsed+=choice.duration}
 }
 return arrangeBumperGroups(out,tracks.bumper_groups,carts);
}
/**
 * Strip an ID3v2 header from each MP3 before joining it to the live byte stream.
 * Independent MP3 files often include a tag before their first MPEG frame;
 * leaving tags in the middle of a live stream makes some decoders lose sync.
 * This keeps audio frames untouched and never loads the whole recording.
 */
export function stripInitialID3(body){
 const upstream=body.getReader();
 let tested=false,skip=0,buffer=new Uint8Array(0);
 return new ReadableStream({
   async pull(out){
     try{
       while(true){
         const {done,value}=await upstream.read();
         if(done){if(!tested&&buffer.length)out.enqueue(buffer);out.close();return;}
         let chunk=value;
         if(!tested){
           // A stream may split the ten-byte ID3 header across reads.
           const prefix=new Uint8Array(buffer.length+chunk.length);
           prefix.set(buffer);prefix.set(chunk,buffer.length);
           if(prefix.length<10){buffer=prefix;continue;}
           buffer=new Uint8Array(0);chunk=prefix;tested=true;
           if(prefix[0]===73&&prefix[1]===68&&prefix[2]===51){ // ID3
             const size=(prefix[6]<<21)|(prefix[7]<<14)|(prefix[8]<<7)|prefix[9];
             skip=10+size+((prefix[5]&0x10)?10:0);
             if(skip>4*1024*1024)throw Error("Excessive MP3 metadata header");
           }
         }
         if(skip){const n=Math.min(skip,chunk.length);skip-=n;chunk=chunk.subarray(n);}
         if(chunk.length){out.enqueue(chunk);return;}
       }
     }catch(error){out.error(error)}
   },
   async cancel(reason){try{await upstream.cancel(reason)}catch{}}
 },{highWaterMark:1});
}

/**
 * Stream R2 audio objects without buffering full songs in Worker memory.
 * One connection remains open through natural track boundaries. HTML audio
 * does not need JS event handlers at each song boundary, even screen-off.
 * Approx. 1000 internal R2 calls/request are available on Workers Free;
 * cap at 900 objects to leave headroom, then end cleanly.
 */
export function continuousStream(bucket,tracks,options={}){
 const maxObjects=Math.min(900,Math.max(2,Number(options.maxObjects)||900));
 let counter=0,cycle=0,rotation=[],index=0,reader=null,closed=false,errors=0;
 let currentTracks=tracks,activeProgramKey=null;
 const seed=Number.isInteger(options.seed)?options.seed:(crypto.getRandomValues(new Uint32Array(1))[0]>>>0);
 async function nextTrack(){
   // A virtual station changes programs at the next track boundary without
   // any transmitter or long-lived scheduler. Legacy Long Wave is unchanged.
   while(true){
     if(typeof options.resolveTracks==="function"){
       const selection=await options.resolveTracks(new Date());
       if(!selection?.tracks?.some(t=>t.kind==="song"))return null;
       if(selection.key!==activeProgramKey){
         activeProgramKey=selection.key;currentTracks=selection.tracks;
         rotation=[];index=0;cycle=0;
       }
     }
     if(index>=rotation.length){
       rotation=program(currentTracks,(seed+cycle*7919)>>>0);cycle++;index=0;
       if(!rotation.length)return null;
     }
     const chosen=rotation[index++];
     if(chosen.kind!=="bumper"||allowedBumper(chosen,currentTracks.bumper_rules||[],new Date()))
       return chosen;
   }
 }
 return new ReadableStream({
   async pull(controller){
     if(closed)return;
     try{
       // Each pull sends at most one binary chunk; HTTP backpressure controls
       // buffering instead of a browser-side timer or per-track play() call.
       while(!closed){
         if(!reader){
           if(counter>=maxObjects){closed=true;controller.close();return;}
           const track=await nextTrack();
           if(!track){closed=true;controller.close();return;}
           counter++;
           const object=await bucket.get(track.key);
           if(!object?.body){
             if(++errors>6){closed=true;controller.error(Error("On-air catalog objects unavailable"));return;}
             continue;
           }
           errors=0;
           reader=stripInitialID3(object.body).getReader();
         }
         const value=await reader.read();
         if(value.done){reader.releaseLock();reader=null;continue;}
         if(value.value?.byteLength){controller.enqueue(value.value);return;}
       }
     }catch(error){closed=true;controller.error(error)}
   },
   async cancel(reason){closed=true;if(reader){try{await reader.cancel(reason)}catch{}}}
 },{highWaterMark:1});
}
function basicHeaders(){return {
 "Access-Control-Allow-Origin":ORIGIN,
 "Access-Control-Allow-Methods":"GET,HEAD,OPTIONS",
 "Cache-Control":"no-store, no-transform",
 "X-Content-Type-Options":"nosniff",
 "Cross-Origin-Resource-Policy":"cross-origin"
}}
function json(payload,status=200){return new Response(JSON.stringify(payload),{
 status,headers:{...basicHeaders(),"Content-Type":"application/json; charset=utf-8"}})}
export default {
 async fetch(request,env){
   const path=new URL(request.url).pathname;
   if(request.method==="OPTIONS")return new Response(null,{status:204,headers:basicHeaders()});
   if(request.method!=="GET"&&request.method!=="HEAD")return json({ok:false,error:"METHOD_NOT_ALLOWED"},405);
   if(!env?.RADIO_MEDIA?.get)return json({ok:false,error:"R2_BINDING_MISSING",expected:"RADIO_MEDIA"},503);
   if(path==="/stations"){
     try{
       const list=await getCatalog(fetch,Date.now(),false);
       if(request.method==="HEAD")return new Response(null,{headers:{...basicHeaders(),"Content-Type":"application/json"}});
       return json({ok:true,timezone:"America/Chicago",transport:"on_demand_continuous_mp3",
         synchronized:false,station_contracts:"versioned_counterpoint_v1",
         mainline_source:list.mainline_programs?.length?
           "published_programs":"approved_catalog_baseline",
         stations:describeContractStations(list,new Date(),STATIONS)});
     }catch{return json({ok:false,error:"CATALOG_UNAVAILABLE"},503)}
   }
   const stationMatch=path.match(/^\/stations\/([a-z0-9-]+)\/(health|contract|live\.mp3)$/);
   if(stationMatch){
     const station=getStation(stationMatch[1]);
     if(!station)return json({ok:false,error:"STATION_NOT_FOUND"},404);
     if(station.enabled!==true)return json({ok:false,error:"STATION_NOT_ENABLED"},404);
     if(station.mode==="live")return json({ok:false,error:"LIVE_TRANSMITTER_NOT_CONFIGURED"},503);
     let list;
     try{list=await getCatalog(fetch,Date.now(),false)}
     catch{return json({ok:false,error:"CATALOG_UNAVAILABLE"},503)}
     let selected;
     try{selected=resolveContract(station,list,new Date(),STATIONS)}
     catch{return json({ok:false,error:"CONTRACT_INVALID"},503)}
     if(stationMatch[2]==="contract")return json({ok:true,receipt:contractReceipt(selected)});
     const ready=Boolean(selected?.tracks?.some(t=>t.kind==="song"));
     if(stationMatch[2]==="health")return json({ok:ready,station:station.id,mode:station.mode,
       program:selected?.program_name||null,approved_tracks:selected?.tracks?.filter(t=>t.kind==="song").length||0,
       synchronized:false,stream:"/stations/"+station.id+"/live.mp3",
       contract:contractReceipt(selected)},ready?200:503);
     if(!ready)return json({ok:false,error:"STATION_UNPROGRAMMED",station:station.id},503);
     const headers={...basicHeaders(),"Content-Type":"audio/mpeg",
       "icy-name":station.name,"X-HUMKIN-Station":station.id,
       "X-HUMKIN-Stream":"virtual-continuous","X-HUMKIN-Synchronized":"false"};
     if(request.method==="HEAD")return new Response(null,{status:200,headers});
     return new Response(continuousStream(env.RADIO_MEDIA,list,{
       resolveTracks:async()=>{
         // Refresh at the next natural recording boundary. Cache keeps this
         // inexpensive; expired approval metadata failures stop new tracks.
         const current=await getCatalog(fetch,Date.now(),false);
         return resolveContract(station,current,new Date(),STATIONS);
       }
     }),{status:200,headers});
   }
   if(path==="/health"){
     try{const list=await getCatalog();return json({ok:true,service:"HUMKIN LONG WAVE",r2_catalog:list.length,
       stream:"/live.mp3",mode:"personal_continuous_mp3",source:"Cloudflare R2"});}
     catch(error){return json({ok:false,error:"CATALOG_UNAVAILABLE"},503)}
   }
   if(path!=="/live.mp3"&&path!=="/")return json({ok:false,error:"NOT_FOUND"},404);
   const headers={...basicHeaders(),"Content-Type":"audio/mpeg",
     "icy-name":"HUMKIN LONG WAVE","icy-description":"Human music and field recordings",
     "X-HUMKIN-Stream":"continuous"};
   if(request.method==="HEAD")return new Response(null,{status:200,headers});
   let list;
   try{list=await getCatalog()}
   catch{return json({ok:false,error:"CATALOG_UNAVAILABLE"},503)}
   return new Response(continuousStream(env.RADIO_MEDIA,list),{status:200,headers});
 }
};