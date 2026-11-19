import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";

test("monthly read-only endpoint is owner gated before database operations",()=>{
 const edge=readFileSync("supabase/functions/humkin-monthly-council/index.ts","utf8");
 assert(edge.includes("await owner(req)"),"Owner JWT must be checked");
 assert(edge.indexOf("await owner(req)")<edge.indexOf("await monthlySnapshot(month)"),
   "Owner access should precede any monthly query");
 assert(edge.includes('db.auth.getUser(auth.slice(7))'),"Never trust owner email from body");
 assert(edge.includes('data.user.email?.toLowerCase()!==OWNER'));
 assert(edge.includes("supabase-js@2.57.0"),"Pinned dependency");
 assert(edge.includes('Cache-Control":"private, no-store"'));
 // Intentionally no write/mutation routes or exposure of hashed identities.
 assert(!edge.includes(".insert("));
 assert(!edge.includes(".upsert("));
 assert(!edge.includes(".delete("));
 assert(!edge.includes(".update("));
 for(const forbidden of ["actor_hash,network_hash","SELECT *","service_role:"]){
   assert(!edge.includes(forbidden),forbidden);
 }
});
test("monthly API explicitly labels incomplete historical weather and events",()=>{
 const source=readFileSync("supabase/functions/humkin-monthly-council/index.ts","utf8");
 assert(source.includes("complete:false"),"Only a frozen verified month can become final");
 assert(source.includes('event_feed_status:"not_connected"'));
 assert(source.includes('"current_weekly_reaction_snapshots_not_immutable_monthly_events"'));
 assert(source.includes('rangedRows("humkin_listener_weather"'));
 assert(source.includes('rangedRows("humkin_league_records"'));
 assert(source.includes('db.rpc("humkin_league_scores"'));
});
