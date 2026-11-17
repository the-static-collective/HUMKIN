import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(path,"utf8");
const radio=read("fm/radio.js");
const loader=read("fm/load/loader.js");
const manager=read("fm/manage/manager.js");
const studio=read("fm/studio/studio.js");
const managerHTML=read("fm/manage/index.html");
const loaderHTML=read("fm/load/index.html");
const edge=read("supabase/functions/humkin-r2-bridge/index.ts");
const migration=read("supabase/migrations/20261117215000_humkin_r2_storage_bridge.sql");
const r2=read("fm/r2-catalog.js");
assert(radio.includes("storage_provider,r2_object_key"),"Radio reads backend provenance");
assert(radio.includes('row.storage_provider==="r2"'),"Radio selects R2 URL by DB provider");
assert(radio.includes("HUMKIN_R2_CATALOG?.objectUrl"),"No arbitrary storage host");
assert(loader.includes('r2Bridge(db,"publish",row.id)'),"Loader publishes to R2");
assert(loader.includes('db.storage.from(INBOX).upload'),"Private draft staging retained");
assert(loader.includes('error.code!=="R2_NOT_CONFIGURED"'),"Only missing keys fall back to legacy publication");
assert(manager.includes('r2Bridge(db,action,track.dbId)'),"Manager can migrate and reclaim batches");
assert(manager.includes('sourceRemoved'),"Storage accounting tracks physical originals");
assert(manager.includes('R2 manifest')||manager.includes('r2Static'),"Manager shows manual R2 uploads");
assert(studio.includes('buildLibrary(config,cloud.data,overrides.data,r2Manifest)'),"Production reads R2 manual catalog");
assert(studio.includes('t.storage_provider==="r2"'),"Production routes published crate to R2");
for(const id of ["r2-migrate","r2-cleanup","r2-status","r2-progress"]){
 assert(managerHTML.includes('id="'+id+'"'),"Missing control "+id);
}
assert(loaderHTML.includes('id="r2-storage-note"'),"Loader must report backend status");
assert(edge.includes('db.auth.getUser(token)'),"Server must verify JWT against Supabase Auth");
assert(edge.includes('user.email_confirmed_at'),"Server requires verified identity");
assert(edge.includes('row.uploaded_by!==user.id'),"Server checks record ownership");
assert(edge.includes('digestHex(contents)'),"R2 transfer checks SHA-256");
assert(edge.includes('source_retained:true'),"Migration retains old copy");
assert(edge.includes('action==="cleanup"'),"Source cleanup is separate");
assert(edge.includes('HUMKIN_R2_SECRET_ACCESS_KEY'),"Credential is only inside Edge Function");
for(const bad of [manager,loader,studio,radio,r2]){
 assert(!bad.includes("HUMKIN_R2_SECRET_ACCESS_KEY"),"No browser R2 credentials");
}
assert(migration.includes("storage_provider"),"Schema has provider");
assert(migration.includes("r2_object_key"),"Schema has object key");
assert(migration.includes("r2_synced_at"),"Schema marks verified copy");
console.log("HUMKIN R2 primary storage plumbing verified");
