/* HUMKIN Orchard 001 — local-first game rules.
 * Local HUM and local artifacts are not money, tokens, or server-verified assets.
 * No rewards accrue for merely keeping a screen on. Audio must advance.
 */
(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  root.HumkinOrchard=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
const KEY="humkin-orchard-v1";
const VERSION=1;
const SHOP=[
  ["crooked-lamp","Crooked Lamp","💡",18,1,"room","It illuminates exactly one suspicious corner."],
  ["blue-cup","Chipped Blue Cup","☕",20,1,"room","A cup with a long career in very short stories."],
  ["first-seed","Window Seed","🌱",24,1,"garden","It grew toward the sound of the dial."],
  ["brass-dial","Brass Tuning Dial","📻",32,1,"room","The knob goes to eleven, then asks for directions."],
  ["moss-rock","Mossy Rock","🪨",28,1,"garden","Officially older than the management."],
  ["old-record","Unreasonably Round Record","💿",35,1,"room","An argument for circles."],
  ["tiny-cactus","Tiny Cactus","🌵",38,2,"garden","The least welcoming fan in the station."],
  ["paper-crane","Paper Crane","🕊️",42,2,"room","Made from yesterday's weather."],
  ["shy-mushroom","Shy Mushroom","🍄",48,2,"garden","Appears taller when nobody watches."],
  ["cassette-garden","Cassette Planter","🪴",60,2,"garden","An old mixtape finally takes root."],
  ["window-curtain","Theatrical Curtains","🎭",56,2,"room","Opening night, every night."],
  ["flower-bed","Bloom Bed","🌸",65,3,"garden","A suspiciously musical arrangement."],
  ["ceramic-goose","Ceramic Goose","🪿",74,3,"room","Never once approved the playlist."],
  ["sun-dial","Unreliable Sundial","🕰️",80,3,"garden","Accurate twice every noontime."],
  ["vinyl-shelf","Record Shelf","📚",88,3,"room","The records swear they're alphabetized."],
  ["second-speaker","Second Speaker","🔊",95,3,"room","It prefers the B sides."],
  ["wild-rose","Wild Rose","🌹",106,4,"garden","Survived a signal outage in spring."],
  ["antenna","Copper Antenna","📡",118,4,"garden","Receives the occasional blessing from geese."],
  ["old-gramophone","Old Gramophone","📯",130,4,"room","Has been playing records since before it was made."],
  ["kettle","Forever Kettle","🫖",144,4,"room","Nobody has found the off switch."],
  ["radio-house","Tiny Radio House","🏠",155,5,"garden","An extension constructed from useful favors."],
  ["fruit-tree","Blue Orchard Tree","🌳",170,5,"garden","Grows in odd meters."],
  ["clockwork-bee","Clockwork Bee","🐝",182,5,"garden","Unionized immediately."],
  ["glasshouse","Glasshouse","🏡",200,6,"garden","For cultivating strange little possibilities."],
  ["tape-machine","Reel Machine","🎞️",225,6,"room","Spools stories nobody remembers recording."],
  ["moon-lantern","Moon Lantern","🏮",245,6,"garden","Turns darkness into a useful shade of blue."],
  ["observatory","Pocket Observatory","🔭",290,7,"garden","Studies the moon's listening habits."],
  ["organ-pipes","Garden Organ","🎹",320,7,"garden","Wind-powered experimental theology."],
  ["transmitter","Mini Transmitter","📻",360,8,"garden","Not a licensed over-the-air transmitter."],
  ["mystery-orchard","Impossible Orchard","🌲",420,9,"garden","The trees disagree about whose orchard this is."]
].map(function(row){
  return {id:row[0],name:row[1],icon:row[2],cost:row[3],level:row[4],zone:row[5],lore:row[6],kind:"shop"};
});
const RARE=[
  {id:"merit-spool",name:"The Little Engine Spool",icon:"🧵",zone:"room",lore:"From a completed local catalog check. A verified network task would require a server receipt.",kind:"local"},
  {id:"haunted-needle",name:"Haunted Needle",icon:"🪡",zone:"room",lore:"It refuses to play the same record twice.",kind:"discovery"},
  {id:"accidental-squirrel",name:"Ceramic Squirrel",icon:"🐿️",zone:"garden",lore:"Rare, spectacularly useless.",kind:"discovery"},
  {id:"midnight-rose",name:"Midnight Rose",icon:"🥀",zone:"garden",lore:"Blooms at precisely the wrong hour.",kind:"discovery"},
  {id:"phonograph-moth",name:"Phonograph Moth",icon:"🦋",zone:"garden",lore:"Drawn to the warmer frequency.",kind:"discovery"},
  {id:"impossible-egg",name:"The Improbable Egg",icon:"🥚",zone:"room",lore:"No ornithologist has volunteered to explain it.",kind:"discovery"},
  {id:"blue-moon",name:"Small Blue Moon",icon:"🌙",zone:"garden",lore:"Arrived with the night shift.",kind:"discovery"},
  {id:"broken-compass",name:"Compassionate Compass",icon:"🧭",zone:"room",lore:"Always points toward somebody who needs a hand.",kind:"discovery"},
  {id:"golden-apple",name:"Golden Apple of Static",icon:"🍏",zone:"garden",lore:"Nobody remembers planting the tree.",kind:"discovery"}
];
const ALL=SHOP.concat(RARE);
function id(){return typeof crypto!=="undefined"&&typeof crypto.randomUUID==="function"?crypto.randomUUID():
  String(Date.now())+"-"+Math.random().toString(36).slice(2);}
function fresh(now){
  return {version:VERSION,createdAt:now||Date.now(),lastSeen:now||Date.now(),hum:42,
    earned:42,xp:0,listenSeconds:0,listenCarry:0,xpCarry:0,
    growthHours:0,inventory:[],placements:{},receipts:[],milestones:0,
    lastTrack:"",muted:false};
}
function whole(x,def){return Number.isFinite(x)&&x>=0?Math.floor(x):def}
function item(type){return ALL.find(function(x){return x.id===type})||null}
function normalize(raw,now){
  if(!raw||raw.version!==VERSION)return fresh(now);
  const out=fresh(now);
  for(const k of ["createdAt","lastSeen","hum","earned","xp","listenSeconds","growthHours","milestones"])
    out[k]=whole(raw[k],out[k]);
  for(const k of ["listenCarry","xpCarry"])out[k]=Number.isFinite(raw[k])&&raw[k]>=0?Math.min(raw[k],99):0;
  out.inventory=Array.isArray(raw.inventory)?raw.inventory.slice(0,200).filter(function(u){
    return u&&typeof u.uid==="string"&&u.uid.length<90&&item(u.type)&&typeof u.type==="string";
  }).map(function(u){return {uid:u.uid,type:u.type,origin:typeof u.origin==="string"?u.origin.slice(0,60):"local",at:whole(u.at,now)}}):[];
  const valid=new Set(out.inventory.map(function(u){return u.uid}));
  const used=new Set();
  if(raw.placements&&typeof raw.placements==="object")
    Object.keys(raw.placements).forEach(function(slot){
      const v=raw.placements[slot];
      if(/^[0-7]$/.test(slot)&&valid.has(v)&&!used.has(v)){
        out.placements[slot]=v;used.add(v);
      }
    });
  out.receipts=Array.isArray(raw.receipts)?raw.receipts.slice(-40).filter(function(r){
    return r&&typeof r.id==="string"&&typeof r.hash==="string"&&typeof r.day==="string";
  }).map(function(r){return {id:r.id.slice(0,90),day:r.day.slice(0,10),hash:r.hash.slice(0,64),count:whole(r.count,0),at:whole(r.at,now)}}):[];
  out.lastTrack=typeof raw.lastTrack==="string"?raw.lastTrack.slice(0,90):"";
  return out;
}
function read(store,now){
  try{return normalize(JSON.parse(store.getItem(KEY)),now||Date.now())}catch{return fresh(now||Date.now())}
}
function save(store,state){try{store.setItem(KEY,JSON.stringify(state));return true}catch{return false}}
function threshold(lvl){return 120*Math.pow(Math.max(0,lvl-1),2)}
function level(xp){return 1+Math.floor(Math.sqrt(whole(xp,0)/120))}
function progress(state){
  const lv=level(state.xp),bottom=threshold(lv),top=threshold(lv+1);
  return {level:lv,earned:state.xp-bottom,needed:top-bottom,ratio:(state.xp-bottom)/(top-bottom)};
}
function grow(state,now){
  now=now||Date.now();
  const elapsed=Math.max(0,Math.min(48*3600000,now-state.lastSeen));
  state.growthHours=Math.round((state.growthHours+elapsed/3600000)*100)/100;
  state.lastSeen=now;
  return state;
}
function stage(state){return Math.min(6,Math.floor((level(state.xp)-1)/2)+Math.floor(state.growthHours/24))}
function catalog(){return ALL.slice()}
function owned(state,type){return state.inventory.some(function(u){return u.type===type})}
function unit(type,origin,now){return {uid:id(),type:type,origin:origin,at:now||Date.now()}}
function grant(state,type,origin,now){
  if(!item(type)||owned(state,type))return null;
  const u=unit(type,origin,now);
  state.inventory.push(u);return u;
}
function buy(state,type,now){
  const spec=SHOP.find(function(i){return i.id===type});
  if(!spec)return {ok:false,message:"That object isn't on the shelf."};
  if(level(state.xp)<spec.level)return {ok:false,message:"Reach level "+spec.level+" first."};
  if(owned(state,type))return {ok:false,message:"Already in your collection."};
  if(state.hum<spec.cost)return {ok:false,message:"You need "+(spec.cost-state.hum)+" more HUM."};
  state.hum-=spec.cost;const u=grant(state,type,"shop",now);
  return {ok:true,unit:u,message:spec.name+" joined your collection."};
}
function place(state,uid,slot){
  slot=String(slot);
  if(!/^[0-7]$/.test(slot))return false;
  if(!state.inventory.some(function(u){return u.uid===uid}))return false;
  for(const s of Object.keys(state.placements))if(state.placements[s]===uid)delete state.placements[s];
  state.placements[slot]=uid;return true;
}
function stow(state,uid){
  for(const s of Object.keys(state.placements))if(state.placements[s]===uid)delete state.placements[s];
}
function listen(state,seconds,now){
  const n=Math.max(0,Math.min(5,Number(seconds)||0));
  if(!n)return {hum:0,xp:0,discover:null};
  state.listenSeconds+=n;
  state.listenCarry+=n;state.xpCarry+=n;
  const hum=Math.floor(state.listenCarry/18);
  const xp=Math.floor(state.xpCarry/4);
  state.listenCarry-=hum*18;state.xpCarry-=xp*4;
  state.hum+=hum;state.earned+=hum;state.xp+=xp;
  const current=Math.floor(Math.max(0,state.listenSeconds-240)/720)+1;
  let discover=null;
  if(state.listenSeconds>=240&&current>state.milestones){
    state.milestones=current;
    const options=RARE.filter(function(i){return i.kind==="discovery"&&!owned(state,i.id)});
    if(options.length){
      const selected=options[Math.floor(Math.random()*options.length)];
      discover=grant(state,selected.id,"listening-discovery",now);
    }
  }
  return {hum:hum,xp:xp,discover:discover};
}
function workReward(state,day,hash,count,now){
  if(!/^\d{4}-\d\d-\d\d$/.test(day)||!/^[a-f0-9]{64}$/i.test(hash)||whole(count,0)<1||whole(count,0)>1000)
    return {ok:false,message:"No valid local audit receipt."};
  if(state.receipts.some(function(r){return r.day===day}))
    return {ok:false,message:"Today's local catalog check is already recorded."};
  const receipt={id:id(),day:day,hash:hash.toLowerCase(),count:count,at:now||Date.now()};
  state.receipts.push(receipt);state.receipts=state.receipts.slice(-40);
  state.hum+=28;state.earned+=28;state.xp+=72;
  const gift=grant(state,"merit-spool","local-catalog-audit",now);
  return {ok:true,receipt:receipt,gift:gift,message:"Local check recorded · +28 HUM · +72 XP."};
}
function features(state){
  const l=level(state.xp);
  return [
    {name:"A room of your own",at:1,ready:true},
    {name:"The garden grows",at:2,ready:true},
    {name:"Strange listening discoveries",at:2,ready:true},
    {name:"The Street Team · genuine public-post submissions",at:2,ready:true},
    {name:"The Picture Department · private video submissions",at:3,ready:true},
    {name:"The Bumper Booth · private audio submissions",at:3,ready:true},
    {name:"Your own frequency · personal station seed",at:3,ready:true},
    {name:"The Little Engine · local catalog audit",at:4,ready:true},
    {name:"Bootleg Frequency · advanced backroom tuner",at:6,ready:false},
    {name:"Community music submissions · subject to station review",at:5,ready:true},
    {name:"Machine Shop candidate intake · no node rewards until verified",at:7,ready:true},
    {name:"Visiting other orchards",at:5,ready:false},
    {name:"Verified artifact trading",at:6,ready:false},
    {name:"Shared GHoT work offers",at:7,ready:false},
    {name:"Community orchard",at:8,ready:false}
  ].map(function(f){return {...f,unlocked:l>=f.at&&f.ready}});
}
function snapshot(state){
  return {schema:"humkin.orchard.snapshot/v1",level:level(state.xp),hum:state.hum,
    listenedMinutes:Math.floor(state.listenSeconds/60),growthStage:stage(state),
    artifacts:state.inventory.map(function(u){const i=item(u.type);return {name:i.name,icon:i.icon,origin:u.origin}}),
    note:"Read-only local snapshot. This does not transfer ownership."};
}
return {KEY,VERSION,SHOP,RARE,ALL,catalog,fresh,normalize,read,save,level,threshold,progress,
  grow,stage,item,owned,buy,place,stow,listen,workReward,features,snapshot};
});