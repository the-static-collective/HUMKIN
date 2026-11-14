/* Local-only producer UI, no remote writes, secrets, autoplay, or station effects. */
(async function(){
'use strict';
const M=window.HUMKIN_LIVING,KEY='humkin.living-desk/v0.1';
const $=id=>document.getElementById(id),catalog=[],ids=new Set();
let state=M.empty();
const now=()=>new Date().toISOString();
const uid=()=>globalThis.crypto?.randomUUID?.()||'card-'+Date.now()+'-'+Math.random().toString(36).slice(2);
function say(s){$('message').textContent=s}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){say('Local storage unavailable; export a backup instead.')}}
function el(tag,text,cls){const x=document.createElement(tag);if(text!==undefined&&text!==null)x.textContent=String(text);if(cls)x.className=cls;return x}
function button(label,handler){const x=el('button',label);x.type='button';x.addEventListener('click',handler);return x}
function download(filename,data){const blob=new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function writeCard(next){const index=state.cards.findIndex(c=>c.id===next.id);if(index<0)throw Error('Card not found');state.cards[index]=next;save();render()}
function human(action,card){
  const by=window.prompt('Operator / reviewer name for '+action+':');if(!by?.trim())return;
  try{
    if(action==='air'){
      if(!window.confirm('Confirm this segment ACTUALLY aired? A prepared playlist is NOT proof of broadcast.'))return;
      const exact=window.prompt('Actual broadcast time (ISO timestamp; edit if needed):',now());if(!exact)return;
      writeCard(M.change(card,'air',{by,at:exact,confirmed:true}));
    }else if(action==='return'){
      const note=window.prompt('What actually came back? Evidence or an honest human observation:');if(!note?.trim())return;
      const verdict=window.prompt('Human verdict: keep, weird, or compost:','weird');if(!verdict)return;
      writeCard(M.change(card,'return',{by,at:now(),note,verdict:verdict.toLowerCase().trim()}));
    }else writeCard(M.change(card,action,{by,at:now()}));
  }catch(e){say(e.message)}
}
function addCard(card){const node=el('article');node.append(el('span',card.status,'status'),el('p',card.firstTitle+' ⇄ '+card.secondTitle));
 const tags=el('p');for(const v of [card.relation,card.mode])tags.append(el('span',v,'badge'));
 node.append(tags,el('p',card.reason));if(card.parentId)node.append(el('p','Re-opened from '+card.parentId,'small'));
 if(card.reviewedBy)node.append(el('p','Reviewed by '+card.reviewedBy,'small'));
 if(card.airedAt)node.append(el('p','Confirmed air: '+card.airedAt+' · '+card.airedBy,'small'));
 if(card.returnNote)node.append(el('p',card.verdict.toUpperCase()+': '+card.returnNote,'small'));
 const actions=el('div');
 if(['draft','hold'].includes(card.status))actions.append(button('MARK READY',()=>human('ready',card)));
 if(['draft','ready'].includes(card.status))actions.append(button('HOLD',()=>human('hold',card)));
 if(card.status==='ready')actions.append(button('CONFIRM ACTUAL AIR',()=>human('air',card)));
 if(card.status==='aired')actions.append(button('LOG RETURN',()=>human('return',card)));
 if(['aired','returned'].includes(card.status))actions.append(button('RE-OPEN AS DRAFT',()=>{
   try{const copy=M.reopen(card,catalog,uid(),now());state.cards.push(copy);save();render()}catch(e){say(e.message)}
 }));
 node.append(actions);return node;
}
function render(){const list=$('cards');list.replaceChildren();
 for(const card of [...state.cards].reverse())list.append(addCard(card));
 if(!state.cards.length)list.append(el('p','No producer cards yet. Select two songs to begin.'));
 const mem=M.memory(state.cards);
 $('memory').textContent=mem.witnessedAirs+' confirmed on-air card(s), '+mem.preparedNotAired+' not aired. '+
   'Witnessed relationships: '+Object.entries(mem.relationCounts).filter(([,n])=>n>0).map(([k,n])=>k+' '+n).join(' · ').concat(mem.witnessedAirs?'': 'none yet.')+
   ' Human returns — KEEP '+mem.explicitVerdicts.keep+', WEIRD '+mem.explicitVerdicts.weird+', COMPOST '+mem.explicitVerdicts.compost+'.';
}
try{
 const response=await fetch('../rotation.json',{cache:'no-store'});if(!response.ok)throw Error('Catalog could not be loaded');
 const data=await response.json();if(!Array.isArray(data.tracks))throw Error('Invalid track catalog');
 for(const t of data.tracks){if(ids.has(t.id))throw Error('Duplicate catalog recording ID');ids.add(t.id);catalog.push({id:t.id,title:t.title,artist:t.artist,album:t.album})}
 for(const field of ['first','second'])for(const t of catalog){const option=document.createElement('option');option.value=t.id;option.textContent=t.title+' · '+t.album;$(field).append(option)}
 if(catalog.length>1)$('second').selectedIndex=1;
 const existing=localStorage.getItem(KEY);if(existing)state=M.validate(JSON.parse(existing),catalog);
 render();say('Catalog ready · '+catalog.length+' source recordings. No broadcast changes.');
}catch(e){say('Producer desk could not load: '+e.message);$('draft').disabled=true;return}
$('draft').addEventListener('click',()=>{try{
 const card=M.makeDraft({firstId:$('first').value,secondId:$('second').value,
   mode:$('mode').value,relation:$('relation').value,reason:$('reason').value},catalog,uid(),now());
 state.cards.push(card);save();$('reason').value='';render();say('Draft preserved locally — not ready, not aired.');
}catch(e){say(e.message)}});
$('export').addEventListener('click',()=>download('humkin-living-desk.json',state));
$('rundown').addEventListener('click',()=>{const pack=M.rundown(state.cards);download('humkin-proposed-rundown.json',pack);say('Proposed rundown: '+pack.cards.length+' human-reviewed READY card(s); no station action.')});
$('import').addEventListener('change',async(e)=>{const file=e.target.files?.[0];if(!file)return;
 try{if(file.size>1500000)throw Error('Import exceeds 1.5 MB');const imported=M.validate(JSON.parse(await file.text()),catalog);
 if(!window.confirm('Replace this browser\'s current desk with '+imported.cards.length+' imported cards? Export a backup first.'))return;
 state=imported;save();render();say('Local desk restored. No remote data was sent.');
 }catch(err){say('Restore refused: '+err.message)}finally{e.target.value=''}});
})();
