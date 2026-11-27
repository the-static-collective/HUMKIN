-- Activation only after successful audit and explicit approval for ongoing reclamation.
-- One call every five minutes, zero calls when no aged inbox duplicates remain.
update public.humkin_archive_janitor_config set enabled=true where id=1;
select cron.schedule('humkin-archive-janitor-001','*/5 * * * *',$job$
select net.http_post(
 url:='https://kbhqacsdvjsstzyplqij.supabase.co/functions/v1/humkin-archive-janitor',
 headers:=jsonb_build_object('Content-Type','application/json','x-humkin-janitor',(select decrypted_secret from vault.decrypted_secrets where name='humkin_archive_janitor_001')),
 body:='{"mode":"reclaim"}'::jsonb,timeout_milliseconds:=90000
) as request_id
where exists(select 1 from public.humkin_archive_janitor_config c
 join public.humkin_radio_tracks t on t.uploaded_by=c.owner_id
 join storage.objects o on o.bucket_id='humkin-radio-inbox' and o.name=t.storage_path
 where c.id=1 and c.enabled and t.storage_provider='r2' and t.published_at is not null
 and t.supabase_source_removed_at is null and t.r2_synced_at<=now()-interval '24 hours');
$job$);
