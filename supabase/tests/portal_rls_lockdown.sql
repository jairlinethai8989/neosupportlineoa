-- Run against a disposable Supabase database after the lockdown migration.
-- psql exits non-zero if an anon/public policy remains on a Portal-sensitive table.
do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = any (array['profiles', 'customers', 'tickets', 'conversations', 'messages', 'csat_surveys'])
      and (roles && array['public', 'anon']::name[])
  ) then
    raise exception 'anon/public Portal policy detected';
  end if;

  if (select public from storage.buckets where id = 'chat_media_private') is distinct from false then
    raise exception 'chat_media_private must be private';
  end if;
end
$$;
