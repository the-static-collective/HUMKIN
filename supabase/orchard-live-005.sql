-- HUMKIN Orchard 005: relay-assisted real listener-to-listener snapshot service.
-- The phone responds only while the browser is open and opted in.
alter table public.humkin_orchard_nodes add column if not exists serving_until timestamptz;
alter table public.humkin_orchard_artifacts drop constraint if exists humkin_orchard_artifacts_origin_check;
alter table public.humkin_orchard_artifacts add constraint humkin_orchard_artifacts_origin_check
 check(origin in ('welcome:cup','welcome:seed','catalog:verified','live:served'));
create unique index if not exists humkin_orchard_one_porch_bell_issued
 on public.humkin_orchard_artifacts(issued_to,origin) where origin='live:served';
create table if not exists public.humkin_orchard_live_requests (
 id uuid primary key default gen_random_uuid(),
 requester_id text not null references public.humkin_orchard_nodes(id),
 target_id text not null references public.humkin_orchard_nodes(id),
 state text not null default 'pending' check(state in ('pending','served','expired')),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+ interval '2 minutes'),
 served_at timestamptz,
 served_home jsonb,
 check(requester_id<>target_id),
 check(served_home is null or octet_length(served_home::text)<=6000)
);
create unique index if not exists humkin_orchard_one_live_pending
 on public.humkin_orchard_live_requests(requester_id,target_id) where state='pending';
create index if not exists humkin_orchard_live_target
 on public.humkin_orchard_live_requests(target_id,created_at desc);
alter table public.humkin_orchard_live_requests enable row level security;
revoke all on public.humkin_orchard_live_requests from public,anon,authenticated;
grant select,insert,update,delete on public.humkin_orchard_live_requests to service_role;
comment on table public.humkin_orchard_live_requests is 'Foreground-only GHoT-shaped bounded relay: a volunteer browser replies with a sanitized current public HOME. Server witnesses delivery, not battery uptime, unique CPU work or financial stake.';
create or replace function public.humkin_orchard_serve_live(
 p_actor text,p_request uuid,p_home jsonb
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v public.humkin_orchard_live_requests%rowtype;
 v_public boolean;v_until timestamptz;v_art uuid;
begin
 select * into v from public.humkin_orchard_live_requests where id=p_request for update;
 if not found or v.target_id<>p_actor or v.state<>'pending' or v.expires_at<=now()
 then raise exception 'No current live request for this listener';end if;
 select is_public,serving_until into v_public,v_until
 from public.humkin_orchard_nodes where id=p_actor;
 if not v_public or v_until is null or v_until<=now()
 then raise exception 'Public service consent expired';end if;
 if p_home is null or octet_length(p_home::text)>4000
 then raise exception 'Invalid live snapshot size';end if;
 update public.humkin_orchard_live_requests
 set state='served',served_home=p_home,served_at=now() where id=p_request;
 -- Unique-on-ISSUER, not current owner, so a bell remains tradable.
 insert into public.humkin_orchard_artifacts(owner_id,issued_to,kind,origin,origin_ref)
 values(p_actor,p_actor,'porch-bell','live:served',p_request)
 on conflict do nothing returning id into v_art;
 return jsonb_build_object('served',true,'request_id',p_request,
   'first_service_artifact',v_art,'source','foreground-device-snapshot');
end $$;
revoke all on function public.humkin_orchard_serve_live(text,uuid,jsonb)
 from public,anon,authenticated;
grant execute on function public.humkin_orchard_serve_live(text,uuid,jsonb) to service_role;
