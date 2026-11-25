import test from "node:test";import assert from "node:assert/strict";
import {readFeed} from "../robots/return-signal.mjs";
const row={id:"a".repeat(64),basis:"audio",agent:"SIGNAL EAR",response:"A measured fragment.",track_title:"",observed_at:"2026-11-01T00:00:00Z",station_id:"station-one"};
test("empty is honest; invalid claims excluded",()=>{const now=Date.parse("2026-11-01T00:01:00Z");assert.deepEqual(readFeed({schema:"humkin.return-signal/v1",entries:[]},now),[]);assert.deepEqual(readFeed({schema:"humkin.return-signal/v1",entries:[row,{...row,basis:"fake"},{...row,station_id:"other"}]},now),[row]);assert.throws(()=>readFeed({schema:"bad"}));});
