-- HUMKIN BLUE LEMON 001: isolated broadcast priority queue. No cards or keys issued here.
-- Public-schema tables are RLS-denied; only the dedicated Edge Function uses service_role.
create table if not exists public.humkin_lemon_workers (
 worker_id text primary key check (worker_id ~ '^[a-z0-9_-]{3,48}$'),
 secret_sha256 text not null unique check (secret_sha256 ~ '^[0-9a-f]{64}$'),
 enabled boolean not null default false,
 last_seen_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.humkin_lemon_catalog (
 track_id text primary key check (length(track_id) between 2 and 160),
 title text not null check (length(title) between 1 and 200),
 artist text not null default 'HUMKIN',
 enabled boolean not null default true,
 updated_at timestamptz not null default now()
);
create table if not exists public.humkin_lemon_cards (
 serial smallint primary key check (serial between 1 and 42),
 claim_sha256 text unique check (claim_sha256 is null or claim_sha256 ~ '^[0-9a-f]{64}$'),
 enabled boolean not null default false,
 created_at timestamptz not null default now(),
 note text not null default ''
);
create table if not exists public.humkin_lemon_queue (
 id uuid primary key default gen_random_uuid(),
 serial smallint not null references public.humkin_lemon_cards(serial),
 track_id text not null references public.humkin_lemon_catalog(track_id),
 station_day date not null,
 status text not null default 'queued'
   check (status in ('queued','leased','aired','failed')),
 submitted_at timestamptz not null default now(),
 lease_worker text references public.humkin_lemon_workers(worker_id),
 lease_until timestamptz,
 aired_at timestamptz,
 fail_reason text,
 constraint humkin_lemon_one_per_day unique (serial, station_day)
);
create index if not exists humkin_lemon_pending_idx
 on public.humkin_lemon_queue (submitted_at, id) where status in ('queued','leased');
comment on table public.humkin_lemon_cards is
 'Unissued until human print review. Printed copy, activation credential and digital custody are separate. Limit 42.';
comment on table public.humkin_lemon_queue is
 'One requested song per enabled Blue Lemon per Chicago station day; aired is only set by authenticated source worker.';
do $ddl$ declare t text; begin
 foreach t in array array['humkin_lemon_workers','humkin_lemon_catalog','humkin_lemon_cards','humkin_lemon_queue'] loop
  execute format('alter table public.%I enable row level security', t);
  execute format('revoke all on public.%I from public, anon, authenticated', t);
  execute format('grant select, insert, update, delete on public.%I to service_role', t);
 end loop;
end $ddl$;
-- There are deliberately zero minted cards, public credentials, or worker keys.
