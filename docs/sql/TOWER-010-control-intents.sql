-- TOWER 010: append-only, publicly inspectable station commands (track IDs only).
-- A request never authorizes cloud publication; an R2 revision receipt must follow.
create table if not exists public.humkin_tower_control_intents (
  id bigint generated always as identity primary key,
  owner_id uuid not null,
  track_id uuid not null references public.humkin_radio_tracks(id),
  action text not null check (action in ('queue_next','queue_end','hold','release','more','less')),
  requested_at timestamptz not null default now()
);
comment on table public.humkin_tower_control_intents is
'Public-safe control requests for station-one, issued only by the authenticated HUMKIN owner. No caller can mark a request accepted/on-air; cloud output is independent.';
create index if not exists humkin_tower_control_intents_requested_idx
  on public.humkin_tower_control_intents (id);
alter table public.humkin_tower_control_intents enable row level security;
revoke all on public.humkin_tower_control_intents from public, anon, authenticated;
grant select (id, track_id, action, requested_at)
  on public.humkin_tower_control_intents to anon, authenticated;
grant insert (owner_id, track_id, action)
  on public.humkin_tower_control_intents to authenticated;
create policy humkin_tower_control_public_read
 on public.humkin_tower_control_intents for select to anon,authenticated using (true);
create policy humkin_tower_control_owner_request
 on public.humkin_tower_control_intents for insert to authenticated
 with check (
    (select auth.uid()) = owner_id
    and lower(coalesce(auth.jwt()->>'email','')) = 'us@abundent.org'
    and exists (
       select 1 from public.humkin_radio_tracks track
       where track.id=track_id
         and track.published_at is not null
         and track.enabled=true
         and track.storage_provider='r2'
         and (action not in ('more','less') or track.kind='song')
    )
 );
