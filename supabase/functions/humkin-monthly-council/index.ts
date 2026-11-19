import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.57.0";
import {monthlyCouncil,chicagoMonth} from "../../../fm/top42/vinyl-council.mjs";

/**
 * HUMKIN MONTHLY COUNCIL — OWNER-ONLY, READ-ONLY, NOT DEPLOYED.
 * Produces a provisional snapshot of current Top42/Listener Weather tables.
 * Never reads or returns actor/network hashes, edits chart points, publishes
 * a record, submits a vendor order or grants production permission.
 */
const URL_BASE=Deno.env.get("SUPABASE_URL")??"";
const SERVICE_ROLE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
const OWNER="us@abundent.org";
const STATION="https://humkin.abundent.org";
const ORIGINS=new Set([STATION,"https://www.humkin.abundent.org"]);
const db=createClient(URL_BASE,SERVICE_ROLE,{auth:{persistSession:false,autoRefreshToken:false}});
const PAGE=1000,MAX_ROWS=5000;
const FEELS=new Set(["hope","tears","seen","laugh","move","stayed"]);
function reply(payload:unknown,status=200,origin=""){
 const allowed=ORIGINS.has(origin)?origin:STATION;
 return new Response(JSON.stringify(payload),{status,headers:{
   "Content-Type":"application/json; charset=utf-8",
   "Cache-Control":"private, no-store",
   "Access-Control-Allow-Origin":allowed,
   "Access-Control-Allow-Methods":"GET,OPTIONS",
   "Access-Control-Allow-Headers":"authorization,apikey",
   "Vary":"Origin",
   "X-Content-Type-Options":"nosniff"}});
}
async function owner(req:Request){
 const auth=req.headers.get("authorization")||"";
 if(!auth.startsWith("Bearer ")||auth.length>2400)throw Error("OWNER_AUTH_REQUIRED");
 const {data,error}=await db.auth.getUser(auth.slice(7));
 if(error||!data?.user?.id||data.user.email?.toLowerCase()!==OWNER)
   throw Error("OWNER_AUTH_REQUIRED");
}
function monthRange(month:string){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error("INVALID_MONTH");
 const [year,number]=month.split("-").map(Number);
 const next=new Date(Date.UTC(year,number,1));
 const last=new Date(next.getTime()-86400000).toISOString().slice(0,10);
 return {first:month+"-01",last};
}
async function rangedRows(table:string,columns:string,key:string,first:string,last:string){
 const rows:any[]=[];
 for(let start=0;start<MAX_ROWS;start+=PAGE){
   const {data,error}=await db.from(table).select(columns)
     .gte(key,first).lte(key,last).order("id",{ascending:true})
     .range(start,start+PAGE-1);
   if(error)throw error;
   if(!Array.isArray(data))throw Error("DB_RESPONSE_UNREADABLE");
   rows.push(...data);
   if(data.length<PAGE)return {rows,truncated:false};
 }
 return {rows,truncated:true};
}
async function monthlySnapshot(month:string){
 const {first,last}=monthRange(month);
 const chartCall=db.rpc("humkin_league_scores",{from_day:first,to_day:last});
 const [chartResult,records,reactions,requests,leagueResult]=await Promise.all([
   chartCall,
   rangedRows("humkin_league_records",
     "id,kind,issue_key,title,curator,track_ids","issue_key",first,last),
   rangedRows("humkin_listener_weather",
     "id,track_id,feeling","station_week",first,last),
   rangedRows("humkin_league_beacons",
     "id,track_id","station_day",first,last),
   fetch(URL_BASE+"/functions/v1/humkin-league",{
      headers:{Accept:"application/json"},signal:AbortSignal.timeout(7500)})
 ]);
 if(chartResult.error||!Array.isArray(chartResult.data))throw Error("MONTHLY_CHART_UNAVAILABLE");
 if(!leagueResult.ok)throw Error("PUBLIC_CATALOG_UNAVAILABLE");
 const league=await leagueResult.json();
 if(league?.schema!=="humkin.top42/v1"||!Array.isArray(league.catalog))
   throw Error("PUBLIC_CATALOG_INCOMPLETE");
 const catalog=league.catalog.map((x:any)=>({
   id:x.id,title:x.title,artist:x.artist,album:x.album,
   featured:x.featured===true,kind:"song",duration_seconds:x.duration,
   enabled:true,published:true
 }));
 const weather=new Map<string,Record<string,number>>();
 for(const row of reactions.rows){
   if(!FEELS.has(row.feeling))continue;
   const f=weather.get(row.track_id)||{};
   f[row.feeling]=(f[row.feeling]||0)+1;
   weather.set(row.track_id,f);
 }
 const requestsByTrack=new Map<string,number>();
 for(const row of requests.rows){
   requestsByTrack.set(row.track_id,(requestsByTrack.get(row.track_id)||0)+1);
 }
 return {schema:"humkin.monthly-feedback-snapshot/v1",month,
   closed:month<chicagoMonth(),complete:false,
   truncated:records.truncated||reactions.truncated||requests.truncated||
     chartResult.data.length>=PAGE||catalog.length>=PAGE,
   source_status:{
     chart:"qualified_play_ledger_aggregate",
     weather:"current_weekly_reaction_snapshots_not_immutable_monthly_events",
     records:"daily_ep_and_weekly_album_issue_dates",
     requests:"beacon_counts_informational_not_votes",
     participant_events:"not_connected",
     catalog:"currently_published_top42_catalog_not_historical_rights"
   },
   catalog,
   plays:chartResult.data.map((x:any)=>({
     id:x.track_id,radio:Number(x.radio_plays)||0,
     playlist:Number(x.playlist_plays)||0
   })),
   weather:[...weather].map(([id,feelings])=>({id,feelings})),
   records:records.rows.map((r:any)=>({
     id:r.id,kind:r.kind,issue_key:r.issue_key,title:r.title,
     curator:r.curator,tracks:r.track_ids
   })),
   beacons:[...requestsByTrack].map(([id,count])=>({id,count})),
   events:[],event_feed_status:"not_connected"};
}
Deno.serve(async req=>{
 const origin=req.headers.get("origin")||"";
 if(req.method==="OPTIONS")return reply({},200,origin);
 if(origin&&!ORIGINS.has(origin))return reply({error:"STATION_ORIGIN_ONLY"},403,origin);
 if(req.method!=="GET")return reply({error:"METHOD_NOT_ALLOWED"},405,origin);
 try{await owner(req)}catch{return reply({error:"OWNER_AUTH_REQUIRED"},401,origin)}
 try{
   const month=new URL(req.url).searchParams.get("month")||chicagoMonth();
   // No expensive unrestricted historical scans; at most recent 12 months.
   if(month<"2026-01"||month>chicagoMonth()){
     return reply({error:"MONTH_OUT_OF_RANGE"},400,origin);
   }
   const year=Number(month.slice(0,4)),mm=Number(month.slice(5,7));
   const now=chicagoMonth(),n=Number(now.slice(0,4))*12+Number(now.slice(5,7));
   if(!Number.isInteger(mm)||mm<1||mm>12||year*12+mm<n-12)
     return reply({error:"MONTH_OUT_OF_RANGE"},400,origin);
   const snapshot=await monthlySnapshot(month);
   const council=monthlyCouncil(snapshot);
   return reply({schema:"humkin.monthly-council-owner/v1",
     note:"Provisional owner-only look. Monthly Weather is a mutable weekly snapshot; not a certified historic vote. No public release or pressing.",
     council,snapshot},200,origin);
 }catch(error){
   console.warn("HUMKIN monthly council unavailable",String(error));
   return reply({error:"MONTHLY_COUNCIL_UNAVAILABLE"},503,origin);
 }
});
