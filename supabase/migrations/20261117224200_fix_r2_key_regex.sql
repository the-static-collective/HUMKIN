-- Repair literal-dot regex in the R2 key constraint.
-- The original regex stored a double-escaped backslash and rejected every
-- valid object key, causing verified uploads to fail at the DB update.
-- [.] avoids SQL/string escape ambiguity.
alter table public.humkin_radio_tracks
  drop constraint if exists humkin_radio_r2_key_ck;
alter table public.humkin_radio_tracks
  add constraint humkin_radio_r2_key_ck
  check (
    (storage_provider = 'supabase' and r2_object_key is null)
    or
    (storage_provider = 'r2'
      and r2_object_key ~ '^tracks/[0-9a-f-]{36}/[0-9a-f]{64}[.]mp3$'
      and r2_synced_at is not null)
  );
