-- HUMKIN Proton TOTP-only alternate owner login.
-- Private security state; the public/anon/authenticated roles have no table access.
-- A real Supabase Auth session is minted only by the trusted Edge Function after TOTP.
create table if not exists public.humkin_proton_owner_login (
  id smallint primary key default 1 check (id=1),
  owner_id uuid not null references auth.users(id) on delete cascade,
  secret_sealed text,
  pending_sealed text,
  pending_expires_at timestamptz,
  enabled_at timestamptz,
  last_used_step bigint not null default -1,
  attempt_count integer not null default 0 check(attempt_count between 0 and 100),
  attempt_window_start timestamptz not null default now(),
  blocked_until timestamptz not null default '-infinity'::timestamptz,
  changed_at timestamptz not null default now(),
  constraint humkin_proton_enrollment_consistent
   check (enabled_at is null or secret_sealed is not null)
);

alter table public.humkin_proton_owner_login enable row level security;
revoke all on public.humkin_proton_owner_login from public,anon,authenticated;
grant select,insert,update on public.humkin_proton_owner_login to service_role;

-- Atomic attempt reservation before any TOTP comparison. A burst cannot bypass
-- the global 8 attempts/15 min limit by racing the Edge worker.
create or replace function public.humkin_proton_attempt_begin()
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  factor public.humkin_proton_owner_login%rowtype;
  t timestamptz := pg_catalog.clock_timestamp();
  attempts integer;
begin
  select * into factor from public.humkin_proton_owner_login where id=1 for update;
  if not found or factor.enabled_at is null then
    return '{"allowed":false}'::jsonb;
  end if;
  if factor.blocked_until>t then
    return '{"allowed":false}'::jsonb;
  end if;
  if t-factor.attempt_window_start>=interval '15 minutes' then
    attempts:=0;
  else
    attempts:=factor.attempt_count;
  end if;
  if attempts>=8 then
    update public.humkin_proton_owner_login
      set blocked_until=t+interval '15 minutes', changed_at=t
      where id=1;
    return '{"allowed":false}'::jsonb;
  end if;
  update public.humkin_proton_owner_login
    set attempt_count=attempts+1,
      attempt_window_start=case when attempts=0 then t else factor.attempt_window_start end,
      changed_at=t
    where id=1;
  return pg_catalog.jsonb_build_object('allowed',true,'owner_id',factor.owner_id,
    'sealed',factor.secret_sealed,'last_step',factor.last_used_step);
end $$;

-- Only one login may consume a given TOTP step, including across concurrent
-- browsers. The Edge function calls this only after verifying the actual code.
create or replace function public.humkin_proton_claim_step(p_owner uuid,p_step bigint)
returns boolean
language plpgsql security invoker set search_path = ''
as $$
declare n smallint;
begin
  if p_step<0 then return false; end if;
  update public.humkin_proton_owner_login set
    last_used_step=p_step,attempt_count=0,
    attempt_window_start=pg_catalog.clock_timestamp(),
    changed_at=pg_catalog.clock_timestamp()
  where id=1 and owner_id=p_owner and enabled_at is not null
    and last_used_step<p_step
  returning id into n;
  return n=1;
end $$;

revoke all on function public.humkin_proton_attempt_begin() from public,anon,authenticated;
revoke all on function public.humkin_proton_claim_step(uuid,bigint) from public,anon,authenticated;
grant execute on function public.humkin_proton_attempt_begin() to service_role;
grant execute on function public.humkin_proton_claim_step(uuid,bigint) to service_role;
