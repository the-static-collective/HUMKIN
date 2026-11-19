/* HUMKIN catalogue review: pure, offline, no server calls, no autoplay or
 * publication. Reviewed enrichment is a metadata overlay, not permission to air.
 */
export const CANDIDATE_SCHEMA="humkin.catalog.candidates/v1";
export const ENRICHMENT_SCHEMA="humkin.radio.enrichment/v1";
const HASH=/^[0-9a-f]{64}$/i;
const TAG=/^(genre|mood|texture):[a-z0-9-]{1,48}$/;
export function validatePack(pack){
 if(pack?.schema!==CANDIDATE_SCHEMA||!Array.isArray(pack.tracks)||
    pack.tracks.length>20000)throw Error("Invalid HUMKIN catalogue candidate file");
 const seen=new Set();
 for(const row of pack.tracks){
  const sha=String(row?.mp3_sha256||"").toLowerCase();
  if(!HASH.test(sha)||seen.has(sha)||!Array.isArray(row.suggestions))
   throw Error("Invalid or duplicate MP3 hash in candidate file");
  seen.add(sha);
 }
 return pack;
}
export function candidateTags(record){
 return [...new Set((record?.suggestions||[]).map(x=>x?.tag).filter(x=>
  typeof x==="string"&&TAG.test(x)))].slice(0,32);
}
export function normalizeTagText(value){
 const raw=String(value||"").split(/[,;\n]/).map(t=>t.trim().toLowerCase()).filter(Boolean);
 if(raw.length>32||raw.some(t=>!TAG.test(t)))throw Error(
  "Use up to 32 tags in genre:name, mood:name or texture:name format.");
 return [...new Set(raw)];
}
export function reviewRecord(record,value){
 const tags=normalizeTagText(value);
 record.reviewed_tags=tags;
 record.approved_for_tag_publication=true;
 return record;
}
export function unreviewRecord(record){
 record.approved_for_tag_publication=false;
 return record;
}
export function publicEnrichment(pack){
 validatePack(pack);
 const tracks=pack.tracks.filter(x=>x.approved_for_tag_publication===true)
  .map(x=>({mp3_sha256:x.mp3_sha256.toLowerCase(),
    reviewed:true,tags:normalizeTagText((x.reviewed_tags||[]).join(","))}));
 return {schema:ENRICHMENT_SCHEMA,
  description:"Owner-reviewed taxonomy tags joined to independently approved audio by SHA-256. No raw style prompts or private notes.",
  tracks};
}
export function shortlist(pack,query="",mode="all"){
 validatePack(pack);
 const q=String(query).trim().toLowerCase();
 return pack.tracks.filter(r=>{
  const reviewed=r.approved_for_tag_publication===true;
  if(mode==="reviewed"&&!reviewed||mode==="unreviewed"&&reviewed)return false;
  if(mode==="ambiguous"){
   const genres=(r.suggestions||[]).filter(x=>x.tag?.startsWith("genre:"));
   const closeStyles=genres.length>=2&&Math.abs(Number(genres[0].score)-Number(genres[1].score))<=2;
   if(!r.possible_family_hashes?.length&&!closeStyles)return false;
  }
  if(mode==="no-tags"&&candidateTags(r).length)return false;
  if(!q)return true;
  return [r.title,r.artist,r.album,r.suno_style,r.human_description,r.filename,
     ...(r.suggestions||[]).map(x=>x.tag)].some(x=>String(x||"").toLowerCase().includes(q));
 });
}
