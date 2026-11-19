/* HUMKIN Orchard Gambits 001 — deterministic, LOCAL-ONLY programming suggestions.
 * Ordered conditional radio selection, inspired by classic priority-rule RPGs.
 * It cannot submit to Guilds, spend HUM, mint server XP, or command any transmitter.
 */
(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  root.HumkinGambits=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
const KEY="humkin-orchard-gambits-v1",HISTORY_KEY="humkin-orchard-gambit-draft-history-v1",SCHEMA="humkin.gambits.local/v1";
const CONDITIONS=Object.freeze([
  ["unheard","If a song has not appeared in a prior Gambit draft"],
  ["new-album","If another album is available"],
  ["night","If it is evening or night"],
  ["short","If a short recording is available"],
  ["always","Otherwise (fallback)"]
]);
const ACTIONS=Object.freeze([
  ["least-played","Choose the least used in my Gambit drafts"],
  ["different-album","Choose another album"],
  ["shortest","Choose the shortest"],
  ["longest","Choose the longest"],
  ["surprise","Choose a surprise"]
]);
const CONDITIONS_SET=new Set(CONDITIONS.map(x=>x[0]));
const ACTIONS_SET=new Set(ACTIONS.map(x=>x[0]));
const STARTER=[
 {when:"unheard",action:"least-played",enabled:true},
 {when:"new-album",action:"different-album",enabled:true},
 {when:"always",action:"surprise",enabled:true}
];
const STAGES=Object.freeze([
 {key:"receiver",name:"Receiver",level:1,ability:"Hear the dial, discover music, learn how Gambits work",kind:"local"},
 {key:"tuner",name:"Tuner",level:3,ability:"Edit your personal conditional radio rules and publish a three-song Signal link",kind:"local"},
 {key:"archivist",name:"Archivist / Contributor",level:4,ability:"Expand your rules and submit voluntary Guild work for review",kind:"local-and-reviewed"},
 {key:"bootleg",name:"Bootleg Frequency",level:7,ability:"Build deeper personal experimental mixes",kind:"local"},
 {key:"producer",name:"Producer",level:null,ability:"Submit proposed station programming, automation and creative work",kind:"server-verified"},
 {key:"operator",name:"Station Operator",level:null,ability:"Operate a station only when server-authorized for that frequency",kind:"server-authorized"},
 {key:"founder",name:"Network Founder",level:null,ability:"Manage separately authorized stations, crews, and programming policies",kind:"server-authorized"}
]);
function slotsForLevel(level){
 const n=Number.isFinite(level)?Math.floor(level):1;
 return n>=9?8:n>=7?6:n>=4?4:n>=3?3:0;
}
function cleanRule(raw){
 if(!raw||typeof raw!=="object")return null;
 if(!CONDITIONS_SET.has(raw.when)||!ACTIONS_SET.has(raw.action))return null;
 return {when:raw.when,action:raw.action,enabled:raw.enabled!==false};
}
function normalizeRules(input,level=3){
 const max=slotsForLevel(level);
 if(max===0)return STARTER.slice(0,2).map(cleanRule);
 const inputRows=Array.isArray(input)?input:STARTER;
 const rules=inputRows.slice(0,max).map(cleanRule).filter(Boolean);
 return rules.length?rules:STARTER.slice(0,max).map(cleanRule);
}
function safeCatalog(raw){
 if(!Array.isArray(raw))return [];
 const seen=new Set();
 return raw.slice(0,1000).filter(t=>{
   if(!t||typeof t.id!=="string"||!/^[-_a-zA-Z0-9]{1,90}$/.test(t.id)||seen.has(t.id)||
      typeof t.title!=="string"||!t.title.trim()||typeof t.src!=="string"||!t.src)return false;
   seen.add(t.id);return true;
 }).map(t=>({id:t.id,title:t.title.trim().slice(0,160),
    artist:String(t.artist||"HUMKIN").slice(0,160),
    album:String(t.album||"").slice(0,160),
    src:t.src,duration:Number.isFinite(t.duration)?Math.max(0,t.duration):0}));
}
function asCount(reads,id){
 if(!reads||typeof reads!=="object")return 0;
 const n=reads[id];return Number.isFinite(n)&&n>=0?Math.min(1000000,Math.floor(n)):0;
}
function targets(when,pool,history,hour,reads){
 const latest=history.length?history[history.length-1]:null;
 switch(when){
 case "unheard":return pool.filter(t=>asCount(reads,t.id)===0&&!history.some(x=>x.id===t.id));
 case "new-album":return latest?pool.filter(t=>t.album!==latest.album):[];
 case "night":return hour>=19||hour<6?pool:[];
 case "short":return pool.filter(t=>t.duration>0&&t.duration<=180);
 case "always":return pool;
 default:return [];
 }
}
function select(action,pool,history,reads,roll){
 const last=history[history.length-1];
 let options=pool;
 if(action==="different-album"&&last){
   const others=pool.filter(t=>t.album!==last.album);
   if(others.length)options=others;
 }
 if(action==="least-played")return options.slice().sort((a,b)=>
   asCount(reads,a.id)-asCount(reads,b.id) || a.id.localeCompare(b.id))[0];
 if(action==="shortest")return options.slice().sort((a,b)=>
   (a.duration||Infinity)-(b.duration||Infinity)||a.id.localeCompare(b.id))[0];
 if(action==="longest")return options.slice().sort((a,b)=>b.duration-a.duration||a.id.localeCompare(b.id))[0];
 const random=Number.isFinite(roll)?Math.max(0,Math.min(.99999999,roll)):.5;
 return options[Math.floor(random*options.length)];
}
/* The first matching enabled rule wins. Each selection is from the validated
 * published catalog. No network call, broadcast write, or implicit player play.
 */
function propose(rawCatalog,rawRules,opts={}){
 const catalog=safeCatalog(rawCatalog);
 const rules=normalizeRules(rawRules,opts.level??3);
 const length=Math.min(3,Math.max(1,Number.isFinite(opts.length)?Math.floor(opts.length):3));
 const reads=opts.reads&&typeof opts.reads==="object"?opts.reads:{};
 const hour=Number.isInteger(opts.hour)?Math.min(23,Math.max(0,opts.hour)):12;
 const history=[],receipts=[];
 const rng=typeof opts.random==="function"?opts.random:()=>.5;
 for(let pos=0;pos<length&&history.length<catalog.length;pos++){
   const pool=catalog.filter(t=>!history.some(h=>h.id===t.id));
   let chosen=null,ruleIndex=-1,applied="fallback";
   for(let i=0;i<rules.length;i++){
     const rule=rules[i];
     if(!rule.enabled)continue;
     const available=targets(rule.when,pool,history,hour,reads);
     if(!available.length)continue;
     chosen=select(rule.action,available,history,reads,rng());
     ruleIndex=i;
     applied=rule.when+" → "+rule.action;
     break;
   }
   if(!chosen){
     chosen=select("least-played",pool,history,reads,.5);
     applied="safe catalog fallback (no matching Gambit)";
   }
   if(!chosen)break;
   history.push(chosen);
   receipts.push({position:pos+1,trackId:chosen.id,ruleIndex,
     detail:applied,reason:"local suggestion; no public programming altered"});
 }
 return {tracks:history,receipts,mode:"personal-signal-preview",authority:"local-only"};
}
return Object.freeze({KEY,HISTORY_KEY,SCHEMA,CONDITIONS,ACTIONS,STAGES,STARTER,
  slotsForLevel,cleanRule,normalizeRules,safeCatalog,propose});
});
