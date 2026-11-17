-- Track when a redundant Supabase copy has been removed after verified R2 delivery.
alter table public.humkin_radio_tracks
 add column if not exists supabase_source_removed_at timestamptz;
comment on column public.humkin_radio_tracks.supabase_source_removed_at is
 'Set only after R2 is authoritative and the former Supabase Storage object was deleted.';
