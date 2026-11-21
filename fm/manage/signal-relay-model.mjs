/* SIGNAL RELAY 001: suggestions from the existing public Compost Heap.
 * No automatic publishing, private data, genre inference, voting or reward claims.
 */
const ID=/^[A-Za-z0-9-]{3,90}$/;
const MAX=50;
function number(value){
  const n=Number(value);
  return Number.isFinite(n)&&n>=0?n:0;
}
export function eligibleTrack(track){
  return !!track&&ID.test(track.id||"")&&track.kind==="song";
}
export function classify(row){
  if(row.dance>=2&&row.ratings>=2)return {lane:"DANCE CONTENDER",reason:"At least two separate saved dance reactions; human review required."};
  if(row.ratings>=3&&row.stars>=4)return {lane:"RETURN LISTEN",reason:"At least three ratings with a mean of four stars or more."};
  return {lane:"UNDERHEARD",reason:"A published song with relatively few recorded Compost listens."};
}
export function rankCandidates(tracks,scores,library,limit=20){
  if(!Array.isArray(tracks)||!Array.isArray(scores)||!Array.isArray(library))return [];
  const cap=Math.min(MAX,Math.max(1,Math.trunc(number(limit))||20));
  const allowed=new Map(library.filter(t=>t&&t.enabled===true&&t.published===true&&t.kind==="song"&&ID.test(t.id||""))
    .map(t=>[t.id,t]));
  const byScore=new Map(scores.filter(s=>s&&ID.test(s.id||"")).map(s=>[s.id,s]));
  const seen=new Set();
  const rows=[];
  for(const track of tracks){
    if(!eligibleTrack(track)||!allowed.has(track.id)||seen.has(track.id))continue;
    seen.add(track.id);
    const item=allowed.get(track.id),raw=byScore.get(track.id)||{};
    const plays=Math.trunc(number(raw.plays)),ratings=Math.trunc(number(raw.ratings));
    const dance=Math.min(ratings,Math.trunc(number(raw.dance)));
    const stars=Math.min(5,number(raw.stars));
    const row={id:track.id,title:String(item.title||track.title||track.id).slice(0,240),
      artist:String(item.artist||track.artist||"HUMKIN").slice(0,160),
      album:String(item.album||track.album||"").slice(0,160),
      plays,ratings,dance,stars};
    Object.assign(row,classify(row));
    rows.push(row);
  }
  const underheard=[...rows].sort((a,b)=>a.plays-b.plays||a.id.localeCompare(b.id));
  const signaled=rows.filter(t=>t.lane!=="UNDERHEARD")
    .sort((a,b)=>b.dance-a.dance||b.ratings-a.ratings||a.plays-b.plays||a.id.localeCompare(b.id));
  // Most seats remain for unheard works; a minority are reserved for credible
  // reaction-based contenders. There is no promotion to an actual station here.
  const floor=Math.ceil(cap*0.7),result=underheard.slice(0,floor);
  const selected=new Set(result.map(x=>x.id));
  for(const row of signaled){
    if(result.length>=cap)break;
    if(!selected.has(row.id)){result.push(row);selected.add(row.id);}
  }
  for(const row of underheard){
    if(result.length>=cap)break;
    if(!selected.has(row.id)){result.push(row);selected.add(row.id);}
  }
  return result;
}
export function compostLink(href,id){
  if(!ID.test(id||""))throw Error("A published track ID is required.");
  const url=new URL("../../fmstudio/",href);
  url.search="";url.hash="";
  url.searchParams.set("compost",id);
  return url.href;
}
export function proposalReceipt(row,action,now=new Date().toISOString()){
  if(!row||!ID.test(row.id||"")||!["saved_proposal","opened_paused_editor"].includes(action))
    throw Error("Invalid editorial proposal.");
  return {schema:"humkin.signal-relay.proposal/v1",track_id:row.id,
    title:String(row.title||row.id).slice(0,240),
    signal:{plays:number(row.plays),ratings:number(row.ratings),dance:number(row.dance),stars:number(row.stars)},
    suggested_lane:classify(row).lane,
    action,at:now,source:"public humkin-compost aggregate; editorial browser review",
    broadcast_status:"not_published_by_relay",verification:"operator-local assertion; no field fulfillment claimed"};
}
