/**
 * HUMKIN LONG WAVE — Cloudflare Workers + R2 live MP3 connection.
 * Source metadata comes only from the public, owner-approved Supabase crate
 * and the owner-reviewed R2 manifest. R2 binding never exposes credentials.
 *
 * Deploy with separate R2 bindings: RADIO_MEDIA to the permanent music
 * archive and RADIO_LIVE to the short-lived public HLS relay bucket.
 * The `/live.mp3` response stays one continuous HTTP audio stream; no
 * listener-side JS transition is required between songs or station carts.
 */
import {isHlsPath,serveHls} from './hls-routes.mjs';
const SUPABASE="https://kbhqacsdvjsstzyplqij.supabase.co";
const PUBLIC_KEY="sb_publishable_Bv9JuOctSQTmnE3O1dP8RA_MKRNSD-o";
const PUBLIC_MANIFEST="https://humkin.abundent.org/fm/r2-tracks.json";
const PUBLIC_ROTATION="https://humkin.abundent.org/fm/rotation.json";
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
     duration:secs,kind,featured:row.is_single===true});
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
       duration:seconds,kind:"song",featured:row.seasonal===true,seasonal:row.seasonal===true});
   }
 }
 return approved;
}
async function queryPublicCatalog(fetcher){
 const query="?select=id,title,kind,enabled,published_at,duration_seconds,is_single,storage_provider,r2_object_key"+
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
 // Honor the browser station's owner-reviewed editorial holds. Do not air
 // scheduled-only openers or outdated time/request announcements as ambient IDs.
 try{
   const policyResponse=await fetcher(PUBLIC_ROTATION,{cache:"no-store"});
   if(policyResponse.ok){
     const rotation=await policyResponse.json();
     const profiles=rotation?.bumper_brain?.profiles||{};
     for(const track of tracks){
       if(track.kind!=="bumper")continue;
       const profile=profiles[track.id]||{};
       const normalized=track.title.toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
       track.hold=profile.hold===true||profile.role==="show_opener"||
         /\b(opener|opening|intro for|top of the hour|bottom of the hour|requests we re taking)\b/.test(normalized);
     }
   }
 }catch{/* Fail closed for likely clock and announcement claims below. */}
 return tracks;
}
export async function getCatalog(fetcher=fetch,now=Date.now()){
 if(cached&&now<cacheUntil)return cached;
 if(!loading)loading=queryPublicCatalog(fetcher).then(list=>{
   cached=list;cacheUntil=Date.now()+TTL_MS;return list;
 }).finally(()=>{loading=null});
 try{return await loading}catch(error){
   // An existing working stream should not fail because metadata briefly went offline.
   if(cached)return cached;
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
/** A per-listener continuous radio rotation. No clock-sync promises. */
export function program(tracks,seed){
 const random=prng(seed);
 const songs=tracks.filter(t=>t.kind==="song");
 const carts=tracks.filter(t=>t.kind==="bumper"&&!t.hold&&t.duration<=180&&
   !/\b(opener|opening|intro for|top of the hour|bottom of the hour|requests we re taking)\b/
     .test(t.title.toLowerCase().replace(/[^a-z0-9]+/g," ").trim()));
 if(!songs.length)return [];
 const slots=[];
 for(const song of songs){slots.push(song);
   if(song.featured)slots.push(song); // Publicly marked singles/seasonal cuts get additional spins.
   if(song.seasonal)slots.push(song); // Seasonal = 3 total, not +3.
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
 return out;
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
 const seed=Number.isInteger(options.seed)?options.seed:(crypto.getRandomValues(new Uint32Array(1))[0]>>>0);
 function nextTrack(){
   if(index>=rotation.length){rotation=program(tracks,(seed+cycle*7919)>>>0);cycle++;index=0;}
   return rotation[index++];
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
           const track=nextTrack();
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
   // Route before checking the independent bucket bindings. A missing music
   // binding must never shadow a working HLS relay or turn unknown paths into 503.
   if(isHlsPath(path))return serveHls(request,env);
   if(path.startsWith("/hls/"))return json({ok:false,error:"NOT_FOUND"},404);
   if(!env?.RADIO_MEDIA?.get)return json({ok:false,error:"R2_BINDING_MISSING",expected:"RADIO_MEDIA"},503);
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