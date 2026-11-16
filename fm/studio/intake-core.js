/* HUMKIN RADIO // living cart signal prep
 * Pure, testable audio planning: nothing here writes to radio or database.
 * Source originals remain untouched. No simulated radio static is baked in.
 */
(function(root){
"use strict";
const MAX_SECONDS=120, MAX_BYTES=25*1024*1024;
const ROLES=["station_id","news","field_report","comedy","sponsor","community","feature"];
function infer(name,duration=0){
 const stem=String(name||"").replace(/\.(m4a|mp3|wav|webm|ogg)$/i,"")
   .replace(/[_]+/g," ").replace(/\s+/g," ").trim();
 const title=stem.slice(0,120)||"Untitled field recording";
 const str=stem.toLowerCase();
 let department="station_id";
 if(/\b(request|listener|community|help|neighbou?r)\b/.test(str))department="community";
 else if(/\b(news|bulletin|reporter|newsman)\b/.test(str))department="news";
 else if(/\b(farm|field|goat|garden)\b/.test(str))department="field_report";
 else if(/\b(advert|commercial|sponsor)\b/.test(str))department="sponsor";
 else if(/\b(manager|comedy|sketch|skit)\b/.test(str))department="comedy";
 if(Number(duration)>40)department="feature";
 const caution=/\b(top of (the )?hour|bottom of (the )?hour|weather|sun(ny|shine)|requests?|phone|call|emergency)\b/i.test(str);
 return {title,department,placement:Number(duration)>40?"INTENTIONAL FEATURE — do not add to automatic bumper lottery":"BETWEEN SONGS · after roughly three songs",caution};
}
function bounds(channels,rate){
 if(!channels?.length||!channels[0]?.length||!(rate>0))throw Error("Empty or unreadable recording");
 const len=channels[0].length,hop=Math.max(1,Math.floor(rate/200));
 let first=-1,last=-1;
 for(let i=0;i<len;i+=hop){
  let active=false;
  for(const channel of channels){
   for(let j=i;j<Math.min(len,i+hop);j++){
    if(Math.abs(channel[j])>.008){active=true;break}
   }
   if(active)break;
  }
  if(active){if(first===-1)first=i;last=Math.min(len,i+hop)}
 }
 if(first<0)throw Error("This recording appears silent; nothing has been staged.");
 const pad=Math.floor(rate*.16);
 return {start:Math.max(0,first-pad),end:Math.min(len,last+pad),trimmedHeadSeconds:Math.max(0,first-pad)/rate,trimmedTailSeconds:(len-Math.min(len,last+pad))/rate};
}
function prepare(channels,rate){
 if(!Array.isArray(channels)||!channels.length||channels.length>2||!(rate>=8000&&rate<=192000))
  throw Error("Unsupported audio channels or sample rate");
 const {start,end,trimmedHeadSeconds,trimmedTailSeconds}=bounds(channels,rate);
 const duration=(end-start)/rate;
 if(duration<=.25||duration>MAX_SECONDS)throw Error("Spoken cart must be 0.25–120 seconds. Send longer material to the regular Crate Loader.");
 const targetRate=44100,outLen=Math.round(duration*targetRate),mono=new Float32Array(outLen);
 let peak=0,sum=0;
 for(let i=0;i<outLen;i++){
  const p=start+i*rate/targetRate,at=Math.min(Math.floor(p),end-1),next=Math.min(at+1,end-1),blend=p-at;
  let value=0;
  for(const ch of channels)value+=(ch[at]*(1-blend)+ch[next]*blend)/channels.length;
  mono[i]=value;peak=Math.max(peak,Math.abs(value));sum+=value*value;
 }
 const rms=Math.sqrt(sum/outLen);
 if(rms<.0003||peak<.003)throw Error("Recording is extremely quiet or silent; inspect the source before processing.");
 const gain=Math.min(3,0.112/rms,0.92/peak);
 const fadeFrames=Math.max(1,Math.min(Math.floor(targetRate*.045),Math.floor(outLen/4)));
 for(let i=0;i<outLen;i++){
  const fade=Math.min(1,(i+1)/fadeFrames,(outLen-i)/fadeFrames);
  mono[i]=Math.max(-.98,Math.min(.98,mono[i]*gain*fade));
 }
 return {mono,sampleRate:targetRate,duration:outLen/targetRate,gain,peak,rms,
   trimmedHeadSeconds,trimmedTailSeconds};
}
function safeName(value){return String(value||"cart").normalize("NFKD").toLowerCase()
 .replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,70)||"cart"}
const api=Object.freeze({MAX_SECONDS,MAX_BYTES,ROLES,infer,bounds,prepare,safeName});
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.HUMKIN_CART_INTAKE=api;
})(typeof window!=="undefined"?window:globalThis);
