import assert from "node:assert/strict";
import test from "node:test";
import {stationWeek,attachListenerWeather,danceContenders,qualifiesFeedback,
  validateWeatherBoard} from "./feedback-signals.mjs";
import {STATIONS,matchFilter,resolveStation} from "../../tools/radio-broadcast/cloudflare/stations.mjs";

const AT=new Date("2026-11-18T21:00:00Z");
function music(){
 const all=[
  {id:"crate-a1",key:"tracks/a1.mp3",title:"The New One",artist:"HUMKIN",kind:"song",duration:150},
  {id:"crate-b2",key:"tracks/b2.mp3",title:"The Old One",artist:"HUMKIN",kind:"song",duration:150}
 ];
 all.bumper_rules=[];all.bumper_groups=[];return all;
}
function board(move=3){
 return {schema:"humkin.listener-weather/v1",week_start:stationWeek(AT),
  provisional:true,truncated:false,tracks:[
   {id:"crate-a1",total:move+1,feelings:{move,hope:1}},
   {id:"crate-unknown",total:900,feelings:{move:900}}
  ]};
}
test("weekly move reactions select dance New Contenders without creating chart points",()=>{
 const tracks=music(),b=board();
 const joined=attachListenerWeather(tracks,b,AT);
 assert.equal(joined.ok,true);
 const station=STATIONS.find(s=>s.id==="dance-contenders");
 assert(station.enabled);
 assert.equal(matchFilter(tracks[0],station.filter,AT),true);
 assert.equal(matchFilter(tracks[1],station.filter,AT),false);
 const resolved=resolveStation(station,tracks,AT);
 assert.deepEqual(resolved.tracks.map(t=>t.id),["crate-a1"]);
 const projected=danceContenders(tracks,b,AT);
 assert.equal(projected.status,"PROVISIONAL");
 assert.deepEqual(projected.contenders.map(x=>x.id),["crate-a1"]);
 assert.equal(projected.contenders[0].chart_points_added,0);
});
test("insufficient, stale, incomplete and malformed reaction boards fail closed",()=>{
 for(const wrong of [
  {...board(),truncated:true},
  {...board(),week_start:"2026-11-09"},
  {...board(),tracks:[{id:"crate-a1",feelings:{move:-1}}]},
  {...board(),tracks:[{id:"crate-a1",feelings:{bogus:42}}]},
 ]){
  assert.equal(validateWeatherBoard(wrong,AT),false);
  const tracks=music();
  assert.equal(attachListenerWeather(tracks,wrong,AT).ok,false);
  assert.equal(danceContenders(tracks,wrong,AT).contenders.length,0);
 }
 const tracks=music(),below=board(2);
 attachListenerWeather(tracks,below,AT);
 assert.equal(danceContenders(tracks,below,AT).contenders.length,0);
});
test("feedback rules do not turn low-trust signal into an evergreen genre tag",()=>{
 const tracks=music();attachListenerWeather(tracks,board(),AT);
 assert.equal(tracks[0].tags,undefined);
 assert.equal(tracks[0].listener_weather.not_chart_points,true);
 const rule={feeling:"move",min_count:3,week_start:stationWeek(AT)};
 assert(qualifiesFeedback(tracks[0],rule));
 assert(!qualifiesFeedback(tracks[0],{...rule,min_count:1}));
 assert(!qualifiesFeedback(tracks[0],{...rule,week_start:"2026-11-09"}));
});
