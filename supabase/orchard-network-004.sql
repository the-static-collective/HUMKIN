-- HUMKIN ORCHARD NETWORK 004. Additive only; does not touch Top 42 or guild rewards.
-- All public API tables are private behind RLS; only Edge service role may mutate them.
create table if not exists public.humkin_orchard_nodes (
  id text primary key check (id ~ '^[0-9a-f]{64}$'),
  public_jwk jsonb not null,
  display_name text not null default 'A Neighbor' check (char_length(display_name) between 1 and 32),
  is_public boolean not null default false,
  home jsonb not null default '{}'::jsonb check (octet_length(home::text) <= 8000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen timestamptz,
  last_publish_at timestamptz
);
comment on table public.humkin_orchard_nodes is 'P-256 self-custodied volunteer identities. Opt-in public HOME is a sanitized projection; heartbeat only means signed recent contact, never that phone serves remote requests.';
create table if not exists public.humkin_orchard_nonces (
  id bigint generated always as identity primary key,
  node_id text not null references public.humkin_orchard_nodes(id) on delete cascade,
  nonce text not null check (nonce ~ '^[0-9a-f]{32,64}$'),
  action text not null check (char_length(action) between 2 and 40),
  created_at timestamptz not null default now(),
  unique(node_id, nonce)
);
create index if not exists humkin_orchard_nonces_recent on public.humkin_orchard_nonces(node_id,created_at desc);
create table if not exists public.humkin_orchard_artifacts (
  id uuid primary key default gen_random_uuid(),
  serial bigint generated always as identity unique,
  owner_id text not null references public.humkin_orchard_nodes(id) on delete restrict,
  issued_to text not null references public.humkin_orchard_nodes(id),
  kind text not null check (kind ~ '^[a-z0-9-]{3,50}$'),
  origin text not null check (origin in ('welcome:cup','welcome:seed','catalog:verified')),
  origin_ref uuid,
  created_at timestamptz not null default now(),
  unique(owner_id, origin, origin_ref)
);
comment on table public.humkin_orchard_artifacts is 'Server-issued provenance collectibles, not monetary tokens. Ordinary kinds are not scarce; serial is a unique historical identifier only.';
create unique index if not exists humkin_orchard_unique_welcome_issuance on public.humkin_orchard_artifacts(issued_to,origin) where origin in ('welcome:cup','welcome:seed');
create index if not exists humkin_orchard_owner on public.humkin_orchard_artifacts(owner_id,created_at);
create table if not exists public.humkin_orchard_offers (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.humkin_orchard_artifacts(id),
  sender_id text not null references public.humkin_orchard_nodes(id),
  recipient_id text not null references public.humkin_orchard_nodes(id),
  status text not null default 'open' check (status in ('open','accepted','cancelled','expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '1 day'),
  decided_at timestamptz,
  check (sender_id<>recipient_id)
);
create unique index if not exists humkin_orchard_one_open_offer_per_artifact
  on public.humkin_orchard_offers(artifact_id) where status='open';
create index if not exists humkin_orchard_offers_inbox
  on public.humkin_orchard_offers(recipient_id,status,created_at desc);
create table if not exists public.humkin_orchard_challenges (
  id uuid primary key default gen_random_uuid(),
  node_id text not null references public.humkin_orchard_nodes(id) on delete cascade,
  capability text not null default 'radio.catalog.audit.v1' check (capability='radio.catalog.audit.v1'),
  expected_digest text not null check (expected_digest ~ '^[0-9a-f]{64}$'),
  track_count integer not null check(track_count between 1 and 1000),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '2 minutes'),
  completed_at timestamptz
);
create index if not exists humkin_orchard_challenges_recent on public.humkin_orchard_challenges(node_id,created_at desc);
create table if not exists public.humkin_orchard_receipts (
  id uuid primary key default gen_random_uuid(),
  node_id text not null references public.humkin_orchard_nodes(id),
  challenge_id uuid not null unique references public.humkin_orchard_challenges(id),
  station_day date not null,
  capability text not null default 'radio.catalog.audit.v1',
  digest text not null check(digest ~ '^[0-9a-f]{64}$'),
  track_count integer not null check(track_count between 1 and 1000),
  validated_at timestamptz not null default now(),
  unique(node_id, station_day, capability)
);
comment on table public.humkin_orchard_receipts is 'Validated public catalog agreement with a signed volunteer identity. Not proof of unique CPU labor, continuous hosting or a native GHoT peer.';
-- RLS is defense in depth. No direct anonymous or authenticated Data API access.
alter table public.humkin_orchard_nodes enable row level security;
alter table public.humkin_orchard_nonces enable row level security;
alter table public.humkin_orchard_artifacts enable row level security;
alter table public.humkin_orchard_offers enable row level security;
alter table public.humkin_orchard_challenges enable row level security;
alter table public.humkin_orchard_receipts enable row level security;
revoke all on public.humkin_orchard_nodes,public.humkin_orchard_nonces,
 public.humkin_orchard_artifacts,public.humkin_orchard_offers,
 public.humkin_orchard_challenges,public.humkin_orchard_receipts
 from public,anon,authenticated;
grant select,insert,update,delete on public.humkin_orchard_nodes,
 public.humkin_orchard_nonces,public.humkin_orchard_artifacts,
 public.humkin_orchard_offers,public.humkin_orchard_challenges,
 public.humkin_orchard_receipts to service_role;
grant usage,select on all sequences in schema public to service_role;

-- All mutations invoked by Edge using service_role after a verified P-256 signature.
-- Lock the artifact before changing its owner. No multi-step client transfers.
create or replace function public.humkin_orchard_offer_open(
  p_sender text,p_recipient text,p_artifact uuid
) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_owner text;v_id uuid;
begin
 if p_sender=p_recipient then raise exception 'Cannot trade with yourself';end if;
 if not exists(select 1 from public.humkin_orchard_nodes where id=p_recipient)
   then raise exception 'Recipient identity not found';end if;
 select owner_id into v_owner from public.humkin_orchard_artifacts
   where id=p_artifact for update;
 if v_owner is null or v_owner<>p_sender then raise exception 'Not current artifact owner';end if;
 update public.humkin_orchard_offers set status='expired',decided_at=now()
   where artifact_id=p_artifact and status='open' and expires_at<=now();
 insert into public.humkin_orchard_offers(artifact_id,sender_id,recipient_id)
   values(p_artifact,p_sender,p_recipient) returning id into v_id;
 return v_id;
end $$;
create or replace function public.humkin_orchard_offer_accept(
  p_recipient text,p_offer uuid
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_offer public.humkin_orchard_offers%rowtype;v_owner text;v_serial bigint;v_kind text;
begin
 select * into v_offer from public.humkin_orchard_offers where id=p_offer for update;
 if not found or v_offer.recipient_id<>p_recipient or v_offer.status<>'open'
   then raise exception 'Offer not open for this recipient';end if;
 if v_offer.expires_at<=now() then
   update public.humkin_orchard_offers set status='expired',decided_at=now() where id=p_offer;
   raise exception 'Offer expired';
 end if;
 select owner_id,serial,kind into v_owner,v_serial,v_kind from public.humkin_orchard_artifacts
   where id=v_offer.artifact_id for update;
 if v_owner<>v_offer.sender_id then raise exception 'Owner changed';end if;
 update public.humkin_orchard_artifacts set owner_id=p_recipient where id=v_offer.artifact_id;
 update public.humkin_orchard_offers set status='accepted',decided_at=now() where id=p_offer;
 return jsonb_build_object('artifact_id',v_offer.artifact_id,'serial',v_serial,'kind',v_kind,'from',v_owner,'to',p_recipient);
end $$;
create or replace function public.humkin_orchard_offer_cancel(
  p_sender text,p_offer uuid
) returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_offer public.humkin_orchard_offers%rowtype;
begin
 select * into v_offer from public.humkin_orchard_offers where id=p_offer for update;
 if not found or v_offer.sender_id<>p_sender or v_offer.status<>'open'
   then return false;end if;
 update public.humkin_orchard_offers set status='cancelled',decided_at=now() where id=p_offer;
 return true;
end $$;
create or replace function public.humkin_orchard_finish_audit(
  p_node text,p_challenge uuid,p_digest text
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v public.humkin_orchard_challenges%rowtype;v_receipt uuid;v_art uuid;v_day date;
begin
 select * into v from public.humkin_orchard_challenges where id=p_challenge for update;
 if not found or v.node_id<>p_node or v.completed_at is not null
   or v.expires_at<=now() or v.expected_digest<>p_digest
   then raise exception 'Audit challenge not current or digest mismatch';end if;
 v_day=(now() at time zone 'America/Chicago')::date;
 insert into public.humkin_orchard_receipts(node_id,challenge_id,station_day,capability,digest,track_count)
   values(p_node,p_challenge,v_day,v.capability,p_digest,v.track_count)
   returning id into v_receipt;
 update public.humkin_orchard_challenges set completed_at=now() where id=p_challenge;
 insert into public.humkin_orchard_artifacts(owner_id,issued_to,kind,origin,origin_ref)
   values(p_node,p_node,'relay-leaf','catalog:verified',v_receipt) returning id into v_art;
 return jsonb_build_object('receipt_id',v_receipt,'artifact_id',v_art,'catalog_count',v.track_count,'digest',p_digest);
end $$;
revoke all on function public.humkin_orchard_offer_open(text,text,uuid),
 public.humkin_orchard_offer_accept(text,uuid),
 public.humkin_orchard_offer_cancel(text,uuid),
 public.humkin_orchard_finish_audit(text,uuid,text) from public,anon,authenticated;
grant execute on function public.humkin_orchard_offer_open(text,text,uuid),
 public.humkin_orchard_offer_accept(text,uuid),
 public.humkin_orchard_offer_cancel(text,uuid),
 public.humkin_orchard_finish_audit(text,uuid,text) to service_role;
