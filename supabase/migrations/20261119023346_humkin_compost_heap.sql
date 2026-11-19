create table public.humkin_compost_responses (
  track_id text not null check (track_id ~ '^[A-Za-z0-9-]{3,90}$'),
  listener_hash text not null check (listener_hash ~ '^[a-f0-9]{64}$'),
  network_hash text not null check (network_hash ~ '^[a-f0-9]{64}$'),
  bucket bigint not null,
  stars smallint,
  reaction text check (reaction in ('dance','again','late','surprise')),
  updated_at timestamptz not null default now(),
  primary key (track_id, listener_hash, bucket),
  check ((bucket = 0 and stars between 1 and 5 and stars is not null) or
         (bucket > 0 and stars is null and reaction is null))
);
alter table public.humkin_compost_responses enable row level security;
revoke all on public.humkin_compost_responses from public, anon, authenticated;
grant select, insert, update on public.humkin_compost_responses to service_role;
create index humkin_compost_actor_time on public.humkin_compost_responses (listener_hash, updated_at);
create index humkin_compost_network_time on public.humkin_compost_responses (network_hash, updated_at);

create function public.humkin_compost_record(
  p_track text, p_listener text, p_network text, p_bucket bigint,
  p_stars smallint, p_reaction text
) returns boolean
language plpgsql
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('compost-network:' || p_network, 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('compost-listener:' || p_listener, 1));
  if (select count(*) from public.humkin_compost_responses
      where listener_hash = p_listener and updated_at > now() - interval '1 day') >= 300
     or (select count(*) from public.humkin_compost_responses
      where network_hash = p_network and updated_at > now() - interval '1 day') >= 2000 then
    return false;
  end if;
  if p_bucket = 0 then
    insert into public.humkin_compost_responses (track_id, listener_hash, network_hash, bucket, stars, reaction)
    values (p_track, p_listener, p_network, 0, p_stars, p_reaction)
    on conflict (track_id, listener_hash, bucket) do update
      set stars = excluded.stars, reaction = excluded.reaction,
          network_hash = excluded.network_hash, updated_at = now();
  else
    if not exists (select 1 from public.humkin_compost_responses
        where track_id = p_track and listener_hash = p_listener and bucket > 0
          and updated_at > now() - interval '20 minutes') then
      insert into public.humkin_compost_responses (track_id, listener_hash, network_hash, bucket)
      values (p_track, p_listener, p_network, p_bucket)
      on conflict do nothing;
    end if;
  end if;
  return true;
end
$$;

create function public.humkin_compost_stats(p_after text, p_limit integer)
returns table (id text, plays bigint, ratings bigint, stars numeric, dance bigint)
language sql stable
set search_path = ''
as $$
  select track_id, count(*) filter (where bucket > 0),
    count(*) filter (where bucket = 0), round(avg(humkin_compost_responses.stars), 2),
    count(*) filter (where reaction = 'dance')
  from public.humkin_compost_responses
  where track_id > p_after
  group by track_id order by track_id
  limit least(greatest(p_limit, 1), 500)
$$;

revoke all on function public.humkin_compost_record(text,text,text,bigint,smallint,text) from public, anon, authenticated;
grant execute on function public.humkin_compost_record(text,text,text,bigint,smallint,text) to service_role;
revoke all on function public.humkin_compost_stats(text,integer) from public, anon, authenticated;
grant execute on function public.humkin_compost_stats(text,integer) to service_role;
