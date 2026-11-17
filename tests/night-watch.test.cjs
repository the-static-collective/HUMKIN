/* node --test tests/night-watch.test.cjs */
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const N=require("../fm/orchard/night-watch.js");
function store(){
 const data=new Map();
 return {getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)};
}
function listen(s,at,id,title,kind="song",seconds=5,extra={}){
 return N.note(s,{at,trackId:id,title,kind,seconds,...extra});
}
function read(p){return fs.readFileSync(path.join(__dirname,"..",p),"utf8")}
test("no listening is fabricated from opening the radio or elapsed idle time",()=>{
 const s=store();
 assert.deepEqual(N.read(s).watches,[]);
 assert.equal(N.latestCompleted(N.read(s),1700000000000),null);
 assert.equal(N.note(s,{at:1700000000000,seconds:1800}).ok,false);
 assert.equal(N.read(s).watches.length,0);
});
test("only actual, bounded progress qualifies a song and the first logged hearing",()=>{
 const s=store(),base=1700000000000;
 for(let n=0;n<3;n++)listen(s,base+n*5000,"track-1","The Song");
 let w=N.read(s).watches[0];
 assert.equal(N.stats(w).songCount,0);
 assert.equal(w.seconds,15);
 listen(s,base+15000,"track-1","The Song");
 w=N.read(s).watches[0];
 assert.equal(N.stats(w).songCount,1);
 assert.equal(N.stats(w).firstCount,1);
 assert.equal(N.read(s).known.length,1);
 assert.equal(N.note(s,{seconds:-5,at:base+16000,trackId:"track-1"}).ok,false);
 assert.equal(N.note(s,{seconds:800,at:base+17000,trackId:"track-1"}).ok,false);
 assert.equal(N.read(s).watches[0].seconds,20);
});
test("watch closes after quiet gap; resumed song isn't called new again",()=>{
 const s=store(),base=1700000000000;
 for(let n=0;n<5;n++)listen(s,base+n*5000,"song-a","First Song");
 const first=N.read(s).watches[0];
 assert.equal(N.latestCompleted(N.read(s),first.lastAt+N.GAP-1),null);
 assert.equal(N.latestCompleted(N.read(s),first.lastAt+N.GAP).id,first.id);
 assert.equal(N.acknowledge(s,first.id),true);
 assert.equal(N.read(s).readReportId,first.id);
 for(let n=0;n<4;n++)listen(s,first.lastAt+N.GAP+1+n*5000,"song-a","First Song");
 const state=N.read(s);
 assert.equal(state.watches.length,2);
 assert.equal(N.stats(state.watches[1]).songCount,1);
 assert.equal(N.stats(state.watches[1]).firstCount,0);
 assert.equal(state.watches[0].seconds,25);
});
test("station carts, real finds and level-ups are distinguished",()=>{
 const s=store(),t=1700000000000;
 for(let n=0;n<4;n++)listen(s,t+n*5000,"cart-1","Station ID","bumper",5,
   n===3?{previousLevel:2,level:3,find:"The Improbable Egg"}:{});
 const w=N.read(s).watches[0];
 const totals=N.stats(w);
 assert.equal(totals.songCount,0);
 assert.equal(totals.bumperCount,1);
 assert.equal(totals.finds[0],"The Improbable Egg");
 assert.deepEqual(totals.levels,[3]);
});
test("storage normalization bounds bad data and reports cannot be acknowledged before they exist",()=>{
 const s=store();
 s.setItem(N.KEY,JSON.stringify({version:1,known:["a","a",true],watches:[{id:"1",seconds:-8,tracks:[{id:"z",seconds:1000000000000}],levels:[-5,3],finds:["X"]}]}));
 const v=N.read(s);
 assert.deepEqual(v.known,["a"]);
 assert.equal(v.watches[0].seconds,0);
 assert.equal(v.watches[0].tracks[0].seconds,1000000);
 assert.deepEqual(v.watches[0].levels,[3]);
 assert.equal(N.acknowledge(s,"not-a-report"),false);
});
test("both active listening surfaces are wired, while unverified native playback isn't promised",()=>{
 for(const file of ["fm/orchard/night-watch.js","fm/orchard/night-watch-ui.js","fm/orchard/bridge.js","fm/orchard/orchard.js","fm/radio.js"])
  assert.doesNotThrow(()=>new Function(read(file)),file+" parses");
 for(const file of ["fm/index.html","fm/orchard/index.html"]){
  const html=read(file);
  assert.match(html,/id="nightwatch-mount"/);
  assert.match(html,/night-watch\.js/);
  assert.match(html,/night-watch-ui\.js/);
 }
 assert.match(read("fm/orchard/bridge.js"),/N\.note\(store/);
 assert.match(read("fm/orchard/orchard.js"),/N\.note\(store/);
 assert.match(read("fm/radio.js"),/currentTrack:remoteStream\?null/);
 assert.match(read("sw.js"),/fm\/orchard\/night-watch\.js/);
 assert.match(read("fm/orchard/index.html"),/id="door-network" href="\.\/network\.html" hidden/);
 assert.match(read("fm/orchard/index.html"),/id="network-banner" hidden/);
});
