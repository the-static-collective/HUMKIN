
-- HUMKIN HUM 001: narrow nontransferable in-app record credits, never cash.
-- No existing Station Guilds ledgers or orchard identities are altered.
create table if not exists public.humkin_hum_wallets (
  actor text primary key check (actor ~ '^[0-9a-f]{64}$'),
  public_jwk jsonb not null,
  hum integer not null default 0 check (hum between 0 and 1000000),
  earned integer not null default 0 check (earned between 0 and 100000000),
  spent integer not null default 0 check (spent between 0 and 100000000),
  broadcast_day date,
  cumulative_report_ms bigint not null default 0 check (cumulative_report_ms >= 0),
  accepted_listening_ms bigint not null default 0 check (accepted_listening_ms >= 0),
  milestone_mask integer not null default 0 check (milestone_mask between 0 and 15),
  last_report_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.humkin_hum_wallet_nonces (
  actor text not null references public.humkin_hum_wallets(actor) on delete cascade,
  nonce text not null check (nonce ~ '^[0-9a-f]{32}$'),
  kind text not null check (kind in ('listen','state','collect')),
  seen_at timestamptz not null default now(),
  primary key (actor,nonce)
);
create table if not exists public.humkin_hum_wallet_events (
  actor text not null references public.humkin_hum_wallets(actor) on delete cascade,
  event_key text not null,
  amount integer not null check (amount between -2 and 3 and amount <> 0),
  reason text not null check (reason in ('listening','collection')),
  at timestamptz not null default now(),
  primary key(actor,event_key)
);
create table if not exists public.humkin_hum_wallet_records (
  actor text not null references public.humkin_hum_wallets(actor) on delete cascade,
  song_id text not null check (song_id ~ '^[-a-z0-9]{3,90}$'),
  paid integer not null check (paid between 1 and 2),
  collected_at timestamptz not null default now(),
  primary key(actor,song_id)
);
create index if not exists humkin_hum_nonces_seen_idx on public.humkin_hum_wallet_nonces(seen_at);
create index if not exists humkin_hum_events_at_idx on public.humkin_hum_wallet_events(actor,at desc);
alter table public.humkin_hum_wallets enable row level security;
alter table public.humkin_hum_wallet_nonces enable row level security;
alter table public.humkin_hum_wallet_events enable row level security;
alter table public.humkin_hum_wallet_records enable row level security;
revoke all on public.humkin_hum_wallets, public.humkin_hum_wallet_nonces,
 public.humkin_hum_wallet_events, public.humkin_hum_wallet_records from public, anon, authenticated;
grant all on public.humkin_hum_wallets, public.humkin_hum_wallet_nonces,
 public.humkin_hum_wallet_events, public.humkin_hum_wallet_records to service_role;
comment on table public.humkin_hum_wallets is
  'Signed P-256 station device keys; HUM is capped, nontransferable convenience credit for public DRM-free songs, not cash or reviewed Station Guilds verified HUM.';
comment on table public.humkin_hum_wallet_events is
  'Reproducible idempotent credit/debit receipts; client-reported listening is rate-bounded, never cryptographically verified acoustic proof.';

create or replace function public.humkin_hum_wallet_apply(
  p_actor text, p_nonce text, p_action text,
  p_played_ms bigint default 0, p_song_id text default '', p_price integer default 0
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
 w public.humkin_hum_wallets%rowtype;
 now_at timestamptz := clock_timestamp();
 station_day date := (clock_timestamp() at time zone 'America/Chicago')::date;
 elapsed_ms bigint;
 allowed_ms bigint;
 delta_ms bigint;
 newly_awarded integer := 0;
 gate integer;
 cost integer;
 owned boolean := false;
 records jsonb := '[]'::jsonb;
begin
 if p_actor !~ '^[0-9a-f]{64}$' or p_nonce !~ '^[0-9a-f]{32}$'
   or p_action not in ('listen','state','collect') then
   raise exception 'Invalid HUM request';
 end if;
 select * into w from public.humkin_hum_wallets
  where actor=p_actor for update;
 if not found then raise exception 'Unknown HUM key'; end if;
 insert into public.humkin_hum_wallet_nonces(actor,nonce,kind)
   values(p_actor,p_nonce,p_action);
 -- The nonce insert and wallet effects commit or roll back together.
 if w.broadcast_day is distinct from station_day then
   update public.humkin_hum_wallets
   set broadcast_day=station_day,
       cumulative_report_ms=0,accepted_listening_ms=0,
       milestone_mask=0,last_report_at=now_at,updated_at=now_at
   where actor=p_actor;
   w.broadcast_day:=station_day;
   w.cumulative_report_ms:=0;
   w.accepted_listening_ms:=0;
   w.milestone_mask:=0;
   w.last_report_at:=now_at;
 end if;
 if p_action='listen' then
   if p_played_ms<0 or p_played_ms>86400000 then
     raise exception 'Invalid listening counter';
   end if;
   if p_played_ms>=w.cumulative_report_ms then
     elapsed_ms:=greatest(0,(extract(epoch from now_at-w.last_report_at)*1000)::bigint);
     -- Short network jitter allowance, never an arbitrary offline dump.
     allowed_ms:=least(120000,elapsed_ms+10000);
     delta_ms:=least(p_played_ms-w.cumulative_report_ms,allowed_ms);
     w.accepted_listening_ms:=w.accepted_listening_ms+delta_ms;
     w.cumulative_report_ms:=p_played_ms;
   end if;
   -- Exact daily thresholds; no button and no mint for clock time alone.
   if w.accepted_listening_ms>=600000 and (w.milestone_mask & 1)=0 then
      newly_awarded:=newly_awarded+3;w.milestone_mask:=w.milestone_mask|1;
      insert into public.humkin_hum_wallet_events(actor,event_key,amount,reason)
        values(p_actor,'listen:'||station_day||':10',3,'listening');
   end if;
   if w.accepted_listening_ms>=1800000 and (w.milestone_mask & 2)=0 then
      newly_awarded:=newly_awarded+1;w.milestone_mask:=w.milestone_mask|2;
      insert into public.humkin_hum_wallet_events(actor,event_key,amount,reason)
        values(p_actor,'listen:'||station_day||':30',1,'listening');
   end if;
   if w.accepted_listening_ms>=3000000 and (w.milestone_mask & 4)=0 then
      newly_awarded:=newly_awarded+1;w.milestone_mask:=w.milestone_mask|4;
      insert into public.humkin_hum_wallet_events(actor,event_key,amount,reason)
        values(p_actor,'listen:'||station_day||':50',1,'listening');
   end if;
   if w.accepted_listening_ms>=4800000 and (w.milestone_mask & 8)=0 then
      newly_awarded:=newly_awarded+1;w.milestone_mask:=w.milestone_mask|8;
      insert into public.humkin_hum_wallet_events(actor,event_key,amount,reason)
        values(p_actor,'listen:'||station_day||':80',1,'listening');
   end if;
   update public.humkin_hum_wallets
      set hum=hum+newly_awarded,earned=earned+newly_awarded,
          cumulative_report_ms=w.cumulative_report_ms,
          accepted_listening_ms=w.accepted_listening_ms,
          milestone_mask=w.milestone_mask,last_report_at=now_at,updated_at=now_at
    where actor=p_actor;
 elsif p_action='collect' then
   -- Catalog/price are checked by edge source owner, never supplied as
   -- arbitrary client credit/debit or self-declared rights.
   if p_song_id !~ '^[-a-z0-9]{3,90}$' or p_price not in (1,2) then
     raise exception 'Invalid collection request';
   end if;
   select true into owned from public.humkin_hum_wallet_records
      where actor=p_actor and song_id=p_song_id;
   if coalesce(owned,false) is false then
     if w.hum<p_price then raise exception 'Not enough HUM'; end if;
     insert into public.humkin_hum_wallet_records(actor,song_id,paid)
       values(p_actor,p_song_id,p_price);
     insert into public.humkin_hum_wallet_events(actor,event_key,amount,reason)
       values(p_actor,'keep:'||p_song_id,-p_price,'collection');
     update public.humkin_hum_wallets
        set hum=hum-p_price,spent=spent+p_price,updated_at=now_at
        where actor=p_actor;
   end if;
 end if;
 select * into w from public.humkin_hum_wallets where actor=p_actor;
 select coalesce(jsonb_agg(song_id order by collected_at),'[]'::jsonb)
    into records from (select song_id,collected_at from public.humkin_hum_wallet_records
       where actor=p_actor order by collected_at desc limit 1000) r;
 return jsonb_build_object('schema','humkin.hum-wallet/v1','balance',w.hum,
   'earned',w.earned,'spent',w.spent,'station_day',station_day,
   'accepted_ms',w.accepted_listening_ms,'awarded',newly_awarded,
   'owned',coalesce(owned,false),'records',records,
   'scope','nontransferable_server_record_convenience');
end $$;
revoke all on function public.humkin_hum_wallet_apply(text,text,text,bigint,text,integer)
  from public,anon,authenticated;
grant execute on function public.humkin_hum_wallet_apply(text,text,text,bigint,text,integer)
 to service_role;
