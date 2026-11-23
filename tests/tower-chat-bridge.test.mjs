import test from "node:test";
import assert from "node:assert/strict";
import {
  parseControl,isEligible,parseCatalogQuery,projectCatalog,safeSchedule,
  classifyIntent
} from "../supabase/functions/humkin-tower-chat/contracts.mjs";
const ID="11111111-1111-4111-8111-111111111111";
const REQ="22222222-2222-4222-8222-222222222222";
const valid={station_id:"station-one",command:"queue_next",track_id:ID,request_id:REQ};

test("only station-one and six explicit control actions may enter the command path",()=>{
  assert.deepEqual(parseControl(valid),{command:"queue_next",track_id:ID,request_id:REQ});
  for(const command of ["publish","delete","queue_now","metadata_refresh",""]){
    assert.throws(()=>parseControl({...valid,command}),/INVALID_COMMAND/);
  }
  assert.throws(()=>parseControl({...valid,station_id:"v20"}),/UNSUPPORTED_STATION/);
  assert.throws(()=>parseControl({...valid,track_id:"same title"}),/INVALID_COMMAND/);
  assert.throws(()=>parseControl({...valid,request_id:"not-uuid"}),/INVALID_COMMAND/);
});
test("only approved R2 source music can receive weight controls",()=>{
  const song={id:ID,kind:"song",enabled:true,published_at:"2026-11-23T00:00:00Z",
    storage_provider:"r2",duration_seconds:190,title:"Blue Rose",artist:"HUMKIN",album:"One"};
  assert.equal(isEligible(song,"more"),true);
  assert.equal(isEligible({...song,enabled:false},"queue_next"),false);
  assert.equal(isEligible({...song,published_at:null},"queue_next"),false);
  assert.equal(isEligible({...song,storage_provider:"r2_private"},"queue_next"),false);
  assert.equal(isEligible({...song,kind:"bumper"},"more"),false);
  assert.equal(isEligible({...song,kind:"bumper",duration_seconds:200},"queue_next"),false);
  assert.equal(isEligible({...song,kind:"bumper",duration_seconds:30},"queue_next"),true);
});
test("search bounds and catalog projection hide secrets/unedited drafts",()=>{
  assert.throws(()=>parseCatalogQuery({query:"x".repeat(121)}),/INVALID_QUERY/);
  const rows=[
    {id:ID,kind:"song",enabled:true,published_at:"2026-11-23T00:00:00Z",
      storage_provider:"r2",duration_seconds:181,title:"Blue Rose",artist:"HUMKIN",
      album:"One",r2_object_key:"SECRET-PRIVATE-KEY",sha256:"private"},
    {id:REQ,kind:"song",enabled:false,published_at:null,
      storage_provider:"r2_private",title:"Unreleased Blue",artist:"HUMKIN",album:"Two"}
  ];
  const data=projectCatalog(rows,parseCatalogQuery({query:"blue"}));
  assert.equal(data.matches,1);
  assert.equal(data.records[0].title,"Blue Rose");
  assert.equal(JSON.stringify(data).includes("SECRET-PRIVATE-KEY"),false);
  assert.equal(JSON.stringify(data).includes("Unreleased Blue"),false);
});
test("live schedule projection strips media sources and does not claim listener hearing",()=>{
  const raw={schema:"humkin.autopilot.public-schedule/v1",station_id:"station-one",
    on_air:true,revision:"r-tested",as_of_utc:"2026-11-23T17:00:00Z",
    rotation_track_count:3,upcoming:[{
      is_current:true,revision:"r-tested",start_at_utc:"2026-11-23T17:00:00Z",
      end_at_utc:"2026-11-23T17:03:00Z",
      track:{id:ID,title:"Blue Rose",artist:"HUMKIN",album:"One",
        media_url:"PRIVATE-MEDIA",r2_object_key:"SECRET-PRIVATE-KEY"}
    }],control:{effective_cursor:4,pending_cursor:5},
    hidden_token:"SECRET"};
  const projection=safeSchedule(raw);
  assert.equal(projection.current.track.title,"Blue Rose");
  assert.equal(projection.control.pending_cursor,5);
  assert.equal(projection.on_air,true);
  assert.equal(JSON.stringify(projection).includes("SECRET"),false);
  assert.equal(JSON.stringify(projection).includes("PRIVATE"),false);
  assert.throws(()=>safeSchedule({...raw,station_id:"fellowship"}),/SCHEDULE_NOT_VERIFIED/);
});
test("REQUESTED, ACCEPTED and EFFECTIVE are independent of HEARD",()=>{
  assert.equal(classifyIntent(1,null),"REQUESTED_UNVERIFIED_CLOUD");
  assert.equal(classifyIntent(6,{control:{effective_cursor:4,pending_cursor:5},on_air:true}),"REQUESTED");
  assert.equal(classifyIntent(5,{control:{effective_cursor:4,pending_cursor:5},on_air:false}),"ACCEPTED_NOT_EFFECTIVE");
  assert.equal(classifyIntent(4,{control:{effective_cursor:4,pending_cursor:5},on_air:false}),"ACCEPTED_NOT_EFFECTIVE");
  assert.equal(classifyIntent(4,{control:{effective_cursor:4,pending_cursor:5},on_air:true}),"EFFECTIVE_SCHEDULE_NOT_HEARD");
});
