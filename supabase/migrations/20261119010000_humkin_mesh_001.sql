-- HUMKIN MESH-001 · local-first content-addressed inventory and SIA-compatible public pointers.
-- Metadata only. Does not transfer audio, grant broadcasting rights, or expose local paths.
create table if not exists public.humkin_mesh_nodes(
  owner_id uuid not null references auth.users(id) on delete cascade,
  node_id uuid not null,
  label text not null check(length(label) between 1 and 120),
  kind text not null check(kind in ('local','cloud')),
  first_seen timestamptz not null default now(),
  last_seen timestamptz,
  primary key(owner_id,node_id)
);
create table if not exists public.humkin_mesh_files(
  owner_id uuid not null references auth.users(id) on delete cascade,
  sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
  bytes bigint not null check(bytes>=0 and bytes<=1099511627776),
  extension text not null check(extension in ('mp3','wav','m4a','flac','aiff','aif','ogg','opus','wma','aac','other')),
  title text not null check(length(title) between 1 and 240),
  artist text not null default '' check(length(artist)<=160),
  album text not null default '' check(length(album)<=160),
  duration_seconds double precision check(duration_seconds>=0 and duration_seconds<=86400),
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key(owner_id,sha256)
);
create table if not exists public.humkin_mesh_copies(
  owner_id uuid not null,
  node_id uuid not null,
  sha256 text not null,
  path_hash text not null check(path_hash ~ '^[0-9a-f]{64}$'),
  relative_path text not null check(length(relative_path) between 1 and 1000),
  last_seen timestamptz not null default now(),
  primary key(owner_id,node_id,sha256,path_hash),
  foreign key(owner_id,node_id) references public.humkin_mesh_nodes(owner_id,node_id) on delete cascade,
  foreign key(owner_id,sha256) references public.humkin_mesh_files(owner_id,sha256) on delete cascade
);
create index if not exists humkin_mesh_copies_sha_idx
  on public.humkin_mesh_copies(owner_id,sha256);
create table if not exists public.humkin_mesh_links(
  slug text primary key check(slug ~ '^[a-z0-9][a-z0-9-]{2,62}[a-z0-9]$'),
  owner_id uuid not null references auth.users(id) on delete cascade,
  target_track_id uuid not null references public.humkin_radio_tracks(id) on delete restrict,
  title text not null check(length(title) between 1 and 240),
  state text not null default 'held' check(state in ('held','active')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.humkin_mesh_link_events(
  id bigint generated always as identity primary key,
  slug text not null references public.humkin_mesh_links(slug) on delete restrict,
  owner_id uuid not null references auth.users(id) on delete cascade,
  old_target_track_id uuid,
  new_target_track_id uuid,
  old_state text,
  new_state text not null check(new_state in ('held','active')),
  reason text not null check(length(reason) between 1 and 240),
  changed_at timestamptz not null default now()
);
create index if not exists humkin_mesh_events_idx
  on public.humkin_mesh_link_events(owner_id,slug,changed_at desc);

alter table public.humkin_mesh_nodes enable row level security;
alter table public.humkin_mesh_files enable row level security;
alter table public.humkin_mesh_copies enable row level security;
alter table public.humkin_mesh_links enable row level security;
alter table public.humkin_mesh_link_events enable row level security;
-- These records include private local filenames. Even the link table stays owner-only;
-- the anonymous resolver publishes only explicitly approved, enabled radio track URLs.
revoke all on public.humkin_mesh_nodes, public.humkin_mesh_files, public.humkin_mesh_copies,
  public.humkin_mesh_links, public.humkin_mesh_link_events from anon;
revoke all on public.humkin_mesh_nodes, public.humkin_mesh_files, public.humkin_mesh_copies,
  public.humkin_mesh_links, public.humkin_mesh_link_events from authenticated;
grant select on public.humkin_mesh_nodes, public.humkin_mesh_files, public.humkin_mesh_copies,
  public.humkin_mesh_links, public.humkin_mesh_link_events to authenticated;

create policy "mesh_nodes_owner_read" on public.humkin_mesh_nodes for select to authenticated
 using (owner_id=(select auth.uid()));
create policy "mesh_files_owner_read" on public.humkin_mesh_files for select to authenticated
 using (owner_id=(select auth.uid()));
create policy "mesh_copies_owner_read" on public.humkin_mesh_copies for select to authenticated
 using (owner_id=(select auth.uid()));
create policy "mesh_links_owner_read" on public.humkin_mesh_links for select to authenticated
 using (owner_id=(select auth.uid()));
create policy "mesh_link_events_owner_read" on public.humkin_mesh_link_events for select to authenticated
 using (owner_id=(select auth.uid()));
