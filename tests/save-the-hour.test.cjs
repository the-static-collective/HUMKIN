const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const G=require("../fm/orchard/gambit-core.js");
const H=require("../fm/orchard/save-hour-core.js");
const S=require("../fm/signal/model.js");
const rows=[
 {id:"a",title:"A",artist:"HUMKIN",album:"One",src:"../a.mp3",duration:90},
 {id:"b",title:"B",artist:"HUMKIN",album:"Two",src:"../b.mp3",duration:170},
 {id:"c",title:"C",artist:"HUMKIN",album:"Three",src:"../c.mp3",duration:250},
 {id:"d",title:"D",artist:"HUMKIN",album:"Four",src:"../d.mp3",duration:320},
 {id:"e",title:"E",artist:"HUMKIN",album:"Five",src:"../e.mp3",duration:130}
];
test("fixed 24-card deck has six real families, unique IDs and safe actions",()=>{
 assert.equal(H.CARDS.length,24);
 assert.equal(new Set(H.CARDS.map(c=>c.id)).size,24);
 assert.equal(new Set(H.CARDS.map(c=>c.family)).size,6);
 for(const c of H.CARDS)assert.ok(G.ACTIONS.some(([a])=>a===c.action));
});
test("daily five-card hand and challenge are reproducible",()=>{
 const a=H.start(rows,"2026-11-20"),b=H.start(rows,"2026-11-20");
 assert.deepEqual(a,b);
 assert.equal(a.hand.length,5);
 assert.equal(new Set(a.hand).size,5);
 assert.notDeepEqual(a,H.start(rows,"2026-11-20",1));
});
test("three card plays pick distinct real published tracks with attributable explanations",()=>{
 let a=H.start(rows,"2026-11-20");
 for(const id of a.hand.slice(0,3))a=H.play(a,id,rows,{a:4,b:3});
 const r=H.evaluate(a,rows);
 assert.ok(r.complete);
 assert.equal(r.tracks.length,3);
 assert.equal(new Set(r.tracks.map(t=>t.id)).size,3);
 assert.equal(a.played.length,3);
 assert.ok(a.played.every(p=>p.explanation&&rows.some(t=>t.id===p.trackId)));
 assert.throws(()=>H.play(a,a.hand[3],rows),/complete/);
 const link=S.toUrl("https://humkin.abundent.org/fm/signal/",{
  version:1,name:"Save the Hour",intro:"Local card game",mode:"across",
  tracks:r.tracks.map(t=>t.id)
 },rows);
 assert.deepEqual(S.fromUrl(new URL(link).search,rows).tracks,r.tracks.map(t=>t.id));
 const receipt=H.receipt(a,rows);
 assert.equal(receipt.authority,"local-only");
 assert.equal(receipt.verifiedBroadcast,false);
 assert.equal(receipt.rewardsIssued,false);
});
test("invalid hands, duplicate cards, unsafe catalog and incomplete receipts fail shut",()=>{
 const state=H.start(rows,"2026-11-20");
 assert.throws(()=>H.play({...state,hand:["admin"]}, "admin",rows),/Invalid hand/);
 assert.throws(()=>H.play(state,"unknown",rows),/hand/);
 assert.throws(()=>H.receipt(state,rows),/Finish/);
 const next=H.play(state,state.hand[0],rows);
 assert.throws(()=>H.play(next,state.hand[0],rows),/still in your hand/);
 const unsafe=[{id:"../../admin",title:"Fake",src:"../../secret.mp3"},...rows];
 assert.equal(H.evaluate(H.play(state,state.hand[0],unsafe),unsafe).tracks.length,1);
});
test("game route is local-only, mobile-friendly, and linked into the real Orchard",()=>{
 const html=fs.readFileSync("fm/orchard/save-the-hour.html","utf8");
 const ui=fs.readFileSync("fm/orchard/save-hour-ui.js","utf8");
 const css=fs.readFileSync("fm/orchard/save-hour.css","utf8");
 const orchard=fs.readFileSync("fm/orchard/index.html","utf8");
 const gambits=fs.readFileSync("fm/orchard/gambits.html","utf8");
 for(const id of ["game-hand","game-plays","game-condition","game-status","game-signal","game-reset"])
   assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(html,/save-hour-core\.js/);
 assert.match(html,/signal\/model\.js/);
 assert.match(orchard,/save-the-hour\.html/);
 assert.match(gambits,/save-the-hour\.html/);
 assert.match(css,/@media/);
 assert.match(ui,/HumkinSignal/);
 assert.doesNotMatch(ui,/functions\/v1|supabase\.co|publishProgram|awardXp|fetch\([^)]*POST/);
 assert.doesNotThrow(()=>new Function(ui));
});
