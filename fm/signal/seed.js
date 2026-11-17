/* HUMKIN STATION SEED 002.
 * Keep the listener's first deliberate selections as an immutable local origin.
 * A seed is a creative preference record, NOT a server identity, ownership proof,
 * listener count, right to rebroadcast or Orchard/network wallet.
 */
(function(root,factory){
  const api=factory(root.HumkinSignal);
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  root.HumkinStationSeed=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(M){
"use strict";
const KEY="humkin-station-seed-v1";
const SCHEMA="humkin.station.seed/v1", BACKUP="humkin.station.backup/v1";
function text(value,max){return String(value==null?"":value).replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,max);}
function compactTracks(ids){
  if(!Array.isArray(ids)||ids.length!==3)return null;
  const clean=ids.map(x=>text(x,90));
  return clean.every(x=>/^[-a-zA-Z0-9_]{1,90}$/.test(x))&&new Set(clean).size===3?clean:null;
}
function choices(value){
  if(!value||typeof value!=="object")return null;
  const tracks=compactTracks(value.tracks);
  if(!tracks)return null;
  return {name:text(value.name,48)||"My Little Station",intro:text(value.intro,160),
    mode:M.mode(value.mode),tracks};
}
function parentSignal(raw){
  const normalized=choices(raw);
  return normalized?{kind:"received-link",selections:normalized,
    note:"Unverified listener-supplied source; not proof of authorship."}:null;
}
function make(draft,rows,opts={}){
  const c=choices(draft);
  if(!c)throw Error("Choose three distinct published songs before starting your station.");
  const published=new Map(M.catalog(rows).map(t=>[t.id,t]));
  if(c.tracks.some(id=>!published.has(id)))throw Error("Your station can start only with published songs.");
  const uuid=opts.uuid||globalThis.crypto?.randomUUID?.();
  if(typeof uuid!=="string"||!/^[a-zA-Z0-9-]{12,90}$/.test(uuid))throw Error("A secure local station ID is unavailable.");
  const now=opts.now||new Date().toISOString();
  if(typeof now!=="string"||!/^\d{4}-\d\d-\d\dT/.test(now))throw Error("Invalid station origin date.");
  const original=opts.parent?parentSignal(opts.parent):null;
  return {
    schema:SCHEMA,stationId:uuid,createdAt:now,
    catalogSource:"fm/rotation.json",
    founding:{
      name:c.name,intro:c.intro,mode:c.mode,tracks:c.tracks.map(id=>{
        const t=published.get(id);
        return {id,title:text(t.title,140),album:text(t.album,100),
          artist:text(t.artist||"HUMKIN",100)};
      })
    },
    origin:original||{kind:"self",note:"A listener's own first selection."}
  };
}
function validate(raw){
  if(!raw||raw.schema!==SCHEMA||typeof raw.stationId!=="string"||
    !/^[a-zA-Z0-9-]{12,90}$/.test(raw.stationId)||
    typeof raw.createdAt!=="string"||!/^\d{4}-\d\d-\d\dT/.test(raw.createdAt)||
    raw.catalogSource!=="fm/rotation.json"||
    !raw.founding||!Array.isArray(raw.founding.tracks)||raw.founding.tracks.length!==3)return null;
  const ids=compactTracks(raw.founding.tracks.map(t=>t?.id));
  if(!ids)return null;
  const origin=raw.origin?.kind==="received-link"?
    parentSignal(raw.origin?.selections):{kind:"self",note:"A listener's own first selection."};
  if(!origin)return null;
  return {
    schema:SCHEMA,stationId:raw.stationId,createdAt:raw.createdAt,catalogSource:"fm/rotation.json",
    founding:{
      name:text(raw.founding.name,48)||"My Little Station",
      intro:text(raw.founding.intro,160),mode:M.mode(raw.founding.mode),
      tracks:raw.founding.tracks.map((t,i)=>({
        id:ids[i],title:text(t.title,140),album:text(t.album,100),
        artist:text(t.artist,100)||"HUMKIN"
      }))
    },origin
  };
}
function read(store){
  try{return validate(JSON.parse(store?.getItem(KEY)||"null"))}catch{return null;}
}
function plant(store,seed){
  const valid=validate(seed);
  if(!valid||!store)return false;
  try{
    // Never silently overwrite an existing origin (even if it is unreadable).
    if(store.getItem(KEY)!==null)return false;
    store.setItem(KEY,JSON.stringify(valid));
    return true;
  }catch{return false;}
}
function backup(seed,draft,rows){
  const valid=validate(seed);
  if(!valid)throw Error("No station seed to back up.");
  return {schema:BACKUP,station:valid,current:M.normalize(draft,rows)};
}
function restore(raw,rows){
  if(!raw||raw.schema!==BACKUP)throw Error("Not a HUMKIN Station Seed backup.");
  const station=validate(raw.station);
  if(!station)throw Error("Station origin is missing or invalid.");
  // Preserve founding tracks even if the published catalog has changed.
  const current=M.normalize(raw.current,rows);
  return {station,current};
}
return {KEY,SCHEMA,BACKUP,choices,make,validate,read,plant,backup,restore};
});