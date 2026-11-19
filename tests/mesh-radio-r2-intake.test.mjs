import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {test} from "node:test";
const read=path=>readFileSync(path,"utf8");
const ui=read("fm/mesh-radio/index.html");
const client=read("fm/mesh-radio/r2-intake.mjs");
const desk=read("fm/mesh-radio/desk.mjs");
const old=read("fm/load/r2-direct-client.mjs");
const edge=read("supabase/functions/humkin-r2-direct/index.ts");

test("R2 controls are visible in the actual Linkblocks player",()=>{
  for(const id of ["r2-check","r2-connection","r2-send-link","r2-verify-link",
    "r2-paste-link","r2-upload","r2-progress","r2-upload-count",
    "r2-drafts","r2-publish","r2-refresh","r2-message","r2-login"]){
    assert(ui.includes('id="'+id+'"'),"Missing button / state: "+id);
  }
  assert(desk.includes('installR2Intake('),"Desk does not wire the uploader.");
  assert(desk.includes('onPublished:loadPublishedFromR2'),
    "Public catalog must refresh after successful publication.");
  assert(desk.includes('record:graph.recordings.find('),
    "Uploads should carry the selected file's existing Linkblocks metadata.");
});
test("uploader uses pre-existing Supabase R2 backend and never embeds an R2 secret",()=>{
  for(const src of [client,desk]){
    assert(!src.includes("HUMKIN_R2_SECRET_ACCESS_KEY"));
    assert(!src.includes("HUMKIN_R2_ACCESS_KEY_ID"));
    assert(!src.includes("SERVICE_ROLE_KEY"));
    assert(!src.includes("cloudflarestorage.com/")||src===desk);
  }
  assert(client.includes('import("../load/r2-direct-client.mjs")'),
    "Keep one owner-scoped upload implementation.");
  assert(client.includes('import("https://esm.sh/@supabase/supabase-js@2.57.0")'),
    "Load the same pinned auth client only when needed.");
  assert(client.includes('email:OWNER'));
  assert(client.includes('verifyOtp({token_hash:token,type})'));
  assert(client.includes('direct(c,"status")'));
  assert(client.includes('direct(c,"prepare",meta)'));
  assert(client.includes("await putPrivateMp3(file,preparation.put_url)"));
  assert(client.includes('direct(c,"finalize",{track_id:preparation.track_id})'));
  assert(client.includes('direct(c,"publish",{track_id:item.id})'));
  assert(old.includes('xhr.open("PUT"'));
  assert(edge.includes('if(action==="prepare")')&&edge.includes('if(action==="finalize")'));
});
test("publication is owner-triggered after verified private staging",()=>{
  assert(client.includes('if(!confirm("Publish "'));
  assert(client.includes('.not("r2_upload_verified_at","is",null)'));
  assert(client.includes('.eq("storage_provider","r2_private")'));
  assert(client.includes('.eq("uploaded_by",session.user.id)'));
  assert(client.includes('if(result.published!==true)'));
  assert(client.includes('Nothing was published automatically.'));
  assert(!client.includes('autoPublish'));
});
test("only MP3 is directly uploaded, and endpoint enforces the 50 MiB limit",()=>{
  assert(client.includes('/\\.mp3$/i.test(x.file.name)'));
  assert(client.includes("MAX_BYTES=50*1024*1024"));
  assert(client.includes("Math.min(3,items.length)"));
  assert(client.includes("durationOf(file)"));
  assert(client.includes('file.name.slice(0,240)'));
});
test("page and source modules pass syntax checks",()=>{
  execFileSync(process.execPath,["--check","fm/mesh-radio/desk.mjs"]);
  execFileSync(process.execPath,["--check","fm/mesh-radio/r2-intake.mjs"]);
  execFileSync(process.execPath,["--check","fm/load/r2-direct-client.mjs"]);
});
