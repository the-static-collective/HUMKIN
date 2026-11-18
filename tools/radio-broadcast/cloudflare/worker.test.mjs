import assert from 'node:assert/strict';
import test from 'node:test';
import worker,{approvedCatalog,program,stripInitialID3,continuousStream} from './worker.mjs';

const uuid='720778a0-f76f-46d4-b139-8f4eb90dd096';
const hash='3b9e287699f677833ccc463cb3b33b56739a1f4c952b1d24ebf6bd51c577ffdb';
function song(n,kind='song',duration=180){
 const id=`${String(n).padStart(8,'0')}-f76f-46d4-b139-8f4eb90dd096`;
 return {id,kind,enabled:true,published_at:'2026-11-17T22:00:00Z',
 storage_provider:'r2',r2_object_key:`tracks/${id}/${hash}.mp3`,duration_seconds:duration,
 title:`Track ${n}`,is_single:false};
}
function chunkBytes(u8,n){return new ReadableStream({start(c){
 for(let i=0;i<u8.length;i+=n)c.enqueue(u8.slice(i,i+n));c.close();}})}
async function bytesOf(stream){
 const r=stream.getReader(),pieces=[];let size=0;
 while(true){const {done,value}=await r.read();if(done)break;pieces.push(value);size+=value.length}
 const b=new Uint8Array(size);let pos=0;for(const a of pieces){b.set(a,pos);pos+=a.length}return b;
}
function id3Frame(payload){
 // Ten-byte synchsafe metadata: size 4, followed by 4 padding bytes.
 return Uint8Array.from([73,68,51,4,0,0,0,0,0,4,1,2,3,4,...payload]);
}
test('catalog only includes approved published enabled R2 music',()=>{
 const rows=[song(1),song(2,'bumper',13),{...song(3),enabled:false},
 {...song(4),storage_provider:'supabase'},
 {...song(5),r2_object_key:'../../private.mp3'},
 {...song(6),published_at:null}];
 const manual={schema:'humkin.radio.r2/v1',tracks:[
  {id:'blue-at-the-tip',object_key:'tracks/Blue At The Tip.mp3',approved:true,seasonal:true,duration_seconds:194,title:'Blue At The Tip'},
  {id:'draft',object_key:'tracks/draft.mp3',approved:false,duration_seconds:20},
  {id:'sneak',object_key:'tracks/../private.mp3',approved:true,duration_seconds:20}
 ]};
 const out=approvedCatalog(rows,manual);
 assert.equal(out.length,3);
 assert.equal(out.filter(x=>x.kind==='bumper').length,1);
 assert.equal(out.filter(x=>x.kind==='song').length,2);
 assert.equal(out[2].seasonal,true);
 assert(out.every(x=>x.key.startsWith('tracks/')));
});
test('program spreads permitted bumper lengths without repeating too early',()=>{
 const tracks=approvedCatalog(Array.from({length:40},(_,i)=>song(i+1)),null);
 tracks.push(...[song(501,'bumper',11),song(502,'bumper',14),song(503,'bumper',29),song(504,'bumper',48),song(505,'bumper',76),song(506,'bumper',92)]
 .map(x=>({...x,key:x.r2_object_key,duration:x.duration_seconds}))); 
 const p=program(tracks,123456),q=program(tracks,44444);
 assert(p.length>40);
 assert(p.some(x=>x.kind==='bumper'));
 assert.notDeepEqual(p.map(x=>x.key),q.map(x=>x.key));
 for(const x of p)assert(tracks.some(t=>t.key===x.key));
});
test('ID3 headers are stripped even across chunk boundaries',async()=>{
 const input=id3Frame([0xff,0xfb,0x90,0x00,6,7]);
 for(const n of [1,2,7,13,100]){
  const out=await bytesOf(stripInitialID3(chunkBytes(input,n)));
  assert.deepEqual([...out],[0xff,0xfb,0x90,0x00,6,7]);
 }
 const plain=Uint8Array.from([0xff,0xfb,0x90,0x00,9,8,7]);
 assert.deepEqual(await bytesOf(stripInitialID3(chunkBytes(plain,2))),plain);
});
test('one HTTP stream advances through multiple R2 objects without any HTML events',async()=>{
 const catalog=approvedCatalog([song(1),song(2)],null);
 const all=new Map(catalog.map((s,i)=>[s.key,id3Frame([0xff,0xfb,0x90,0x00,30+i,50+i])]));
 let reads=0;
 const bucket={async get(key){reads++;return {body:chunkBytes(all.get(key),2)}}};
 const stream=continuousStream(bucket,catalog,{seed:1,maxObjects:3});
 const output=await bytesOf(stream);
 // Every complete source is written as one raw byte stream; no per-track
 // JavaScript play() calls or media source switches occur on the client.
 assert.equal(output.length,18);
 assert.equal(reads,3);
 for(let i=0;i<output.length;i+=6)
  assert.deepEqual([...output.slice(i,i+4)],[0xff,0xfb,0x90,0x00]);
});
test('worker serves one continuous MP3 response (no Content-Length or auth required)',async()=>{
 const oldFetch=globalThis.fetch;
 let catalogRequests=0;
 globalThis.fetch=async url=>{
  catalogRequests++;
  const u=String(url);
  return new Response(JSON.stringify(u.includes('r2-tracks.json')?
   {schema:'humkin.radio.r2/v1',tracks:[]}:[song(1),song(2)]),{status:200,headers:{'content-type':'application/json'}});
 };
 const b=approvedCatalog([song(1),song(2)],null);
 const keys=new Map(b.map(s=>[s.key,id3Frame([0xff,0xfb,0x90,0x00,1,2])]));
 const env={RADIO_MEDIA:{get:async key=>({body:chunkBytes(keys.get(key),3)})}};
 try{
  const health=await worker.fetch(new Request('https://humkin-long-wave.test/health'),env);
  assert.equal(health.status,200);
  assert.equal((await health.json()).r2_catalog,2);
  const res=await worker.fetch(new Request('https://humkin-long-wave.test/live.mp3'),env);
  assert.equal(res.status,200);assert.equal(res.headers.get('content-type'),'audio/mpeg');
  assert.equal(res.headers.get('content-length'),null);
  const reader=res.body.getReader();const sample=await reader.read();
  assert.equal(sample.done,false);assert.equal(sample.value[0],0xff);
  await reader.cancel();
  assert(catalogRequests>=2);
 }finally{globalThis.fetch=oldFetch;}
});
