import assert from "node:assert/strict";
import test from "node:test";
import {applyReviewedEnrichment,approvedCatalog,getCatalog} from "./worker.mjs";

const HASH="a".repeat(64);
function row(i,hash=HASH){
 const id=i.toString(16).padStart(8,"0")+"-f76f-46d4-b139-8f4eb90dd096";
 return {id,title:"Song "+i,artist:"Real Artist",album:"Source Album",
  kind:"song",enabled:true,published_at:"2026-11-18T20:00:00Z",
  storage_provider:"r2",sha256:hash,
  r2_object_key:"tracks/"+id+"/"+HASH+".mp3",
  duration_seconds:200,is_single:false};
}
test("reviewed hash overlay cannot publish files or change existing track identity",()=>{
 const list=approvedCatalog([row(1),{...row(2),enabled:false}],null);
 assert.equal(list.length,1);
 applyReviewedEnrichment(list,{schema:"humkin.radio.enrichment/v1",tracks:[
  {mp3_sha256:HASH,reviewed:true,tags:["genre:jazz","mood:warm","../../bad","genre:jazz"]},
  {mp3_sha256:"b".repeat(64),reviewed:true,tags:["genre:metal"]}
 ]});
 assert.deepEqual(list[0].tags,["genre:jazz","mood:warm"]);
 assert.equal(list[0].album,"Source Album");
 assert.equal(list[0].id,"crate-"+row(1).id);
 assert.equal(list[0].enrichment_reviewed,true);
});
test("unreviewed, duplicates, and mismatched hashes never affect station filters",()=>{
 const list=approvedCatalog([row(10)],null);
 applyReviewedEnrichment(list,{schema:"humkin.radio.enrichment/v1",tracks:[
  {mp3_sha256:HASH,reviewed:false,tags:["genre:pop"]}
 ]});
 assert.deepEqual(list[0].tags,[]);
 applyReviewedEnrichment(list,{schema:"humkin.radio.enrichment/v1",tracks:[
  {mp3_sha256:HASH,reviewed:true,tags:["genre:rock"]},
  {mp3_sha256:HASH,reviewed:true,tags:["genre:metal"]}
 ]});
 assert.deepEqual(list[0].tags,[]);
});
test("paginates over 1,000 approved tracks and joins published tags to uploaded hash",async()=>{
 const all=Array.from({length:1201},(_,i)=>row(i+100));
 const target=all[1100],targetHash="b".repeat(64);
 target.sha256=targetHash;
 const old=globalThis.fetch,requests=[];
 globalThis.fetch=async url=>{
  const u=String(url);requests.push(u);
  if(u.includes("/humkin_radio_tracks?")){
   const offset=Number(new URL(u).searchParams.get("offset")||0);
   return Response.json(all.slice(offset,offset+1000));
  }
  if(u.includes("catalog-enrichment.json"))
   return Response.json({schema:"humkin.radio.enrichment/v1",tracks:[
    {mp3_sha256:targetHash,reviewed:true,tags:["genre:folk","mood:hopeful"]},
    {mp3_sha256:HASH,reviewed:false,tags:["genre:metal"]}
   ]});
  if(u.includes("r2-tracks.json"))
   return Response.json({schema:"humkin.radio.r2/v1",tracks:[]});
  return Response.json([]);
 };
 try{
  const list=await getCatalog(globalThis.fetch);
  assert.equal(list.length,1201);
  const enriched=list.find(x=>x.id==="crate-"+target.id);
  assert.deepEqual(enriched.tags,["genre:folk","mood:hopeful"]);
  assert.equal(list.find(x=>x.id==="crate-"+all[0].id).tags.length,0);
  assert(requests.some(x=>x.includes("offset=1000")),"second page requested");
 }finally{globalThis.fetch=old}
});
