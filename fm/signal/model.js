/* HUMKIN Signal 001: three real songs become a portable, listener-made program.
 * A Signal is a link, not a transmitter, server account, verified audience, or licensed rebroadcast.
 * Completely separate from Orchard saves, network keys, Top 42 and contribution credits.
 */
(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  root.HumkinSignal=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
const KEY="humkin-signal-draft-v1",VERSION=1;
const MODES=["across","together","surprise"];
function clean(value,max){
  return String(value==null?"":value).replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,max);
}
function catalog(rows){
  if(!Array.isArray(rows))return [];
  const ids=new Set();
  return rows.filter(t=>{
    if(!t||typeof t.id!=="string"||!/^[-a-zA-Z0-9_]{1,90}$/.test(t.id)||ids.has(t.id))return false;
    if(typeof t.title!=="string"||typeof t.src!=="string"||!t.title||!t.src)return false;
    ids.add(t.id);return true;
  });
}
function mode(value){return MODES.includes(value)?value:"across";}
function pick(rows,style,rng=Math.random){
  const all=catalog(rows),choose=(items)=>{
    const v=Math.max(0,Math.min(0.9999999,Number(rng())||0));
    return items[Math.floor(v*items.length)];
  };
  if(!all.length)return [];
  const m=mode(style),out=[],pool=all.slice();
  if(m==="together"){
    const groups=new Map();
    for(const t of pool){const group=String(t.album||"");if(!groups.has(group))groups.set(group,[]);groups.get(group).push(t);}
    const viable=[...groups.values()].filter(g=>g.length>=Math.min(3,all.length));
    if(viable.length){
      const group=choose(viable);
      pool.splice(0,pool.length,...group);
    }
  }
  while(pool.length&&out.length<3){
    let options=pool;
    if(m==="across"){
      const seen=new Set(out.map(t=>t.album||""));
      const distinct=pool.filter(t=>!seen.has(t.album||""));
      if(distinct.length)options=distinct;
    }
    const t=choose(options);
    out.push(t);pool.splice(pool.indexOf(t),1);
  }
  return out.map(t=>t.id);
}
function base(rows,style,rng){
  return {version:VERSION,name:"My Little Station",intro:"",mode:mode(style),tracks:pick(rows,style,rng)};
}
function normalize(raw,rows){
  const all=catalog(rows),byId=new Map(all.map(t=>[t.id,t]));
  const out=base([],raw&&raw.mode);
  if(!raw||raw.version!==VERSION)return {...out,tracks:pick(all,out.mode)};
  out.name=clean(raw.name,48)||"My Little Station";
  out.intro=clean(raw.intro,160);
  const ids=Array.isArray(raw.tracks)?raw.tracks.slice(0,3):[];
  out.tracks=[...new Set(ids.filter(id=>typeof id==="string"&&byId.has(id)))];
  if(out.tracks.length!==3&&all.length>=3){
    const remainder=pick(all,out.mode).concat(all.map(t=>t.id));
    for(const id of remainder)if(out.tracks.length<3&&!out.tracks.includes(id))out.tracks.push(id);
  }
  return out;
}
function fromUrl(search,rows){
  const p=new URLSearchParams(search);
  if(!p.has("t"))return null;
  const values=p.get("t")||"";
  if(values.length>300)return null;
  const ids=values.split(".");
  const available=new Set(catalog(rows).map(t=>t.id));
  if(ids.length!==3||new Set(ids).size!==3||ids.some(id=>!available.has(id)))return null;
  return normalize({version:VERSION,tracks:ids,name:p.get("n"),intro:p.get("i"),mode:p.get("m")},rows);
}
/**
 * A real on-air song can begin a new personal arrangement. Only published IDs
 * are accepted; other music is chosen from the catalog, never the URL. This
 * does not receive another person's station or rewrite an existing founding seed.
 */
function fromSeed(search,rows,rng=Math.random){
  const p=new URLSearchParams(search);
  if(p.has("t"))return null; // Full shared program takes precedence.
  const id=p.get("seed");
  if(typeof id!=="string"||!/^[-_a-zA-Z0-9]{1,90}$/.test(id))return null;
  const all=catalog(rows),first=all.find(t=>t.id===id);
  if(!first||all.length<3)return null;
  const style=mode(p.get("m")),out=[first],pool=all.filter(t=>t.id!==id);
  while(out.length<3&&pool.length){
    let options=pool;
    if(style==="together"){
      const same=pool.filter(t=>(t.album||"")===(first.album||""));
      if(same.length)options=same;
    }else if(style==="across"){
      const heard=new Set(out.map(t=>t.album||""));
      const other=pool.filter(t=>!heard.has(t.album||""));
      if(other.length)options=other;
    }
    const roll=Math.max(0,Math.min(0.9999999,Number(rng())||0));
    const next=options[Math.floor(roll*options.length)];
    out.push(next);pool.splice(pool.indexOf(next),1);
  }
  return normalize({version:VERSION,mode:style,tracks:out.map(t=>t.id)},all);
}
function toUrl(href,draft,rows){
  const model=normalize(draft,rows);
  if(model.tracks.length!==3)throw Error("Choose three published songs.");
  const u=new URL(href);
  u.search="";u.hash="";
  u.searchParams.set("t",model.tracks.join("."));
  if(model.name!=="My Little Station")u.searchParams.set("n",model.name);
  if(model.intro)u.searchParams.set("i",model.intro);
  if(model.mode!=="across")u.searchParams.set("m",model.mode);
  return u.href;
}
return {KEY,VERSION,MODES,clean,catalog,mode,pick,base,normalize,fromUrl,fromSeed,toUrl};
});