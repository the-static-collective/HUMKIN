/* node --test tests/orchard.test.cjs */
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const M=require("../fm/orchard/model.js");
function read(file){return fs.readFileSync(path.join(__dirname,"..",file),"utf8")}
test("the orchard starts with spendable HUM but no imaginary listening",()=>{
 const s=M.fresh(1700000000000);
 assert.equal(s.hum,42);assert.equal(s.listenSeconds,0);
 assert.equal(M.level(s.xp),1);assert.equal(s.receipts.length,0);
 assert.equal(M.stage(s),0);
});
test("qualified audio advances points and progress; no screen-on or offline farming",()=>{
 const s=M.fresh(1000);
 M.grow(s,1000+48*3600000);
 assert.equal(s.hum,42);
 assert.equal(s.listenSeconds,0);
 assert.equal(s.growthHours,48);
 assert.equal(M.listen(s,300).hum,0,"one runaway timeupdate is capped at five seconds");
 assert.equal(s.listenSeconds,5);
 let earned=0;
 for(let i=0;i<36;i++)earned+=M.listen(s,5).hum;
 assert.equal(earned,10);
 assert.equal(s.listenSeconds,185);
 assert.equal(s.hum,52);
 assert.equal(M.listen(s,-500).hum,0);
 assert.equal(s.hum,52);
});
test("shop purchases cost HUM, prevent repeats and respect level locks",()=>{
 const s=M.fresh(2000);
 assert.equal(M.buy(s,"old-gramophone").ok,false);
 assert.equal(M.buy(s,"crooked-lamp").ok,true);
 assert.equal(s.hum,24);
 assert.equal(M.buy(s,"crooked-lamp").ok,false);
 assert.equal(s.hum,24);
 assert.equal(M.buy(s,"absurd-nonexistent-thing").ok,false);
});
test("placement and stowing never destroy ownership",()=>{
 const s=M.fresh(3000);
 const receipt=M.buy(s,"blue-cup");
 assert.equal(receipt.ok,true);
 assert.equal(M.place(s,receipt.unit.uid,2),true);
 assert.equal(s.placements[2],receipt.unit.uid);
 assert.equal(M.place(s,"not-a-real-artifact",7),false);
 assert.equal(M.place(s,receipt.unit.uid,9),false);
 M.stow(s,receipt.unit.uid);
 assert.equal(Object.keys(s.placements).length,0);
 assert.equal(s.inventory.length,1);
});
test("real listening eventually finds one locally identified strange thing",()=>{
 const s=M.fresh(4000);
 let found=null;
 for(let i=0;i<60;i++){const r=M.listen(s,5);if(r.discover)found=r.discover}
 assert.ok(found);
 assert.equal(found.origin,"listening-discovery");
 assert.equal(M.item(found.type).kind,"discovery");
 assert.equal(s.inventory.length,1);
});
test("workshop receipt is local, validated and awarded at most once per day",()=>{
 const s=M.fresh(5000);
 const old=s.hum;
 const r=M.workReward(s,"2026-11-16","f".repeat(64),21,7000);
 assert.equal(r.ok,true);assert.equal(s.hum,old+28);
 assert.equal(r.gift.type,"merit-spool");
 assert.equal(s.receipts.length,1);
 assert.equal(M.workReward(s,"2026-11-16","e".repeat(64),21,8000).ok,false);
 assert.equal(M.workReward(s,"tomorrow","e".repeat(64),21).ok,false);
 assert.equal(M.workReward(s,"2026-11-17","bad",21).ok,false);
 assert.equal(M.workReward(s,"2026-11-17","e".repeat(64),0).ok,false);
});
test("storage normalization removes forged placements and unknown item types",()=>{
 const store={contents:null,getItem(){return this.contents},setItem(k,v){this.contents=v}};
 let s=M.fresh(100);
 s.inventory=[{uid:"yes",type:"blue-cup",origin:"shop",at:1},{uid:"bad",type:"unknown",origin:"fake",at:1}];
 s.placements={"0":"yes","1":"yes","2":"bad"};
 M.save(store,s);
 s=M.read(store,200);
 assert.equal(s.inventory.length,1);
 assert.equal(Object.keys(s.placements).length,1);
 assert.equal(s.placements[0],"yes");
});
test("future trades and network workers remain explicitly BUILDING",()=>{
 const s=M.fresh(100);
 s.xp=120*100;
 const f=M.features(s);
 assert.equal(f.find(x=>x.name.includes("artifact trading")).ready,false);
 assert.equal(f.find(x=>x.name.includes("GHoT work offers")).ready,false);
 assert.equal(f.find(x=>x.name.includes("local catalog audit")).unlocked,true);
});
test("browser entrypoints parse, controls exist, original radio remains intact",()=>{
 for(const file of ["fm/orchard/orchard.js","fm/orchard/bridge.js","fm/orchard/model.js"])assert.doesNotThrow(()=>new Function(read(file)));
 const html=read("fm/orchard/index.html");
 for(const id of ["orchard-audio","toggle-radio","shop-items","inventory-items","run-audit","receipt-output","share-orchard","placements","backup-restore","balance"]){
  assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.match(read("fm/index.html"),/\.\/orchard\/model\.js/);
 assert.match(read("fm/index.html"),/\.\/orchard\/bridge\.js/);
 assert.match(read("fm/top42/index.html"),/\.\.\/orchard\//);
 assert.match(read("sw.js"),/fm\/orchard\/index\.html/);
 assert.match(read("fm/index.html"),/id="air"/);
 assert.match(read("fm/index.html"),/id="mode-clock"/);
});
