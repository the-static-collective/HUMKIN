import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {execFileSync} from "node:child_process";
const read=path=>readFileSync(path,"utf8");
const client=read("fm/load/r2-direct-client.mjs");
const page=read("fm/load/index.html");
const loader=read("fm/load/loader.js");
const edge=read("supabase/functions/humkin-r2-direct/index.ts");
const migration=read("supabase/migrations/20261118233000_humkin_r2_direct_private_staging.sql");
for(const path of ["fm/load/r2-direct-client.mjs","supabase/functions/humkin-r2-direct/index.ts"]){
 assert(existsSync(path),path);
}
execFileSync(process.execPath,["--check","fm/load/r2-direct-client.mjs"]);
execFileSync(process.execPath,["--input-type=module","--check"],{input:loader});
assert(page.includes('id="direct-r2-status"'),"Direct readiness state needs owner-visible UI");
for(const mark of ["refreshDirectStatus","stageDirect","putPrivateMp3","r2Direct(db,\"finalize\"",
  'r2Direct(db,"publish"','storage_provider==="r2_private"']){
 assert(loader.includes(mark),"Missing direct R2 client flow "+mark);
}
assert(loader.includes("Math.min(3,tasks.length)"),"Bulk uploader must limit concurrency");
assert(loader.includes("!row.r2_upload_verified_at"),"Unverified uploads must never publish");
assert(client.includes("https:")&&client.includes("cloudflarestorage"),
  "Presigned PUT URL must remain on Cloudflare's S3 endpoint");
assert(client.includes('xhr.setRequestHeader("Content-Type","audio/mpeg")'),
  "Signed Content-Type must match PUT header");
assert(!client.includes("HUMKIN_R2_PRIVATE_SECRET"),"Never place private R2 key in browser");
for(const mark of ['getUser(token)','email_confirmed_at','PRIVATE_BUCKET!==PUBLIC_BUCKET',
  'signQuery:true,allHeaders:true','"Content-Type":"audio/mpeg"',
  'sha(bytes)','PRIVATE_FILE_HASH_MISMATCH','PRIVATE_FILE_MISSING_OR_SIZE_WRONG',
  'if(!row.r2_upload_verified_at)','Range:"bytes=0-0"',
  'enabled:true','r2_staging_key:null']){
 assert(edge.includes(mark),"Missing security invariant: "+mark);
}
assert(edge.includes('if(origin&&!ORIGINS.has(origin))'),"Block unexpected website origins");
assert(edge.includes('PRIVATE_PAIR_COMPLETE?PRIVATE_ACCESS_CONFIG:PUBLIC_ACCESS')&&
 edge.includes('PRIVATE_PAIR_COMPLETE?PRIVATE_SECRET_CONFIG:PUBLIC_SECRET'),
 "Private bucket may reuse complete existing server-only credentials, never public JS secrets");
assert(edge.includes('credential_mode:PRIVATE_CREDENTIAL_MODE'),"Owner readiness report should identify which credential route was selected");
assert(edge.includes('auth?.user'),"Auth must resolve actual Supabase user");
assert(edge.indexOf('await privateAws.fetch(objectUrl(PRIVATE_BUCKET,row.r2_staging_key)')>
       edge.indexOf('R2_CATALOG_PUBLICATION_FAILED'),"Staging cleanup must follow committed public catalog state");
assert(migration.includes("published_at is null and enabled=false"),"Private drafts must be unpublished and disabled");
assert(migration.includes("r2_staging_key is null"),"Public rows must not retain private staging pointers");
console.log("Private R2 direct intake static security and UI checks passed.");
