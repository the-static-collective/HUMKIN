-- HUMKIN Top 42 / Requests v1. Deployed through Supabase migrations.
-- Nominations are NOT music listens, public votes or a broadcasting contract.
-- Only the Edge Function's service role can read/write these private rows.
create table if not exists public.humkin_league_beacons (
  id bigint generated always as identity primary key,
  station_day date not null,
  track_id text not null check (track_id ~ '^[-a-z0-9]{3,90}$'),
  actor_hash text not null check (actor_hash ~ '^[0-9a-f]{64}$'),
  network_hash text not null check (network_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (station_day,actor_hash)
);
create index if not exists humkin_league_beacons_chart
 on public.humkin_league_beacons(station_day,track_id);
create index if not exists humkin_league_beacons_network
 on public.humkin_league_beacons(station_day,network_hash);
alter table public.humkin_league_beacons enable row level security;
revoke all on public.humkin_league_beacons from public,anon,authenticated;
revoke all on sequence public.humkin_league_beacons_id_seq from public,anon,authenticated;
grant select,insert on public.humkin_league_beacons to service_role;
grant usage,select on sequence public.humkin_league_beacons_id_seq to service_role;
