/**
 * HUMKIN FEEDBACK SIGNALS — weekly Listener Weather -> station candidates.
 * Public aggregate only. The service already stores one current response per
 * anonymous device key/song/station week, with network/actor limits.
 * Neither a response nor this projection is a Top 42 play.
 */
export const WEATHER_SCHEMA="humkin.listener-weather/v1";
export const FEELINGS=Object.freeze(["hope","tears","seen","laugh","move","stayed"]);
export const MIN_MOVE_CONTENDER=3; // default editorial gate, owner-editable in TOWER contracts
const MAX_PER_FEELING=1000000;
const YMD=/^\d{4}-\d{2}-\d{2}$/;

export function stationWeek(at=new Date()){
  const f=new Intl.DateTimeFormat("en-US",{
    timeZone:"America/Chicago",year:"numeric",month:"2-digit",day:"2-digit"
  });
  const p=Object.fromEntries(f.formatToParts(at).map(x=>[x.type,x.value]));
  const noon=new Date(p.year+"-"+p.month+"-"+p.day+"T12:00:00Z");
  noon.setUTCDate(noon.getUTCDate()-(noon.getUTCDay()+6)%7);
  return noon.toISOString().slice(0,10);
}
function validCodeCount(value){return Number.isSafeInteger(value)&&value>=0&&value<=MAX_PER_FEELING}
/** Fail the *whole* signal board closed if its window, type or coverage fails. */
export function validateWeatherBoard(board,at=new Date()){
  if(board?.schema!==WEATHER_SCHEMA||!Array.isArray(board.tracks)||
    board.tracks.length>20000||board.truncated===true||
    board.week_start!==stationWeek(at)||!YMD.test(board.week_start))return false;
  const seen=new Set();
  for(const item of board.tracks){
    if(!item||typeof item.id!=="string"||
       !/^[a-z0-9-]{3,90}$/i.test(item.id)||seen.has(item.id)||
       !item.feelings||typeof item.feelings!=="object"||Array.isArray(item.feelings))return false;
    seen.add(item.id);
    for(const [code,count] of Object.entries(item.feelings))
      if(!FEELINGS.includes(code)||!validCodeCount(count))return false;
  }
  return true;
}
export function attachListenerWeather(tracks,board,at=new Date()){
  if(!validateWeatherBoard(board,at))return {ok:false,reason:"WEATHER_INCOMPLETE_OR_INVALID",tracks};
  const byId=new Map(board.tracks.map(x=>[x.id,x.feelings]));
  for(const track of tracks){
    if(!byId.has(track.id))continue;
    const feelings=byId.get(track.id);
    track.listener_weather={
      week_start:board.week_start,feelings:{...feelings},
      provisional:true,source:"self_reported_listener_weather",
      not_chart_points:true};
  }
  return {ok:true,tracks,week_start:board.week_start};
}
export function qualifiesFeedback(track,rule){
  if(!rule||typeof rule!=="object"||
     !FEELINGS.includes(rule.feeling)||
     !Number.isInteger(rule.min_count)||rule.min_count<MIN_MOVE_CONTENDER||
     rule.min_count>500)return false;
  const weather=track?.listener_weather;
  return weather?.source==="self_reported_listener_weather"&&
    weather.week_start===rule.week_start&&weather.provisional===true&&
    validCodeCount(weather.feelings?.[rule.feeling])&&
    weather.feelings[rule.feeling]>=rule.min_count;
}
export function danceContenders(catalog,board,at=new Date(),minimum=MIN_MOVE_CONTENDER){
  if(!Number.isInteger(minimum)||minimum<MIN_MOVE_CONTENDER||minimum>500)
    throw Error("INVALID_CONTENDER_THRESHOLD");
  if(!validateWeatherBoard(board,at))
    return {status:"HOLD_INCOMPLETE_WEATHER",week_start:stationWeek(at),contenders:[]};
  const approved=new Map((catalog||[]).filter(t=>t&&t.id).map(t=>[t.id,t]));
  const contenders=[];
  for(const row of board.tracks){
    const track=approved.get(row.id),move=row.feelings.move||0;
    if(!track||move<minimum)continue;
    contenders.push({id:track.id,title:track.title,artist:track.artist||"",
      move_count:move,total_reactions:Object.values(row.feelings).reduce((s,n)=>s+n,0),
      week_start:board.week_start,signal:"self_reported_move",
      chart_points_added:0});
  }
  contenders.sort((a,b)=>b.move_count-a.move_count||
    b.total_reactions-a.total_reactions||a.id.localeCompare(b.id));
  return {status:"PROVISIONAL",week_start:board.week_start,
    definition:"3+ self-reported Made Me Move responses from separate device-key/song/week records, not verified unique people.",
    contenders:contenders.slice(0,42)};
}
