-- ARCHIVE JANITOR 001. Default HELD; explicit enable only after audit.
create table if not exists public.humkin_archive_janitor_config (
 id integer primary key check(id=1),
 owner_id uuid not null,
 token_hash text not null check(token_hash ~ '^[0-9a-f]{64}$'),
 enabled boolean not null default false
);
alter table public.humkin_archive_janitor_config enable row level security;
revoke all on public.humkin_archive_janitor_config from public,anon,authenticated;
grant select on public.humkin_archive_janitor_config to service_role;
do $$
declare t text; u uuid;
begin
 select id into strict u from auth.users where lower(email)='us@abundent.org' and email_confirmed_at is not null;
 if not exists(select 1 from public.humkin_archive_janitor_config where id=1) then
  t:=encode(extensions.gen_random_bytes(32),'hex');
  perform vault.create_secret(t,'humkin_archive_janitor_001');
  insert into public.humkin_archive_janitor_config(id,owner_id,token_hash) values(1,u,encode(extensions.digest(t,'sha256'),'hex'));
 end if;
end $$;
-- No cron created by this migration. Audit first; enable/schedule separately.
