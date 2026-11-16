const assert=require("node:assert/strict");
const fs=require("node:fs");
const fair=require("../fm/fair-rotation.js");
function seededShuffle(n,seed){
 const list=Array.from({length:n},(_,i)=>i);
 let state=(seed^0x9e3779b9)>>>0;
 const random=()=>{
  state=(state+0x6d2b79f5)>>>0;
  let x=state;x=Math.imul(x^(x>>>15),x|1);x^=x+Math.imul(x^(x>>>7),x|61);
  return ((x^(x>>>14))>>>0)/4294967296;
 };
 for(let i=n-1;i>0;i--){
  const j=Math.floor(random()*(i+1));[list[i],list[j]]=[list[j],list[i]];
 }
 return list;
}
for(const n of [1,2,3,7,8,9,10,21,65,86,120]){
 let prev=null;
 for(let cycle=0;cycle<90;cycle++){
  const order=fair.cycle(n,cycle,seededShuffle);
  assert.equal(new Set(order).size,n,"Every song must appear once per cycle");
  assert.deepEqual(order,fair.cycle(n,cycle,seededShuffle),"Shared clocks must agree");
  if(prev&&n>1){
   const guard=n<8?1:Math.min(4,Math.floor(n/4));
   const recentlyHeard=new Set(prev.slice(-guard));
   for(const id of order.slice(0,guard))
    assert(!recentlyHeard.has(id),n+" tracks: too-recent song at cycle "+cycle);
  }
  prev=order;
 }
}
const radio=fs.readFileSync("fm/radio.js","utf8");
const listener=fs.readFileSync("fm/index.html","utf8");
const sw=fs.readFileSync("sw.js","utf8");
assert(radio.includes("HUMKIN_FAIR_ROTATION?.cycle"),"Fairness must be active in shared clock");
assert(listener.includes('src="./fair-rotation.js"'),"Fairness helper must load before radio.js");
assert(sw.includes("./fm/fair-rotation.js"),"Offline shell must include fairness helper");
assert(radio.includes("LIMITED DIAL"),"Cloud outages must disclose restricted catalog");
const page=fs.readFileSync("fm/load/index.html","utf8");
const loader=fs.readFileSync("fm/load/loader.js","utf8");
assert(page.includes(".m4a"),"One drop must accept M4A");
assert(loader.includes("kind:item.kind"),"Queue type must reach cloud metadata");
assert(loader.includes("enabled:item.kind"),"New bumpers must start disabled");
assert(loader.includes("publishOne(row)"),"Each private item needs its own release action");
assert(loader.includes('row.kind!=="bumper"'),"Bulk song publish must exclude bumpers");
assert(loader.includes('approved')||loader.includes('Approve this exact bumper'),"Require owner approval text");
console.log("Fair radio seam, catalog warnings and typed one-drop intake regression checks passed.");
