/* HUMKIN RADIO — Living Discography producer state. No network or broadcast effects.
 * Kinship-inspired: prepare != aired; observation != interpretation != proposal.
 */
(function(root){
'use strict';
const SCHEMA='humkin.living-desk/v0.1';
const MODES=['observation','interpretation','proposal'];
const LINKS=['echo','answer','contrast','reprise','sequence','other'];
const VERDICTS=['keep','weird','compost'];
function requireText(v,label,max=1000){
  if(typeof v!=='string'||!v.trim()||v.length>max)throw Error(label+' is required (max '+max+' characters)');
  return v.trim();
}
function tracksById(tracks){
  if(!Array.isArray(tracks))throw Error('Missing source catalog');
  return new Map(tracks.filter(t=>typeof t.id==='string'&&typeof t.title==='string').map(t=>[t.id,t]));
}
function empty(){return {schema:SCHEMA,cards:[]};}
function makeDraft({firstId,secondId,mode,relation,reason},tracks,id,at){
  const catalog=tracksById(tracks);
  if(!catalog.has(firstId)||!catalog.has(secondId)||firstId===secondId)throw Error('Choose two distinct real recordings');
  if(!MODES.includes(mode)||!LINKS.includes(relation))throw Error('Choose valid interpretation and relationship');
  return {id:requireText(id,'Card ID',120),createdAt:requireText(at,'Creation timestamp',50),
    status:'draft',firstId,secondId,firstTitle:catalog.get(firstId).title,secondTitle:catalog.get(secondId).title,
    mode,relation,reason:requireText(reason,'Your reason',2000),parentId:null,
    events:[{action:'draft',at,by:'local operator'}]};
}
function change(card,action,{by,at,note='',confirmed=false,verdict=null}={}){
  if(!card||typeof card!=='object')throw Error('Missing card');
  const allowed={ready:['draft','hold'],hold:['draft','ready'],air:['ready'],return:['aired'],reopen:['aired','returned']};
  if(!allowed[action]?.includes(card.status))throw Error('Not a permitted transition from '+card.status+' to '+action);
  const agent=requireText(by,'Human operator',100),when=requireText(at,'Action time',50);
  if(!Number.isFinite(Date.parse(when)))throw Error('Invalid action date');
  const next=JSON.parse(JSON.stringify(card));
  if(action==='ready'){
    next.status='ready';next.reviewedBy=agent;
  }else if(action==='hold')next.status='hold';
  else if(action==='air'){
    if(confirmed!==true)throw Error('Aired requires a human confirmation of actual broadcast');
    next.status='aired';next.airedAt=when;next.airedBy=agent;
  }else if(action==='return'){
    if(!VERDICTS.includes(verdict))throw Error('Choose KEEP, WEIRD or COMPOST');
    next.status='returned';next.verdict=verdict;next.returnNote=requireText(note,'Actual return note',2000);
  }
  next.events.push({action,at:when,by:agent,note:String(note||'').slice(0,2000),...(verdict?{verdict}:{})});
  return next;
}
function reopen(card,tracks,id,at){
  if(!['aired','returned'].includes(card?.status))throw Error('Only witnessed air can be reopened');
  const copy=makeDraft({firstId:card.firstId,secondId:card.secondId,mode:card.mode,relation:card.relation,
    reason:'Prior wording is history, not current truth. Re-check the sources. Previous card: '+card.id},tracks,id,at);
  copy.parentId=card.id;return copy;
}
function isWitnessed(card){return card?.status==='aired'||card?.status==='returned';}
function memory(cards){
 const witnessed=cards.filter(isWitnessed);
 const relationCounts=Object.fromEntries(LINKS.map(kind=>[kind,witnessed.filter(c=>c.relation===kind).length]));
 return {witnessedAirs:witnessed.length,preparedNotAired:cards.length-witnessed.length,
   relationCounts,latestAiredIds:witnessed.slice(-5).map(c=>c.id),
   explicitVerdicts:Object.fromEntries(VERDICTS.map(v=>[v,witnessed.filter(c=>c.verdict===v).length]))};
}
function rundown(cards){
 return {schema:'humkin.producer-rundown/v0.1',status:'proposal_not_broadcast',
  assembledAt:new Date().toISOString(),cards:cards.filter(c=>c.status==='ready').map((c,i)=>({
    order:i+1,id:c.id,sources:[{id:c.firstId,title:c.firstTitle},{id:c.secondId,title:c.secondTitle}],
    mode:c.mode,relationship:c.relation,producerNotes:c.reason,reviewedBy:c.reviewedBy,
    broadcastingAuthorized:false}))};
}
function validate(state,tracks){
 if(!state||state.schema!==SCHEMA||!Array.isArray(state.cards)||state.cards.length>500)throw Error('Not a HUMKIN Living Desk export');
 const catalog=tracksById(tracks),seen=new Set();
 for(const card of state.cards){
   if(!card||!['draft','ready','hold','aired','returned'].includes(card.status)||
     !LINKS.includes(card.relation)||!MODES.includes(card.mode)||
     !catalog.has(card.firstId)||!catalog.has(card.secondId)||card.firstId===card.secondId||
     typeof card.id!=='string'||!card.id||seen.has(card.id)||
     typeof card.reason!=='string'||card.reason.length>2000||
     !Array.isArray(card.events)||card.events.length>100)throw Error('Invalid or unresolvable card in export');
   if(['ready','aired','returned'].includes(card.status)&&!card.reviewedBy)throw Error('Ready card lacks human reviewer');
   if(isWitnessed(card)&&(!card.airedAt||!card.airedBy||!card.events.some(e=>e.action==='air')))throw Error('Aired card lacks witness');
   if(card.status==='returned'&&(!VERDICTS.includes(card.verdict)||!card.returnNote))throw Error('Returned card lacks verdict');
   seen.add(card.id);
 }
 return JSON.parse(JSON.stringify(state));
}
const api=Object.freeze({SCHEMA,MODES,LINKS,VERDICTS,empty,makeDraft,change,reopen,memory,rundown,validate});
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.HUMKIN_LIVING=api;
})(typeof window!=='undefined'?window:globalThis);
