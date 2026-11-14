/* HUMKIN Radio — public AzuraCast now-playing data, read-only.
 * Does not fetch other organizations, upload content or start a stream.
 */
(function(root){"use strict";
function safeHttps(raw){
 try{
  const u=new URL(raw);
  return u.protocol==="https:"&&!u.username&&!u.password?u.href:null;
 }catch{return null}
}
function parse(data){
 if(!data||typeof data!=="object"||Array.isArray(data))return null;
 const song=data.now_playing?.song||{};
 const title=String(song.title||"").trim().slice(0,240);
 const artist=String(song.artist||"").trim().slice(0,160);
 const image=safeHttps(song.art);
 const listeners=Number(data.listeners?.current);
 return {
  online:data.is_online===true,
  title:title||"HUMKIN RADIO",
  artist:artist||"HUMKIN",
  artwork:image,
  listeners:Number.isInteger(listeners)&&listeners>=0&&listeners<1e9?listeners:null,
  playingAt:Number(data.now_playing?.played_at)||null
 };
}
const api=Object.freeze({safeHttps,parse});
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.HUMKIN_HOSTED_NOWPLAYING=api;
})(typeof window!=="undefined"?window:globalThis);