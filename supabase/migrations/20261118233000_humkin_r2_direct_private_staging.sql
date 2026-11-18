-- HUMKIN: private direct R2 staging alongside legacy Supabase drafts.
-- Only published / verified R2 keys can be emitted to public radio.
alter table public.humkin_radio_tracks
  add column if not exists r2_staging_key text,
  add column if not exists r2_upload_verified_at timestamptz;

alter table public.humkin_radio_tracks
  drop constraint if exists humkin_radio_storage_provider_ck;
alter table public.humkin_radio_tracks
  add constraint humkin_radio_storage_provider_ck
  check (storage_provider in ('supabase','r2','r2_private'));

alter table public.humkin_radio_tracks
  drop constraint if exists humkin_radio_r2_key_ck;
alter table public.humkin_radio_tracks
  add constraint humkin_radio_r2_key_ck
  check (
    (storage_provider='supabase' and r2_object_key is null and r2_staging_key is null)
    or
    (storage_provider='r2_private' and published_at is null and enabled=false
     and r2_object_key is null
     and r2_staging_key ~ '^stage/[0-9a-f-]{36}/[0-9a-f]{64}[.]mp3$')
    or
    (storage_provider='r2' and r2_staging_key is null
     and r2_object_key ~ '^tracks/[0-9a-f-]{36}/[0-9a-f]{64}[.]mp3$'
     and r2_synced_at is not null)
  );

create unique index if not exists humkin_radio_private_stage_key_unique
  on public.humkin_radio_tracks (r2_staging_key)
  where r2_staging_key is not null;

comment on column public.humkin_radio_tracks.r2_staging_key is
  'Owner-only unpublished R2 object pointer in humkin-radio-private; cleared before public playback.';
comment on column public.humkin_radio_tracks.r2_upload_verified_at is
  'Private object full SHA-256 and byte length verified by owner-authenticated edge function.';

-- Public table RLS remains unchanged; unpublished rows are still owner-only.
