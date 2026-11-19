import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
import {
  SCHEMA,blank,idFor,ingestInventory,addBrowserFile,addHosted,
  ingestPublishedCrate,portable,validate,merge,sources,nextCompost,safeAudioUrl
} from "../fm/mesh-radio/links.mjs";

const A="a".repeat(64),B="b".repeat(64);
const ONE="11111111-1111-4111-8111-111111111111";
const TWO="22222222-2222-4222-8222-222222222222";
const manifest=(node,files)=>({
  schema:"humkin.mesh/inventory/v1",node_id:node,label:"My computer",
  files:files.map(([sha,title],i)=>({
    sha256:sha,title,artist:"HUMKIN",album:"Unreleased",
    bytes:2000+i,relative_path:"Private/User Name/"+title+".mp3",
    path_hash:"f".repeat(64),extension:"mp3",duration_seconds:180
  }))
});
test("two real MESH inventories become one distinct recording with two device links",()=>{
  const g=blank();
  assert.equal(ingestInventory(g,manifest(ONE,[[A,"Hello"]])).copies,1);
  assert.equal(ingestInventory(g,manifest(TWO,[[A,"Hello"],[B,"Other"]])).copies,2);
  assert.equal(g.nodes.length,2);
  assert.equal(g.recordings.length,2);
  assert.equal(g.routes.filter(x=>x.recording===idFor(A)).length,2);
  assert.equal(sources(g,A).length,0,"Indexing device copies is not a remote audio relay");
  const json=JSON.stringify(portable(g));
  assert(!json.includes("Private/User Name"));
  assert(!json.includes("relative_path"));
  assert(!json.includes("path_hash"));
  assert.equal(validate(JSON.parse(json)).schema,SCHEMA);
});
test("browser-selected music plays locally; its blob URL stays out of exports",()=>{
  const g=blank();
  addBrowserFile(g,{sha256:A,title:"A new work"});
  const f=new Map([[A,{url:"blob:https://example.org/local-song",file:{name:"secret.mp3"}}]]);
  assert.equal(sources(g,A,f).length,1);
  assert.equal(sources(g,A).length,0,"File selection is not persisted");
  assert(!JSON.stringify(portable(g)).includes("blob:"));
  assert(!JSON.stringify(portable(g)).includes("secret.mp3"));
});
test("hosted free-provider routes can fail over without changing the recording identity",()=>{
  const g=blank();
  ingestInventory(g,manifest(ONE,[[A,"Innocent Song"]]));
  addHosted(g,{sha256:A,url:"https://r2.example.org/song.mp3",provider:"r2"});
  addHosted(g,{sha256:A,url:"https://supabase.example.org/song.mp3",provider:"supabase"});
  const refs=sources(g,A);
  assert.equal(refs.length,2);
  const failed=new Set([refs[0].key]);
  assert.equal(sources(g,A,new Map(),failed)[0].url,refs[1].url);
  const restored=blank();merge(restored,portable(g));
  assert.equal(restored.recordings.length,1);
  assert.equal(restored.routes.length,3);
  assert.equal(merge(restored,portable(g)).routes.length,3,"Importing same capsule twice is idempotent");
});
test("least-played Compost selects an available recording, not an offline-only inventory",()=>{
  const g=blank();
  ingestInventory(g,manifest(ONE,[[A,"Unplayed"],[B,"Played"]]));
  assert.equal(nextCompost(g),null);
  addHosted(g,{sha256:A,url:"https://cdn.example.com/one.mp3",provider:"cdn"});
  addHosted(g,{sha256:B,url:"https://cdn.example.com/two.mp3",provider:"cdn"});
  assert.equal(nextCompost(g,{[B]:{count:4,last:100}})?.sha256,A);
  assert.equal(nextCompost(g,{[A]:{count:4,last:100},[B]:{count:4,last:200}})?.sha256,A);
  assert.equal(nextCompost(g,{},new Map(),new Set(),A)?.sha256,B);
});
test("only approved published R2 media from the existing catalog gets playable links",()=>{
  const g=blank();
  const row={sha256:A,title:"Public",artist:"HUMKIN",album:"Test",
    duration_seconds:160,kind:"song",enabled:true,
    published_at:"2026-11-19T00:00:00Z",storage_provider:"r2",
    r2_object_key:"tracks/"+ONE+"/"+A+".mp3"};
  assert.equal(ingestPublishedCrate(g,[row,{...row,sha256:B,published_at:null},
    {...row,sha256:B,enabled:false}]),1);
  assert.equal(g.recordings.length,1);
  assert.equal(sources(g,A).length,1);
  assert.equal(sources(g,A)[0].url,"https://media.abundent.org/"+row.r2_object_key);
});
test("rejects credentials, non-HTTPS routes, and local/private hosts",()=>{
  for(const bad of ["http://example.com/song.mp3","https://localhost/file.mp3",
    "https://192.168.1.4/file.mp3","https://example.org/file.mp3?token=abc",
    "https://u:p@example.org/file.mp3","https://example.org/index.html"]){
    assert.throws(()=>safeAudioUrl(bad));
  }
  assert.equal(safeAudioUrl("https://songs.example.org/audio.mp3"),"https://songs.example.org/audio.mp3");
});
test("portable export includes only allowlisted fields",()=>{
  const g=blank();ingestInventory(g,manifest(ONE,[[A,"Safe"]]));
  g.recordings[0].relative_path="SECRET";
  g.nodes[0].password="not-a-token";
  const output=JSON.stringify(portable(g));
  assert(!output.includes("SECRET"));
  assert(!output.includes("not-a-token"));
});
test("page is isolated, on GitHub Pages, and has no automatic audio upload",()=>{
  const ui=readFileSync("fm/mesh-radio/index.html","utf8");
  const client=readFileSync("fm/mesh-radio/desk.mjs","utf8");
  for(const id of ["inventory","cloud","local","folder","host-form","export",
    "play-compost","audio","songs","messages"]){
    assert(ui.includes('id="'+id+'"'),"Missing browser control "+id);
  }
  assert(client.includes('ingestInventory('));
  assert(client.includes('ingestPublishedCrate('));
  assert(client.includes('audio.addEventListener("error"'));
  assert(!client.includes("signInWithOtp")&&!client.includes("TOWER_MASTER_KEY"));
  assert(!ui.includes('autoplay'));
});
