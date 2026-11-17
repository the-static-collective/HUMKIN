-- HUMKIN R2 primary-storage bridge, additive and reversible.
-- Existing published Supabase audio stays readable until each row is copied and verified.
alter table public.humkin_radio_tracks
  add column if not exists storage_provider text not null default 'supabase',
  add column if not exists r2_object_key text,
  add column if not exists r2_synced_at timestamptz;

alter table public.humkin_radio_tracks
  add constraint humkin_radio_storage_provider_ck
    check (storage_provider in ('supabase','r2')),
  add constraint humkin_radio_r2_key_ck
    check (
      (storage_provider='supabase' and r2_object_key is null)
      or
      (storage_provider='r2' and
       r2_object_key ~ '^tracks/[0-9a-f-]{36}/[0-9a-f]{64}\\.mp3$' and
       r2_synced_at is not null)
    );
create unique index if not exists humkin_radio_r2_object_key_unique
  on public.humkin_radio_tracks (r2_object_key)
  where r2_object_key is not null;
comment on column public.humkin_radio_tracks.storage_provider is
  'Authoritative radio audio origin: Supabase Storage (legacy/fallback) or Cloudflare R2 after verified copy.';
comment on column public.humkin_radio_tracks.r2_object_key is
  'Public R2 object path inside humkin-radio-media; no credentials or presigned URL.';
comment on column public.humkin_radio_tracks.r2_synced_at is
  'UTC timestamp set only after R2 PUT, HEAD and public GET verify object bytes.';
-- Existing row ownership/RLS policies remain unchanged.
