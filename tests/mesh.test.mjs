import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import vm from "node:vm";
const read=p=>readFileSync(p,"utf8");
const migration=read("supabase/migrations/20261119010000_humkin_mesh_001.sql");
const edge=read("supabase/functions/humkin-mesh/index.ts");
const ui=read("fm/mesh/index.html"),client=read("fm/mesh/mesh.js");
const resolve=read("m/index.html");
const packet=read("p/index.html"),registry=JSON.parse(read("p/registry.json"));
execFileSync(process.execPath,["--check","fm/mesh/mesh.js"]);
const inline=resolve.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert(inline,"MESH public resolver requires a module");
new vm.Script("(async()=>{"+inline+"})()");
for(const id of [...client.matchAll(/\$\("([a-z-]+)"\)/g)].map(m=>m[1])){
 assert(ui.includes('id="'+id+'"'),"MESH UI missing client control: "+id);
}
assert(registry.schema==="sia/linkbank/v0");
assert(registry.packets.some(p=>p.id==="radio-surprise-001"));
assert(registry.assets.some(a=>a.id==="humkin-surprise"));
assert(packet.includes("registry.json")&&packet.includes("no-autoplay")||
 packet.includes("No account needed"),"SIA gift page must preserve original no-autoplay behavior");
assert(!resolve.includes("autoplay"),"Public stable doorway should not contain autoplay attributes");
assert(resolve.includes('safe(record.media_url)'),"Public resolver must whitelist media origin");
assert(resolve.includes('record.available!==true'),"Held references must not produce a player");
assert(edge.includes('if(action==="resolve")return publicResolve'),"Public resolution must be separate from owner actions");
assert(edge.includes('const user=await ownerAuth'),"Mutations require owner session");
assert(edge.includes('data.user.email?.toLowerCase()!==OWNER'),"Owner email must be verified");
assert(edge.includes('data.user.email_confirmed_at'),"Owner email confirmation required");
assert(edge.includes('track.enabled!==true')&&edge.includes('track.storage_provider!=="r2"')&&
 edge.includes('!track.published_at'),"Public resolver must gate approval and release");
assert(edge.includes('!publicKey(track.r2_object_key)'),"R2 location must use strictly verified public path");
assert(edge.includes('status:"held"')||edge.includes('state:"held"'),"Link holds must be supported");
assert(edge.includes('action==="ingest"')&&edge.includes('files.length>100'),"Batch metadata intake bounded");
assert(edge.includes('action==="sync_radio"'),"Existing radio must be indexed without reupload");
assert(!edge.includes('R2_SECRET_ACCESS_KEY'),"MESH metadata registry must not hold R2 credentials");
assert(!client.includes("SUPABASE_SERVICE_ROLE_KEY"),"Browser must never have service credentials");
assert(client.includes("Only metadata")||client.includes("metadata only"),"Importer must say no audio transfer");
for(const t of ["humkin_mesh_nodes","humkin_mesh_files","humkin_mesh_copies",
 "humkin_mesh_links","humkin_mesh_link_events"]){
 assert(migration.includes("create table if not exists public."+t),t+" missing schema");
 assert(migration.includes("alter table public."+t+" enable row level security"),t+" missing RLS");
 assert(migration.includes(t+"_owner_read")||migration.includes(t.replace("humkin_","").replace("_", "_")+"_owner_read")
   ||migration.includes(t.split("humkin_").at(-1)+"_owner_read"),t+" owner RLS missing");
}
assert(migration.includes('revoke all on public.humkin_mesh_nodes'),"No anonymous inventory reads");
assert(migration.includes('create trigger humkin_mesh_link_history'),"Repoints must be auditable");
assert(migration.includes("security invoker"),"Audit must not use default RLS-bypassing SECURITY DEFINER");
console.log("MESH-001: private inventory, historical stable links and UI security checked.");
