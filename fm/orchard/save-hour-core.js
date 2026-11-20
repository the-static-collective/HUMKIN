/* HUMKIN SAVE THE HOUR 001: local-only card game built on actual Orchard Gambits.
 * Never issues a server collectible, edits a station, awards XP or publishes music.
 */
(function(root,factory){
  const api=factory(root.HumkinGambits);
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  root.HumkinSaveTheHour=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(G){
"use strict";
if(!G||typeof G.propose!=="function")throw Error("Orchard Gambits required");
const VERSION=1,KEY="humkin-save-the-hour-v1",COUNTS_KEY="humkin-save-the-hour-practice-counts-v1";
const FAMILIES=["record","gear","gambit","crew","weather","relic"];
const DATA=[
 ["paper-crate","The Paper Crate","record","least-played","Rescue a song ignored by your local practice rounds."],
 ["golden-side","Golden B-Side","record","longest","Give a long recording room to breathe."],
 ["pocket-single","Pocket Single","record","shortest","Slip a short song into the schedule."],
 ["mystery-pressing","Mystery Pressing","record","surprise","Find an unexpected record."],
 ["night-antenna","Night Antenna","gear","different-album","Reach beyond the previous record's album."],
 ["patch-cable","Patch Cable","gear","least-played","Connect the overlooked recordings."],
 ["tiny-transmitter","Tiny Transmitter","gear","shortest","Make a short transmission."],
 ["wobbly-tuner","Wobbly Tuner","gear","surprise","Tune the unknown end of the dial."],
 ["album-detour","Album Detour","gambit","different-album","Make a deliberate album jump."],
 ["three-minute-rule","Three-Minute Rule","gambit","shortest","Prefer the shortest available recording."],
 ["long-way-home","Long Way Home","gambit","longest","Prefer a long-form recording."],
 ["rescue-protocol","Rescue Protocol","gambit","least-played","Prioritize locally unfamiliar songs."],
 ["duck-engineer","Duck Engineer","crew","least-played","Someone needs to rescue the neglected tapes."],
 ["graveyard-dj","Graveyard DJ","crew","different-album","Find another album for the night shift."],
 ["friendly-operator","Friendly Operator","crew","surprise","Choose a record nobody predicted."],
 ["quick-change","Quick-Change Artist","crew","shortest","Make a clean, short handoff."],
 ["radio-fog","Radio Fog","weather","longest","A drifting signal calls for something spacious."],
 ["sunburst","Sunburst","weather","surprise","A clearing in the static reveals a surprise."],
 ["passing-shower","Passing Shower","weather","shortest","Play a quick song between clouds."],
 ["crosswind","Crosswind","weather","different-album","Blow into another album."],
 ["blue-lemon-memory","Blue Lemon Memory","relic","least-played","A tribute to the held Blue Lemon idea; not an issued Blue Lemon card."],
 ["old-station-key","Old Station Key","relic","different-album","Open a different shelf without taking control of the transmitter."],
 ["endless-reel","Endless Reel","relic","longest","Keep the tape rolling."],
 ["first-signal","First Signal","relic","surprise","Remember the first strange reception."]
];
const CARDS=Object.freeze(DATA.map(([id,name,family,action,description])=>Object.freeze({id,name,family,action,description})));
const BY_ID=new Map(CARDS.map(c=>[c.id,c]));
const CONDITIONS=Object.freeze([
 {id:"echo",name:"THE ECHO CHAMBER",description:"Break the repetition: choose three distinct albums.",objective:"Three different albums"},
 {id:"dust",name:"THE DUSTY SHELVES",description:"Rediscover the neglected: include two recordings unused in earlier local rounds.",objective:"Two locally unplayed songs"},
 {id:"drift",name:"THE ENDLESS DRIFT",description:"Find contrast: the shortest and longest song must differ by at least 75 seconds.",objective:"At least 75 seconds of length contrast"},
 {id:"choir",name:"THE SAME OLD CREW",description:"Bring different capabilities: use three different card families.",objective:"Three different card families"}
]);
const BY_CONDITION=new Map(CONDITIONS.map(c=>[c.id,c]));
function hash(s){let h=2166136261;for(const x of String(s)){h^=x.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0;}
function roll(s){return hash(s)/4294967296;}
function shuffle(items,seed){const a=items.slice();let x=hash(seed)||1;for(let i=a.length-1;i>0;i--){x^=x<<13;x^=x>>>17;x^=x<<5;const j=(x>>>0)%(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
function count(reads,id){const n=reads&&reads[id];return Number.isSafeInteger(n)&&n>=0?Math.min(n,1000000):0;}
function start(rows,day,round=0){
  if(G.safeCatalog(rows).length<3)throw Error("Three valid published songs are required.");
  if(typeof day!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(day))throw Error("Use a calendar day.");
  if(!Number.isInteger(round)||round<0||round>9999)throw Error("Invalid practice round.");
  const seed=day+"|"+round;
  return {version:VERSION,day,round,
    conditionId:CONDITIONS[hash(seed+"|condition")%CONDITIONS.length].id,
    hand:shuffle(CARDS.map(c=>c.id),seed+"|hand").slice(0,5),played:[]};
}
function play(raw,cardId,rows,reads={}){
  if(!raw||raw.version!==VERSION||!Array.isArray(raw.played)||raw.played.length>=3)throw Error("Round already complete.");
  const reference=start(rows,raw.day,raw.round);
  if(raw.conditionId!==reference.conditionId||
     JSON.stringify(raw.hand)!==JSON.stringify(reference.hand))throw Error("Invalid hand.");
  if(!reference.hand.includes(cardId)||raw.played.some(p=>p.cardId===cardId))throw Error("Choose a card still in your hand.");
  const catalog=G.safeCatalog(rows);
  const used=new Set(raw.played.map(x=>x.trackId));
  const last=catalog.find(t=>t.id===raw.played[raw.played.length-1]?.trackId);
  const card=BY_ID.get(cardId);
  if(!card)throw Error("Unknown card.");
  let pool=catalog.filter(t=>!used.has(t.id));
  if(!pool.length)throw Error("No recordings remain.");
  const notes=[];
  const prev=BY_ID.get(raw.played[raw.played.length-1]?.cardId);
  const albumSwitch=(label)=>{
    if(!last)return;
    const others=pool.filter(t=>t.album!==last.album);
    if(others.length){pool=others;notes.push(label);}
  };
  if(card.action==="different-album")albumSwitch("Album detour");
  if(prev?.family==="gear"&&card.family==="record")albumSwitch("Gear → Record: patchbay bridge");
  if(prev?.family==="crew"&&card.family==="gambit"){
    const short=pool.filter(t=>t.duration>0&&t.duration<=180);
    if(short.length){pool=short;notes.push("Crew → Gambit: quick change");}
  }
  if(prev?.family==="weather"&&card.family==="relic"){
    const old=pool.filter(t=>count(reads,t.id)===0);
    if(old.length){pool=old;notes.push("Weather → Relic: recovered signal");}
  }
  const selection=G.propose(pool,[{when:"always",action:card.action,enabled:true}],{
    level:3,length:1,reads,random:()=>roll(raw.day+"|"+raw.round+"|"+raw.played.length+"|"+cardId)
  });
  const t=selection.tracks[0];
  if(!t||used.has(t.id))throw Error("No safe catalog selection.");
  return {...reference,played:[...raw.played.map(p=>({...p})),{
    cardId,trackId:t.id,action:card.action,priorLocalUses:count(reads,t.id),
    explanation:notes.concat(card.action).join(" / ")
  }]};
}
function evaluate(raw,rows){
  const catalog=G.safeCatalog(rows),byId=new Map(catalog.map(t=>[t.id,t]));
  const plays=Array.isArray(raw?.played)?raw.played.slice(0,3):[];
  const tracks=plays.map(p=>byId.get(p.trackId)).filter(Boolean);
  const families=new Set(plays.map(p=>BY_ID.get(p.cardId)?.family).filter(Boolean));
  const albums=new Set(tracks.map(t=>t.album));
  const localNew=plays.filter(p=>p.priorLocalUses===0).length;
  const lengths=tracks.map(t=>t.duration).filter(x=>x>0);
  const span=lengths.length===3?Math.max(...lengths)-Math.min(...lengths):0;
  const complete=plays.length===3&&tracks.length===3&&new Set(tracks.map(t=>t.id)).size===3;
  const condition=BY_CONDITION.get(raw?.conditionId);
  const reached=complete&&!!condition&&(
    condition.id==="echo"&&albums.size===3||
    condition.id==="dust"&&localNew>=2||
    condition.id==="drift"&&span>=75||
    condition.id==="choir"&&families.size===3
  );
  const score=tracks.length*8+albums.size*3+families.size*2+(reached?10:0);
  return {complete,won:reached,score,condition,tracks,
    objective:condition?.objective||"Unknown condition",albums:albums.size,
    families:families.size,localNew,span};
}
function receipt(raw,rows){
 const result=evaluate(raw,rows);
 if(!result.complete)throw Error("Finish three plays before making a receipt.");
 return {schema:"humkin.save-the-hour.local/v1",authority:"local-only",
   day:raw.day,round:raw.round,condition:raw.conditionId,won:result.won,
   score:result.score,plays:raw.played.map(p=>({cardId:p.cardId,trackId:p.trackId,
     action:p.action,explanation:p.explanation})),
   verifiedBroadcast:false,rewardsIssued:false};
}
return Object.freeze({VERSION,KEY,COUNTS_KEY,FAMILIES,CARDS,CONDITIONS,start,play,evaluate,receipt});
});
