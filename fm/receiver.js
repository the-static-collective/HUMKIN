
/* HUMKIN RECEIVER 002 · Physical interface for the existing /fm/ station engine.
 * No second audio engine, fictional broadcast server, or monetized frequencies.
 */
(()=>{'use strict';
const $=(id)=>document.getElementById(id);
const shell=$('receiver-shell'),audio=$('air');
if(!shell||!audio)return;
const station=Object.freeze({band:'FM',frequency:98.2,id:'humkin-main',label:'HUMKIN RADIO'});
const dom={needle:$('receiver-needle'),knob:$('receiver-knob'),tuning:$('receiver-tuning'),
volume:$('receiver-volume'),volumeHardware:$('receiver-volume-hardware'),band:$('receiver-band'),
mono:$('receiver-mono'),boost:$('receiver-boost'),clock:$('receiver-clock'),
shuffle:$('receiver-shuffle'),tune:$('receiver-tunein'),tuneLabel:$('receiver-tunein-label'),
title:$('receiver-current-title'),artist:$('receiver-current-artist'),
art:$('receiver-current-art'),toast:$('receiver-toast'),
workshop:$('receiver-workshop'),workshopDescription:$('receiver-workshop-description')};
const local={frequency:station.frequency,band:'FM',mode:'clock',dragging:false,ready:false};
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
let toastTimer=0,buzzCtx=null,frameQueued=false,focusBeforeDialog=null;
const tuned=()=>local.band===station.band&&Math.abs(local.frequency-station.frequency)<=.55;
function notify(message){
 dom.toast.hidden=false;dom.toast.textContent=message;
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>dom.toast.hidden=true,3100);
}
function fizzle(){
 shell.classList.remove('is-sparking');
 // Force reflow so a second rapid attempt produces a visible spark.
 void shell.offsetWidth;shell.classList.add('is-sparking');
 setTimeout(()=>shell.classList.remove('is-sparking'),390);
 try{
  const AudioContext=window.AudioContext||window.webkitAudioContext;
  if(!AudioContext)return;
  const ctx=new AudioContext(),osc=ctx.createOscillator(),gain=ctx.createGain();
  buzzCtx=ctx;osc.type='sawtooth';osc.frequency.setValueAtTime(122,ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(38,ctx.currentTime+.17);
  gain.gain.setValueAtTime(.0001,ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(.032,ctx.currentTime+.009);
  gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.19);
  osc.connect(gain).connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.19);
  osc.onended=()=>ctx.close().catch(()=>{});
 }catch(e){/* Audio feedback is decorative and optional. */}
}
function openWorkshop(description){
 fizzle();
 focusBeforeDialog=document.activeElement;
 dom.workshopDescription.textContent=description;
 dom.workshop.hidden=false;
 $('receiver-workshop-close').focus();
}
function closeWorkshop(){
 dom.workshop.hidden=true;
 if(focusBeforeDialog&&typeof focusBeforeDialog.focus==='function')focusBeforeDialog.focus();
}
$('receiver-workshop-close').addEventListener('click',closeWorkshop);
$('receiver-workshop-dismiss').addEventListener('click',closeWorkshop);
dom.workshop.addEventListener('click',e=>{if(e.target===dom.workshop)closeWorkshop()});
document.addEventListener('keydown',e=>{
 if(dom.workshop.hidden)return;
 if(e.key==='Escape'){e.preventDefault();closeWorkshop()}
 if(e.key==='Tab'){
  const controls=[...dom.workshop.querySelectorAll('button,a')].filter(n=>!n.disabled);
  if(!controls.length)return;
  const first=controls[0],last=controls[controls.length-1];
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
 }
});
function setFrequency(value,announce=false){
 const prev=local.frequency;
 local.frequency=+clamp(Math.round(value*10)/10,88,108).toFixed(1);
 const ratio=(local.frequency-88)/20;
 dom.needle.style.left=(ratio*100)+'%';
 dom.knob.style.transform='rotate('+((local.frequency-98.2)*13)+'deg)';
 dom.tuning.setAttribute('aria-valuenow',String(local.frequency));
 dom.tuning.setAttribute('aria-valuetext',local.frequency.toFixed(1)+' virtual FM');
 shell.classList.toggle('is-out-of-range',!tuned());
 if(!tuned()&&!audio.paused)audio.pause();
 if(prev!==local.frequency||announce)queueSync();
}
function angleToFrequency(e){
 const box=dom.tuning.getBoundingClientRect();
 const x=e.clientX-box.left-box.width/2,y=e.clientY-box.top-box.height/2;
 // 280-degree physical movement, with a 80-degree dead zone at the bottom.
 const angle=Math.atan2(x,-y)*180/Math.PI;
 return 88+(clamp(angle,-140,140)+140)/280*20;
}
dom.tuning.addEventListener('pointerdown',e=>{
 if(!dom.workshop.hidden)return;
 e.preventDefault();local.dragging=true;
 dom.tuning.setPointerCapture&&dom.tuning.setPointerCapture(e.pointerId);
 setFrequency(angleToFrequency(e));
});
dom.tuning.addEventListener('pointermove',e=>{if(local.dragging)setFrequency(angleToFrequency(e))});
function endDrag(){
 if(!local.dragging)return;local.dragging=false;
 if(tuned()){notify('✳ HUMKIN RADIO • '+station.frequency.toFixed(1)+' VIRTUAL FM')}
 else openWorkshop('This virtual frequency does not have a transmitter yet. Listeners will be able to build stations in the community workshop.');
}
dom.tuning.addEventListener('pointerup',endDrag);
dom.tuning.addEventListener('pointercancel',()=>{local.dragging=false});
dom.tuning.addEventListener('keydown',e=>{
 const delta=(e.key==='ArrowRight'||e.key==='ArrowUp')?.2:(e.key==='ArrowLeft'||e.key==='ArrowDown')?-.2:0;
 if(delta){e.preventDefault();setFrequency(local.frequency+delta,true)}
 if(e.key==='Home'){e.preventDefault();setFrequency(88,true)}
 if(e.key==='End'){e.preventDefault();setFrequency(108,true)}
 if(e.key==='Enter'||e.key===' '){e.preventDefault();if(!tuned())openWorkshop('The community has not built this frequency yet.')}
});
dom.tuning.addEventListener('wheel',e=>{e.preventDefault();setFrequency(local.frequency+(e.deltaY<0?.2:-.2),true)},{passive:false});
dom.tuning.addEventListener('keyup',e=>{if(['ArrowRight','ArrowLeft','ArrowUp','ArrowDown','Home','End'].includes(e.key)&&!tuned())notify('ϟ NO TRANSMITTER · '+local.frequency.toFixed(1))});
dom.band.addEventListener('click',()=>{
 if(local.band==='FM'){
  local.band='AM';dom.band.classList.add('is-down');dom.band.setAttribute('aria-pressed','true');
  dom.band.setAttribute('aria-label','Switch to FM modern HUMKIN band');
  if(!audio.paused)audio.pause();
  openWorkshop('The AM archive band is a future shared construction project. Its recordings and broadcast permissions must be collected and verified first.');
 }else{
  local.band='FM';dom.band.classList.remove('is-down');dom.band.setAttribute('aria-pressed','false');
  dom.band.setAttribute('aria-label','Switch to AM archive band (under construction)');
  notify('✳ FM · BACK TO THE MODERN BAND');
 }
 queueSync();
});
dom.mono.addEventListener('click',()=>openWorkshop('The stereo/mono monitor circuit is not yet wired. Until it is built, the original recording plays without signal processing.'));
dom.boost.addEventListener('click',()=>openWorkshop('Signal boost needs a real receiver signal chain. It will unlock when the community completes the circuit.'));
$('receiver-signal').addEventListener('click',()=>{
 const status=$('station-status')?.textContent?.trim()||'CHECKING';
 notify((audio.paused?'○ RECEIVER STANDBY':'● RADIO RECEIVING')+' · '+status);
});
function applyMode(mode){
 const original=$(mode==='clock'?'mode-clock':'mode-shuffle');
 if(!original||original.disabled){notify('THE RADIO ENGINE IS STILL GETTING ITS RECORDS TOGETHER');return}
 original.click();local.mode=mode;queueSync();
}
dom.clock.addEventListener('click',()=>applyMode('clock'));
dom.shuffle.addEventListener('click',()=>applyMode('shuffle'));
dom.tune.addEventListener('click',()=>{
 if(!tuned()){
  openWorkshop(local.band==='AM'?'AM needs an archival recording library and a real station channel. The workshop has not built it yet.':'There is no transmitter at '+local.frequency.toFixed(1)+' in the HUMKIN virtual station network. Help build one at the workshop.');
  return;
 }
 const delegate=$('listen');
 if(!delegate||delegate.disabled){notify('✳ THE RADIO ENGINE IS STILL TUNING UP');return}
 delegate.click();
 queueSync();
});
function setVolume(n){
 const v=clamp(Number(n),0,100);
 audio.volume=v/100;
 dom.volume.value=String(Math.round(v));
 dom.volumeHardware.style.transform='rotate('+(-130+260*v/100)+'deg)';
 try{localStorage.setItem('humkin.receiver.volume.v1',String(v))}catch(e){}
}
dom.volume.addEventListener('input',e=>setVolume(e.target.value));
try{const stored=localStorage.getItem('humkin.receiver.volume.v1');if(stored!==null&&Number.isFinite(+stored))setVolume(+stored);else setVolume(75)}
catch(e){setVolume(75)}
function sync(){
 frameQueued=false;
 const engineButton=$('listen');
 local.ready=Boolean(engineButton&&!engineButton.disabled);
 const paused=audio.paused;
 shell.classList.toggle('is-playing',!paused);
 dom.tune.disabled=!local.ready;
 dom.tuneLabel.textContent=!local.ready?'WARMING UP':!paused?'PAUSE RADIO':'TUNE IN';
 dom.tune.setAttribute('aria-label',!local.ready?'Radio engine loading':!paused?'Pause HUMKIN Radio':'Tune in to HUMKIN Radio');
 const clock=$('mode-clock'),shuffle=$('mode-shuffle');
 if(clock&&!clock.disabled&&shuffle&&!shuffle.disabled){
  local.mode=clock.getAttribute('aria-pressed')==='true'?'clock':shuffle.getAttribute('aria-pressed')==='true'?'shuffle':local.mode;
 }
 dom.clock.classList.toggle('receiver-mode-active',local.mode==='clock');
 dom.shuffle.classList.toggle('receiver-mode-active',local.mode==='shuffle');
 dom.clock.setAttribute('aria-pressed',String(local.mode==='clock'));
 dom.shuffle.setAttribute('aria-pressed',String(local.mode==='shuffle'));
 const title=$('current-title')?.textContent?.trim()||'FINDING A SONG…';
 const artist=$('current-artist')?.textContent?.trim()||'HUMKIN · RADIO';
 dom.title.textContent=tuned()?title:(local.band==='AM'?'ARCHIVE UNBUILT':'NO STATION YET');
 dom.artist.textContent=tuned()?artist:'✳  VISIT THE WORKSHOP';
 const cover=$('current-art');
 if(cover&&cover.src&&dom.art.src!==cover.src)dom.art.src=cover.src;
}
function queueSync(){
 if(frameQueued)return;frameQueued=true;
 (window.requestAnimationFrame||((f)=>setTimeout(f,16)))(sync);
}
const observeIds=['current-title','current-artist','current-art','listen','mode-clock','mode-shuffle','station-status'];
const observer=new MutationObserver(queueSync);
observeIds.forEach(id=>{
 const el=$(id);if(el)observer.observe(el,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['disabled','src','aria-pressed']});
});
['play','playing','pause','ended','error','waiting','canplay','stalled'].forEach(event=>audio.addEventListener(event,queueSync));
setFrequency(station.frequency);
queueSync();
})();
