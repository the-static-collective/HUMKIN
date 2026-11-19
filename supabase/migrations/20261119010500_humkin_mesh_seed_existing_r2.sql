-- Populate MESH's cloud node with existing verified, published R2 entries.
-- These are observations of existing files, NOT new publications or transfers.
insert into public.humkin_mesh_nodes(owner_id,node_id,label,kind,last_seen)
select distinct uploaded_by,'6fa7ccdf-d12a-4634-9c20-544be2db7cf3'::uuid,
  'Cloudflare R2 · public radio','cloud',now()
from public.humkin_radio_tracks
where storage_provider='r2' and published_at is not null
  and r2_object_key is not null
on conflict (owner_id,node_id) do nothing;

insert into public.humkin_mesh_files(owner_id,sha256,bytes,extension,title,artist,album,duration_seconds)
select uploaded_by,sha256,bytes,'mp3',title,artist,album,duration_seconds
from public.humkin_radio_tracks
where storage_provider='r2' and published_at is not null
  and r2_object_key ~ '^tracks/[0-9a-f-]{36}/[0-9a-f]{64}[.]mp3$'
  and sha256 ~ '^[0-9a-f]{64}$'
on conflict (owner_id,sha256) do nothing;

insert into public.humkin_mesh_copies(owner_id,node_id,sha256,path_hash,relative_path,last_seen)
select uploaded_by,'6fa7ccdf-d12a-4634-9c20-544be2db7cf3'::uuid,sha256,
  encode(sha256(convert_to(r2_object_key,'UTF8')),'hex'),
  r2_object_key,now()
from public.humkin_radio_tracks
where storage_provider='r2' and published_at is not null
  and r2_object_key ~ '^tracks/[0-9a-f-]{36}/[0-9a-f]{64}[.]mp3$'
  and sha256 ~ '^[0-9a-f]{64}$'
on conflict (owner_id,node_id,sha256,path_hash) do nothing;
