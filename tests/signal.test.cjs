/* HUMKIN Signal 001: no fake airtime, no Orchard save migration. */
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const M=require("../fm/signal/model.js");
function read(p){return fs.readFileSync(path.join(__dirname,"..",p),"utf8");}
const rows=[
{id:"a1",title:"First",album:"A",src:"../audio/1.mp3"},
{id:"a2",title:"Second",album:"A",src:"../audio/2.mp3"},
{id:"a3",title:"Third",album:"A",src:"../audio/3.mp3"},
{id:"b1",title:"Other",album:"B",src:"../audio/4.mp3"},
{id:"c1",title:"Another",album:"C",src:"../audio/5.mp3"}
];
test("three-song programming rules are real, bounded, and repeat-free",()=>{
 const across=M.pick(rows,"across",()=>0);
 assert.equal(across.length,3);
 assert.equal(new Set(across).size,3);
 assert.equal(new Set(across.map(id=>rows.find(t=>t.id===id).album)).size,3);
 const together=M.pick(rows,"together",()=>0);
 assert.deepEqual(together,["a1","a2","a3"]);
 assert.equal(M.pick(rows.slice(0,2),"surprise",()=>0).length,2);
});
test("shared signals reconstruct exactly three published songs, never untrusted IDs",()=>{
 const draft={version:1,name:"  Porch Radio  ",intro:"Hello!\n",mode:"together",tracks:["a2","c1","b1"]};
 const link=M.toUrl("https://humkin.abundent.org/fm/signal/?unused=1#x",draft,rows);
 assert.equal(link.includes("unused"),false);
 assert.equal(link.includes("#x"),false);
 const parsed=M.fromUrl(new URL(link).search,rows);
 assert.deepEqual(parsed.tracks,["a2","c1","b1"]);
 assert.equal(parsed.name,"Porch Radio");
 assert.equal(parsed.intro,"Hello!");
 assert.equal(M.fromUrl("?t=a1.a1.b1",rows),null);
 assert.equal(M.fromUrl("?t=a1.b1.missing",rows),null);
 assert.equal(M.fromUrl("?t=a1.b1",rows),null);
 assert.equal(M.fromUrl("",rows),null);
});
test("draft normalization keeps only catalog IDs and caps personal text",()=>{
 const draft=M.normalize({version:1,mode:"bogus",name:"x".repeat(999),intro:"y".repeat(999),tracks:["bad","a1","a1"]},rows);
 assert.equal(draft.name.length,48);
 assert.equal(draft.intro.length,160);
 assert.equal(draft.mode,"across");
 assert.equal(draft.tracks.length,3);
 assert.equal(new Set(draft.tracks).size,3);
 assert.ok(draft.tracks.every(id=>rows.some(t=>t.id===id)));
});
test("the Signal is a separate, opt-in projection; the Orchard save stays intact",()=>{
 const model=read("fm/signal/model.js"),player=read("fm/signal/signal.js");
 const html=read("fm/signal/index.html");
 assert.notEqual(M.KEY,"humkin-orchard-v1");
 assert.match(player,/getItem\("humkin-orchard-room-name-v1"\)/);
 assert.doesNotMatch(player,/setItem\("humkin-orchard/);
 assert.doesNotMatch(player,/M\.listen\(|top42|contribution.*credit/i);
 for(const f of [model,player])assert.doesNotThrow(()=>new Function(f));
 for(const id of ["station-name","station-mode","station-intro","track-choices","play","share","signal-audio","inherit","fallback"]){
  assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.match(html,/NO AUTOPLAY/);
 assert.match(read("sw.js"),/fm\/signal\/model\.js/);
 assert.match(read("fm/orchard/index.html"),/\.\.\/signal\//);
});

test("one approved on-air song seeds an editable three-song station, never a guest link",()=>{
 const across=M.fromSeed("?seed=a2",rows,()=>0);
 assert.deepEqual(across.tracks,["a2","b1","c1"]);
 assert.equal(across.name,"My Little Station");
 assert.equal(across.mode,"across");
 assert.deepEqual(M.fromSeed("?seed=a2&m=together",rows,()=>0).tracks,["a2","a1","a3"]);
 assert.equal(M.fromSeed("?seed=missing",rows),null);
 assert.equal(M.fromSeed("?seed=a1%26admin%3D1",rows),null);
 assert.equal(M.fromSeed("?seed="+("x".repeat(91)),rows),null);
 assert.equal(M.fromSeed("?t=a1.b1.c1&seed=a2",rows),null);
 assert.equal(M.fromSeed("",rows),null);
 assert.ok(read("fm/signal/signal.js").includes("M.fromSeed(location.search,tracks)"));
});
