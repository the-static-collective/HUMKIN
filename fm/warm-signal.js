/* HUMKIN RADIO — WARM SIGNAL. A non-destructive analogue atmosphere layer.
 *
 * Important: NEVER connect the HTMLMediaElement to a MediaElementAudioSourceNode.
 * It can mute cross-origin MP3s without valid CORS, and would risk breaking
 * background playback. The music's actual stereo channels are left untouched.
 * Noise/pops have real stereo width, with brief mono-centered signal fades and
 * a gentle temporary playback-volume sag for the "tuning" impression.
 *
 * Starts after a listening gesture; defaults to the station's 42% texture. No uploads.
 */
(function(root){
"use strict";
const SAVE_KEY="humkin-warm-signal-intensity-v1";
function clamp(v,min,max){
 const n=Number(v);
 return Number.isFinite(n)?Math.max(min,Math.min(max,n)):min;
}
function intervalSeconds(random,intensity){
 const amount=clamp(intensity,0,100)/100;
 return 7 + random()*Math.max(8,27-14*amount);
}
function noiseGain(intensity){
 const p=clamp(intensity,0,100)/100;
 return .004+Math.pow(p,1.35)*.085;
}
class WarmSignal{
 constructor(media,options={}){
  this.media=media;
  this.win=options.window||root;
  this.enabled=false;this.playing=false;
  this.intensity=clamp(options.intensity??42,0,100);
  this.ctx=null;this.noise=null;this.gain=null;this.merger=null;
  this.widthNodes=[];this.timer=null;this.restoreTimer=null;
  this.baseVolume=Number.isFinite(media.volume)?media.volume:1;
  this.internalVolume=this.baseVolume;
  this.onchange=()=>{};
  media.addEventListener?.("volumechange",()=>{
   const now=media.volume;
   if(Math.abs(now-this.internalVolume)>.015){
    this.baseVolume=clamp(now,0,1);
    this.internalVolume=now;
   }
  });
 }
 setIntensity(value){
  this.intensity=clamp(value,0,100);
  if(this.enabled)this.applyGain();
 }
 status(){
  return {enabled:this.enabled,playing:this.playing,
    intensity:this.intensity,webAudio:!!this.ctx};
 }
 makeNoise(){
  const ctx=this.ctx;
  const length=Math.max(1,Math.round(ctx.sampleRate*1.8));
  const buffer=ctx.createBuffer(2,length,ctx.sampleRate);
  for(let channel=0;channel<2;channel++){
   const samples=buffer.getChannelData(channel);
   let colored=0;
   for(let i=0;i<length;i++){
    const white=Math.random()*2-1;
    colored=colored*.96+white*.04;
    samples[i]=white*.58+colored*.8;
   }
  }
  const source=ctx.createBufferSource();source.buffer=buffer;source.loop=true;
  const split=ctx.createChannelSplitter(2);
  const merge=ctx.createChannelMerger(2);
  // Two channels of noise gradually collapse to mono during a fading "signal".
  const directL=ctx.createGain(),directR=ctx.createGain();
  const crossL=ctx.createGain(),crossR=ctx.createGain();
  source.connect(split);
  split.connect(directL,0);directL.connect(merge,0,0);
  split.connect(crossL,0);crossL.connect(merge,0,1);
  split.connect(directR,1);directR.connect(merge,0,1);
  split.connect(crossR,1);crossR.connect(merge,0,0);
  this.widthNodes=[directL,directR,crossL,crossR];
  this.noise=source;
  const high=ctx.createBiquadFilter();high.type="highpass";high.frequency.value=135;
  const low=ctx.createBiquadFilter();low.type="lowpass";low.frequency.value=3400;
  this.gain=ctx.createGain();this.gain.gain.value=0;
  merge.connect(high);high.connect(low);low.connect(this.gain);
  this.gain.connect(ctx.destination);
  source.start();
  this.setWidth(1);
 }
 setWidth(value){
  if(!this.ctx||this.widthNodes.length!==4)return;
  const width=clamp(value,0,1),now=this.ctx.currentTime;
  const direct=(1+width)/2,cross=(1-width)/2;
  for(let i=0;i<4;i++){
   const amount=i<2?direct:cross;
   this.widthNodes[i].gain.setTargetAtTime(amount,now,.055);
  }
 }
 applyGain(){
  if(!this.gain||!this.ctx)return;
  const volume=this.enabled&&this.playing?noiseGain(this.intensity):0;
  this.gain.gain.setTargetAtTime(volume,this.ctx.currentTime,.14);
 }
 setPlayback(playing){
  this.playing=!!playing;
  this.applyGain();
 }
 setVolume(value){
  try{
   this.internalVolume=clamp(value,0,1);
   this.media.volume=this.internalVolume;
  }catch{} // iOS and some Android browsers do not expose volume adjustment.
 }
 sag(){
  if(!this.enabled||!this.playing||this.restoreTimer)return;
  const center=0.80+Math.random()*.13;
  this.setWidth(0);
  this.setVolume(this.baseVolume*center);
  this.restoreTimer=this.win.setTimeout(()=>{
   this.restoreTimer=null;
   this.setWidth(1);
   this.setVolume(this.baseVolume);
  },140+Math.random()*220);
 }
 pop(){
  if(!this.ctx||!this.enabled||!this.playing)return;
  const ctx=this.ctx,now=ctx.currentTime;
  const frames=Math.max(40,Math.round(ctx.sampleRate*(.007+Math.random()*.012)));
  const buffer=ctx.createBuffer(1,frames,ctx.sampleRate);
  const values=buffer.getChannelData(0);
  for(let i=0;i<frames;i++)values[i]=(Math.random()*2-1)*Math.pow(1-i/frames,3);
  const src=ctx.createBufferSource();src.buffer=buffer;
  const high=ctx.createBiquadFilter();high.type="highpass";high.frequency.value=350;
  const g=ctx.createGain();
  const level=(.012+this.intensity/100*.055)*(.4+Math.random()*.55);
  g.gain.setValueAtTime(level,now);
  g.gain.exponentialRampToValueAtTime(.0001,now+frames/ctx.sampleRate);
  src.connect(high);high.connect(g);g.connect(ctx.destination);
  src.onended=()=>{src.disconnect();high.disconnect();g.disconnect()};
  src.start(now);src.stop(now+frames/ctx.sampleRate);
 }
 queue(){
  if(this.timer!==null){this.win.clearTimeout(this.timer);this.timer=null}
  if(!this.enabled)return;
  const delay=intervalSeconds(Math.random,this.intensity)*1000;
  this.timer=this.win.setTimeout(()=>{
   this.timer=null;
   if(this.enabled&&this.playing){
    if(Math.random()<.78)this.pop();
    if(Math.random()<(.17+this.intensity/100*.28))this.sag();
   }
   this.queue();
  },delay);
 }
 async enable(){
  if(this.enabled)return true;
  const AudioCtor=this.win.AudioContext||this.win.webkitAudioContext;
  if(!AudioCtor)throw Error("This browser cannot make a warm-signal audio layer.");
  // An AudioContext can only begin on a user-initiated click on mobile.
  try{
   if(!this.ctx){
    this.ctx=new AudioCtor();
    this.makeNoise();
   }
   if(this.ctx.state==="suspended")await this.ctx.resume();
   this.enabled=true;this.applyGain();this.queue();this.onchange();
   return true;
  }catch(err){
   this.enabled=false;this.setPlayback(false);
   this.setVolume(this.baseVolume);
   this.onchange();
   throw err;
  }
 }
 disable(){
  this.enabled=false;
  if(this.timer!==null){this.win.clearTimeout(this.timer);this.timer=null}
  if(this.restoreTimer!==null){this.win.clearTimeout(this.restoreTimer);this.restoreTimer=null}
  this.setWidth(1);
  this.setVolume(this.baseVolume);
  this.applyGain();
  this.onchange();
 }
 toggle(){return this.enabled?(this.disable(),Promise.resolve(false)):this.enable()}
 destroy(){
  this.disable();
  try{this.noise?.stop()}catch{}
  try{this.noise?.disconnect()}catch{}
  if(this.ctx){this.ctx.close().catch?.(()=>{});this.ctx=null}
 }
}
const api=Object.freeze({WarmSignal,clamp,intervalSeconds,noiseGain,SAVE_KEY});
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.HUMKIN_WARM_SIGNAL=api;
})(typeof window!=="undefined"?window:globalThis);
