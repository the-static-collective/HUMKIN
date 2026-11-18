/* HUMKIN RADIO — approved Cloudflare R2 music manifests and seasonal slots.
 * R2 is a public music-file origin, never a database of private submissions.
 * A file being present in R2 does NOT automatically grant airtime.
 * Editorial approval and complete metadata in fm/r2-tracks.json are required.
 */
(function(root){"use strict";
const ORIGIN="https://media.abundent.org";
function objectUrl(key,kind="audio"){
 if(typeof key!=="string"||!key||key!==key.trim()||key.length>400)return null;
 const pieces=key.split("/");
 if(pieces.some(p=>!p||p==="."||p===".."||/[\\?#\x00-\x1f\x7f]/.test(p)))return null;
 const ext=kind==="art" ? /\.(?:jpg|jpeg|png|webp)$/i : /\.mp3$/i;
 if(!ext.test(key))return null;
 return ORIGIN+"/"+pieces.map(encodeURIComponent).join("/");
}
function parse(data,fallbackArtwork){
 if(data?.schema!=="humkin.radio.r2/v1"||!Array.isArray(data.tracks)||
    data.tracks.length>2000)return [];
 const seen=new Set(),out=[];
 for(const row of data.tracks){
  // An upload alone is never an editorial release.
  if(row?.approved!==true)continue;
  const bareId=String(row.id||"");
  if(!/^[a-z0-9][a-z0-9-]{2,79}$/.test(bareId))continue;
  const id="r2-"+bareId;
  if(seen.has(id))continue;
  const src=objectUrl(row.object_key);
  const duration=Number(row.duration_seconds);
  const title=typeof row.title==="string"?row.title.trim():"";
  if(!src||!title||title.length>240||!(duration>0&&duration<14400))continue;
  seen.add(id);
  const art=objectUrl(row.artwork_key,"art")||fallbackArtwork||"";
  out.push({id,title,artist:typeof row.artist==="string"&&row.artist.trim()?
    row.artist.trim().slice(0,160):"HUMKIN",
   album:typeof row.album==="string"&&row.album.trim()?
    row.album.trim().slice(0,200):"HUMKIN RADIO · R2",
   duration,src,artwork:art,kind:"song",source:"r2",seasonal:row.seasonal===true,\n    sha256:/^[0-9a-f]{64}$/.test(row.sha256||"")?row.sha256:""});
 }
 return out;
}
// A seasonal track has THREE slots total per cycle, not 3x on top of the
// usual released-music 2x rule. Existing release bonuses count toward those 3.
function additionalPositions(eligible,tracks,featuredPositions,policy){
 const featured=new Set(featuredPositions||[]);
 const explicit=new Set(Array.isArray(policy?.track_ids)?policy.track_ids:[]);\n  const hashes=new Set(Array.isArray(policy?.sha256s)?policy.sha256s.filter(x=>/^[0-9a-f]{64}$/.test(x)):[]);
 if(policy?.multiplier!==3)return [];
 const extras=[];
 for(let position=0;position<eligible.length;position++){
  const t=tracks[eligible[position]];
  if(!t||t.kind==="bumper"||!(t.seasonal===true||explicit.has(t.id)||(t.sha256&&hashes.has(t.sha256))))continue;
  const current=featured.has(position)?2:1;
  for(let k=current;k<3;k++)extras.push(position);
 }
 return extras;
}
const api=Object.freeze({ORIGIN,objectUrl,parse,additionalPositions});
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.HUMKIN_R2_CATALOG=api;
})(typeof window!=="undefined"?window:globalThis);
