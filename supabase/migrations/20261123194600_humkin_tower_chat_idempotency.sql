-- TOWER 012b: stable owner command idempotency, without changing live playout.
-- An absent key is valid for existing Crate controls; new chat ingress requires one.
alter table public.humkin_tower_control_intents
  add column if not exists client_request_id uuid;

-- A caller cannot replay the same UUID for a second effective command.
create unique index if not exists humkin_tower_control_owner_request_unique
  on public.humkin_tower_control_intents (owner_id,client_request_id)
  where client_request_id is not null;

-- Existing owner insert policy and column-limited public read remain unchanged.
-- Never grant owner_id or client_request_id publicly via SELECT.
grant insert (client_request_id)
  on public.humkin_tower_control_intents to authenticated;

comment on column public.humkin_tower_control_intents.client_request_id is
'Optional at-most-once client UUID. Only server-verified owner chat ingress uses it; public schedule and public intent read do not expose it.';
