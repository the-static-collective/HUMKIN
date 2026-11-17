/* Station Seed 002: local-only founding selections and forward-compatible origin. */
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const Signal=require("../fm/signal/model.js");
const Seed=require("../fm/signal/seed.js");
const rows=[
 {id:"a1",title:"First Song",artist:"HUMKIN",album:"Old",src:"../a.mp3"},
 {id:"b2",title:"Second Song",artist:"HUMKIN",album:"New",src:"../b.mp3"},
 {id:"c3",title:"Third Song",artist:"HUMKIN",album:"Other",src:"../c.mp3"},
 {id:"d4",title:"Fourth Song",artist:"HUMKIN",album:"Other",src:"../d.mp3"}
];
const selection={version:1,name:"Home Frequency",mode:"across",intro:"A song from the porch.",tracks:["b2","a1","c3"]};
function memory(){
 const data=new Map([["humkin-orchard-v1",JSON.stringify({level:7,inventory:["goose"]})],["network-key","private"]]);
 return {data,getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,String(v))};
}
test("first selections become immutable content-rich founding record, in chosen order",()=>{
 const seed=Seed.make(selection,rows,{uuid:"station-00000001",now:"2026-11-16T23:00:00.000Z"});
 assert.equal(seed.schema,"humkin.station.seed/v1");
 assert.equal(seed.catalogSource,"fm/rotation.json");
 assert.equal(seed.founding.name,"Home Frequency");
 assert.equal(seed.founding.intro,"A song from the porch.");
 assert.equal(seed.founding.mode,"across");
 assert.deepEqual(seed.founding.tracks.map(t=>t.id),["b2","a1","c3"]);
 assert.deepEqual(seed.founding.tracks.map(t=>t.title),["Second Song","First Song","Third Song"]);
 assert.equal(seed.origin.kind,"self");
});
test("an established station retains the original seed while future selections change",()=>{
 const store=memory();
 const seed=Seed.make(selection,rows,{uuid:"station-00000001",now:"2026-11-16T23:00:00.000Z"});
 assert.equal(Seed.plant(store,seed),true);
 const updated={...selection,name:"Later Station",mode:"together",tracks:["d4","c3","a1"]};
 const other=Seed.make(updated,rows,{uuid:"station-00000002",now:"2026-11-17T23:00:00.000Z"});
 assert.equal(Seed.plant(store,other),false);
 assert.deepEqual(Seed.read(store),seed);
 assert.equal(JSON.parse(store.getItem("humkin-orchard-v1")).level,7);
 assert.equal(store.getItem("network-key"),"private");
});
test("received links become separately attributed personal seeds only on adoption",()=>{
 const store=memory();
 const source={...selection,name:"Someone Else's Signal"};
 const adopted={...selection,name:"My Version",tracks:["c3","b2","a1"]};
 const seed=Seed.make(adopted,rows,{parent:source,uuid:"station-00000003",now:"2026-11-17T02:00:00.000Z"});
 assert.equal(seed.origin.kind,"received-link");
 assert.equal(seed.origin.selections.name,"Someone Else's Signal");
 assert.deepEqual(seed.origin.selections.tracks,source.tracks);
 assert.deepEqual(seed.founding.tracks.map(t=>t.id),adopted.tracks);
 assert.equal(Seed.read(store),null);
 assert.equal(Seed.plant(store,seed),true);
 assert.equal(Seed.read(store).origin.kind,"received-link");
 assert.match(seed.origin.note,/not proof of authorship/);
});
test("backup/restoration preserves roots even when catalog has changed",()=>{
 const s=Seed.make(selection,rows,{uuid:"station-00000001",now:"2026-11-16T23:00:00.000Z"});
 const later={...selection,name:"Fifth Program",tracks:["a1","c3","d4"]};
 const backup=Seed.backup(s,later,rows);
 const restored=Seed.restore(JSON.parse(JSON.stringify(backup)),rows.slice(0,2));
 assert.deepEqual(restored.station,s,"historic founding metadata survives removed current tracks");
 assert.equal(restored.current.name,"Fifth Program");
 const again=Seed.restore(backup,rows);
 assert.deepEqual(again.current.tracks,["a1","c3","d4"]);
 assert.throws(()=>Seed.restore({schema:backup.schema,station:{schema:s.schema}},rows),/invalid/);
});
test("invalid or damaged save is not silently overwritten",()=>{
 const store=memory();store.setItem(Seed.KEY,"{bad");
 const s=Seed.make(selection,rows,{uuid:"station-00000004",now:"2026-11-17T02:00:00.000Z"});
 assert.equal(Seed.read(store),null);
 assert.equal(Seed.plant(store,s),false);
 assert.equal(store.getItem(Seed.KEY),"{bad");
 assert.throws(()=>Seed.make({...selection,tracks:["bad","b2","c3"]},rows,{uuid:"station-00000005"}),/published/);
});
test("UI is restrained, transparent and cannot mutate Orchard or network through a seed",()=>{
 const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
 const js=read("fm/signal/signal.js"),html=read("fm/signal/index.html"),sw=read("sw.js");
 for(const file of ["fm/signal/seed.js","fm/signal/signal.js"]){
  assert.doesNotThrow(()=>new Function(read(file)),file);
 }
 assert.match(html,/src="\.\/seed\.js"/);
 for(const id of ["seed-summary","seed-status","backup-seed","restore-seed"])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(js,/S\.make\(draft,tracks/);
 assert.match(js,/S\.plant\(store,candidate\)/);
 assert.match(js,/!guest&&!establishSeed\(\)/);
 assert.match(js,/if\(!establishSeed\(\)\)/);
 assert.match(sw,/\.\/fm\/signal\/seed\.js/);
 assert.notEqual(Seed.KEY,Signal.KEY);
 assert.notEqual(Seed.KEY,"humkin-orchard-v1");
});
