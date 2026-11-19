/* HUMKIN × Auto Disco V20 — Accident Frequency selector.
 * Selection is an editorial proposal, NEVER an AI first listen.
 */
const ID=/^[A-Za-z0-9-]{3,90}$/;
const MEDIA=new Set(["humkin.abundent.org","media.abundent.org","kbhqacsdvjsstzyplqij.supabase.co"]);
export const HANDOFF_SCHEMA="humkin.accident.autodisco-handoff/v1";
function playable(url) {
  try {
    const u=new URL(url);
    return u.protocol==="https:"&&!u.username&&!u.password&&MEDIA.has(u.hostname)&&/\.mp3$/i.test(u.pathname);
  } catch { return false; }
}
function hash(seed,id) {
  let value=2166136261;
  for(const char of String(seed)+":"+id) {
    value^=char.charCodeAt(0);
    value=Math.imul(value,16777619);
  }
  return value>>>0;
}
export function normalizeCatalog(payload) {
  if(!payload||!Array.isArray(payload.tracks)||!Array.isArray(payload.scores)||
    payload.tracks.length>100000||payload.scores.length>100000)throw Error("INVALID_COMPOST_SNAPSHOT");
  const counts=new Map();
  for(const row of payload.scores) {
    if(row&&ID.test(row.id)&&Number.isSafeInteger(Number(row.plays))&&
       Number(row.plays)>=0&&!counts.has(row.id))counts.set(row.id,Number(row.plays));
  }
  const seen=new Set(),urls=new Set(),out=[];
  for(const row of payload.tracks) {
    if(!row||!ID.test(row.id)||typeof row.title!=="string"||!row.title.trim()||
       !playable(row.src)||["bumper","station_id"].includes(row.kind)||
       seen.has(row.id)||urls.has(row.src))continue;
    const duration=Number(row.duration);
    if(!Number.isFinite(duration)||duration<=0||duration>14400)continue;
    seen.add(row.id);urls.add(row.src);
    out.push({id:row.id,title:row.title.trim(),
      artist:String(row.artist||"Uncredited").trim(),
      album:String(row.album||"").trim(),duration,src:row.src,
      artwork:typeof row.artwork==="string"&&/^https:\/\//i.test(row.artwork)?row.artwork:"",
      plays:counts.has(row.id)?counts.get(row.id):null});
  }
  return out;
}
export function buildAccidentSet(tracks,options={}) {
  const size=options.size??6;
  if(!Array.isArray(tracks)||!Number.isInteger(size)||size<1||size>12)
    throw Error("INVALID_ACCIDENT_SELECTION");
  const avoid=new Set(options.avoidIds||[]);
  let remaining=tracks.filter(t=>t&&ID.test(t.id)&&!avoid.has(t.id));
  if(!remaining.length)remaining=tracks.filter(t=>t&&ID.test(t.id));
  const result=[],seed=String(options.seed??"daily");
  while(remaining.length&&result.length<size) {
    const last=result.at(-1);
    remaining.sort((a,b)=>{
      const n=(a.plays??0)-(b.plays??0);
      if(n)return n; // neglect outranks other signals
      const seenA=result.some(x=>x.artist===a.artist&&x.album===a.album)?1:0;
      const seenB=result.some(x=>x.artist===b.artist&&x.album===b.album)?1:0;
      if(seenA!==seenB)return seenA-seenB;
      const nearA=last&&(a.artist===last.artist||(a.album&&a.album===last.album))?1:0;
      const nearB=last&&(b.artist===last.artist||(b.album&&b.album===last.album))?1:0;
      if(nearA!==nearB)return nearA-nearB;
      return hash(seed,a.id)-hash(seed,b.id)||a.id.localeCompare(b.id);
    });
    result.push(remaining.shift());
  }
  return result;
}
export function makeV20Handoff(queue,{seed,createdAt=new Date().toISOString()}={}) {
  if(!Array.isArray(queue)||!queue.length||queue.length>12||
     queue.some(t=>!ID.test(t.id)||!playable(t.src)))throw Error("INVALID_HANDOFF_QUEUE");
  return {
    schema:HANDOFF_SCHEMA,
    status:"editorial-candidate-only",
    station:"HUMKIN — Auto Disco / Accident Frequency",
    source:"HUMKIN Compost Heap published catalog + approximate play counts",
    selected_at:createdAt,seed:String(seed??""),
    selection_rule:"Fewest reported plays first; artist/album variety breaks ties; no genre inference.",
    editorial_candidates:queue.map((t,i)=>({
      order:i+1,track_id:t.id,title:t.title,artist:t.artist,album:t.album,
      src:t.src,duration_seconds:t.duration,observed_play_count:t.plays
    })),
    isolation:{
      curator_context_must_not_enter_dj_prompt:true,
      local_source_bytes_must_be_verified:true,
      no_auto_publication:true,
      procedure:"Download authorized audio locally and verify bytes; create a bounded V20 AUDIO WINDOW; run two isolated first listens with no catalog memory; seal, cross-read and editorially admit before broadcast."
    },
    laws:["CANDIDATE != FIRST LISTEN","PLAY COUNT != AUDIENCE SIZE",
      "DJ FIRST LISTEN != HIDDEN CATALOG MEMORY","EPISODE != ON-AIR OCCURRENCE"]
  };
}
