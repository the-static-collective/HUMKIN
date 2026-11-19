/* Aggregate-only export for the V20 x MOTIF return loop.
 * No browser/device listener key, network hash, IP, or per-response data.
 */
export const SNAPSHOT_SCHEMA="humkin.accident.feedback-snapshot/v1";
function count(value) {
  const n=Number(value);
  if(!Number.isSafeInteger(n)||n<0)throw Error("INVALID_FEEDBACK_AGGREGATE_COUNT");
  return n;
}
export function makeFeedbackSnapshot(queue,stats,{seed,at=new Date().toISOString()}={}) {
  if(!Array.isArray(queue)||queue.length<1||queue.length>12||
    !Array.isArray(stats)||!seed||!Number.isFinite(Date.parse(at)))
    throw Error("INVALID_FEEDBACK_SNAPSHOT_INPUT");
  const scoped=new Set(),byId=new Map();
  for(const item of queue) {
    if(!item||typeof item.id!=="string"||scoped.has(item.id))
      throw Error("INVALID_PROGRAM_TRACKS");
    scoped.add(item.id);
  }
  for(const r of stats)if(scoped.has(r?.id)) {
    if(byId.has(r.id))throw Error("DUPLICATE_FEEDBACK_SCORE_ROW");
    byId.set(r.id,r);
  }
  const aggregates=queue.map(({id})=>{
    const row=byId.get(id);
    if(!row)return {track_id:id,plays:0,ratings:0,dance:0,stars:null,observed_row:false};
    const plays=count(row.plays),ratings=count(row.ratings),dance=count(row.dance);
    if(dance>ratings)throw Error("INVALID_FEEDBACK_REACTION_TOTAL");
    const stars=row.stars===null||row.stars===undefined?null:Number(row.stars);
    if(stars!==null&&(!Number.isFinite(stars)||stars<1||stars>5))
      throw Error("INVALID_FEEDBACK_STAR_AVERAGE");
    return {track_id:id,plays,ratings,dance,stars,observed_row:true};
  });
  return {
    schema:SNAPSHOT_SCHEMA,source:"humkin-compost-public-aggregate",
    captured_at:at,complete:true,program_seed:String(seed),
    candidate_track_ids:queue.map(t=>t.id),aggregates,
    data_boundary:"Cumulative counts, not a time-series, verified unique humans, delayed replay, causal trial, or cryptographic server receipt.",
  };
}
