const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const G=require("../fm/orchard/gambit-core.js");
const O=require("../fm/orchard/model.js");
const S=require("../fm/signal/model.js");
const source=path=>fs.readFileSync(path,"utf8");
const SONGS=[
  {id:"a",title:"Morning Record",artist:"HUMKIN",album:"One",duration:180,src:"../audio/a.mp3"},
  {id:"b",title:"Night Letter",artist:"HUMKIN",album:"Two",duration:110,src:"../audio/b.mp3"},
  {id:"c",title:"Tide",artist:"HUMKIN",album:"Two",duration:260,src:"../audio/c.mp3"},
  {id:"d",title:"Strange",artist:"HUMKIN",album:"Three",duration:140,src:"../audio/d.mp3"},
  {id:"e",title:"B Side",artist:"HUMKIN",album:"Four",duration:170,src:"../audio/e.mp3"}
];
test("gambit slot growth extends the actual Orchard progression without claiming station authority",()=>{
 assert.equal(G.slotsForLevel(1),0);
 assert.equal(G.slotsForLevel(2),0);
 assert.equal(G.slotsForLevel(3),3);
 assert.equal(G.slotsForLevel(4),4);
 assert.equal(G.slotsForLevel(7),6);
 assert.equal(G.slotsForLevel(9),8);
 assert.equal(O.level(O.fresh(1).xp),1);
 assert.equal(G.STAGES.find(x=>x.key==="operator").level,null);
 assert.equal(G.STAGES.find(x=>x.key==="founder").kind,"server-authorized");
 assert.equal(G.STAGES.find(x=>x.key==="receiver").level,1);
});
test("gambits are priority-ordered, not unordered filters or autoplay",()=>{
 const rules=[
  {when:"short",action:"shortest",enabled:true},
  {when:"unheard",action:"least-played",enabled:true},
  {when:"always",action:"surprise",enabled:true}
 ];
 const result=G.propose(SONGS,rules,{hour:12,level:3});
 assert.equal(result.tracks[0].id,"b","High priority short-track rule wins");
 assert.equal(result.tracks[1].id,"d");
 assert.equal(result.tracks[2].id,"e");
 assert.equal(result.receipts[0].ruleIndex,0);
 assert.equal(result.authority,"local-only");
 assert.equal(new Set(result.tracks.map(t=>t.id)).size,3);
 const without=G.propose(SONGS,[{when:"night",action:"shortest",enabled:true},
   {when:"always",action:"longest",enabled:true}],{hour:9,level:3});
 assert.equal(without.tracks[0].id,"c");
 assert.equal(without.receipts[0].ruleIndex,1);
});
test("invalid or excessive rules and tracks are bounded; no client authority escalation",()=>{
 const invalid=G.normalizeRules([
  {when:"javascript:alert(1)",action:"surprise"},
  {when:"always",action:"delete-catalog"},
  {when:"always",action:"surprise",enabled:false}
 ],3);
 assert.equal(invalid.length,1);
 assert.equal(invalid[0].enabled,false);
 assert.equal(G.normalizeRules(Array(100).fill({when:"always",action:"surprise"}),3).length,3);
 assert.equal(G.normalizeRules([],1).length,2);
 const rows=[...SONGS, {...SONGS[0],title:"Forged"}, {
   id:"../../admin",title:"Unsafe",src:"../../private.mp3"
 }];
 assert.equal(G.safeCatalog(rows).length,5);
 const preview=G.propose(rows,[{when:"always",action:"surprise"}],{level:3});
 assert.equal(preview.tracks.length,3);
 assert.equal(preview.mode,"personal-signal-preview");
});
test("Gambit three-song choices reuse the existing shareable Signal contract",()=>{
 const result=G.propose(SONGS,G.STARTER,{level:3,hour:12});
 const link=S.toUrl("https://humkin.abundent.org/fm/signal/",{
   version:1,name:"My Gambit Station",intro:"Priority-based radio",
   mode:"across",tracks:result.tracks.map(t=>t.id)
 },SONGS);
 const selected=S.fromUrl(new URL(link).search,SONGS);
 assert.deepEqual(selected.tracks,result.tracks.map(t=>t.id));
 assert.equal(new Set(selected.tracks).size,3);
});
test("workbench is a real linked mobile-friendly route, not a fake operator API",()=>{
 const html=source("fm/orchard/gambits.html"),
  js=source("fm/orchard/gambits-ui.js"),
  core=source("fm/orchard/gambit-core.js"),
  orchard=source("fm/orchard/orchard.js");
 assert.match(source("fm/orchard/index.html"),/id="door-gambit" href="\.\/gambits\.html" hidden/);
 assert.match(orchard,/\["door-gambit",3\]/);
 for(const id of ["gambit-rules","gambit-add","gambit-run","gambit-program",
   "gambit-signal","gambit-stages","gambit-level","gambit-status"])
   assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(html,/gambit-core\.js/);
 assert.match(html,/signal\/model\.js/);
 assert.match(js,/S\.toUrl\(/);
 assert.match(js,/fetch\(base,\{cache:"no-store"\}\)/);
 assert.doesNotMatch(js+core,/supabase\.co|functions\/v1|\.upload\(|\.play\(|awardXp|publishProgram/);
 assert.doesNotThrow(()=>new Function(js));
 assert.doesNotThrow(()=>new Function(core));
});
