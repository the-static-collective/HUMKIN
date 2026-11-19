-- HUMKIN PROGRAM PROPOSALS 001
-- Separate, account-free editorial work queue. No proposal can publish audio
-- or award verified HUM. Only the server-held service role may access rows.
create table if not exists public.humkin_program_proposals (
 id uuid primary key default gen_random_uuid(),
 actor_hash text not null check (actor_hash ~ '^[0-9a-f]{64}$'),
 network_hash text not null check (network_hash ~ '^[0-9a-f]{64}$'),
 title text not null check (char_length(title) between 3 and 80),
 station_id text not null check (station_id ~ '^[a-z0-9][a-z0-9-]{0,31}$'),
 day date not null,
 start_local text not null check (start_local ~ '^([01][0-9]|2[0-3]):(00|15|30|45)$'),
 duration_minutes integer not null check (duration_minutes in (30,60,90,120)),
 proposal jsonb not null check (
   jsonb_typeof(proposal) = 'object'
   and proposal->>'schema' = 'humkin.program.proposal/v1'
   and jsonb_typeof(proposal->'rules') = 'array'
   and jsonb_array_length(proposal->'rules') between 1 and 8
 ),
 state text not null default 'pending_review'
   check (state in ('pending_review','approved','declined','withdrawn')),
 reviewed_by uuid,
 reviewed_at timestamptz,
 review_note text not null default '' check (char_length(review_note) <= 500),
 created_at timestamptz not null default now()
);
alter table public.humkin_program_proposals enable row level security;
revoke all on table public.humkin_program_proposals from public, anon, authenticated;
grant select,insert,update,delete on table public.humkin_program_proposals to service_role;
create index if not exists humkin_program_actor_day_idx
 on public.humkin_program_proposals (actor_hash,created_at desc);
create index if not exists humkin_program_network_day_idx
 on public.humkin_program_proposals (network_hash,created_at desc);
create index if not exists humkin_program_pending_idx
 on public.humkin_program_proposals (state,created_at desc);
comment on table public.humkin_program_proposals is
 'Private Gambit proposal review queue. Approval permits operator export only; it NEVER publishes to Cloud Autopilot.';
