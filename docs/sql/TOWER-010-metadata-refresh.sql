-- TOWER 010: metadata-only updates should request an early cloud refresh.
alter table public.humkin_tower_control_intents
  drop constraint humkin_tower_control_intents_action_check;
alter table public.humkin_tower_control_intents
  add constraint humkin_tower_control_intents_action_check
  check (action in ('queue_next','queue_end','hold','release','more','less','metadata_refresh'));
