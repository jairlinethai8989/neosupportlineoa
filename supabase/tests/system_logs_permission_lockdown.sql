-- System logs are permission-gated for reads and writable only by trusted server roles.
\set ON_ERROR_STOP on

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'system_logs'
      and (roles && array['public', 'anon']::name[])
  ) then
    raise exception 'System logs test failed: anon/public policy remains';
  end if;
  if has_table_privilege('anon', 'public.system_logs', 'SELECT')
    or has_table_privilege('anon', 'public.system_logs', 'INSERT') then
    raise exception 'System logs test failed: anon has table privileges';
  end if;
  if has_table_privilege('authenticated', 'public.system_logs', 'INSERT')
    or has_table_privilege('authenticated', 'public.system_logs', 'UPDATE')
    or has_table_privilege('authenticated', 'public.system_logs', 'DELETE') then
    raise exception 'System logs test failed: browser role can mutate logs';
  end if;
end
$$;

begin;
insert into auth.users (id, email, role, aud, created_at, updated_at)
values
  ('83000000-0000-0000-0000-000000000001', 'audit-basic@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('83000000-0000-0000-0000-000000000002', 'audit-viewer@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('83000000-0000-0000-0000-000000000003', 'audit-admin@example.invalid', 'authenticated', 'authenticated', now(), now());
insert into public.profiles (id, full_name, role, status, permissions)
values
  ('83000000-0000-0000-0000-000000000001', 'Basic Staff', 'Agent', 'Active', '{}'::jsonb),
  ('83000000-0000-0000-0000-000000000002', 'Audit Viewer', 'Agent', 'Active', '{"settings_audit":"view"}'::jsonb),
  ('83000000-0000-0000-0000-000000000003', 'Audit Admin', 'Administrator', 'Active', '{}'::jsonb);
insert into public.system_logs (performer_id, action_type, entity_type, note)
values ('83000000-0000-0000-0000-000000000003', 'TEST_SEED', 'TEST', 'service seed');

select set_config('request.jwt.claim.sub', '83000000-0000-0000-0000-000000000099', true);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.system_logs) then
    raise exception 'System logs test failed: non-staff can read logs';
  end if;
  begin
    insert into public.system_logs (performer_id, action_type)
    values ('83000000-0000-0000-0000-000000000099', 'FORGED');
    raise exception 'System logs test failed: non-staff inserted a log';
  exception when insufficient_privilege or check_violation then null;
  end;
end
$$;
reset role;

select set_config('request.jwt.claim.sub', '83000000-0000-0000-0000-000000000001', true);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.system_logs) then
    raise exception 'System logs test failed: staff without settings_audit can read logs';
  end if;
  begin
    insert into public.system_logs (performer_id, action_type)
    values ('83000000-0000-0000-0000-000000000001', 'PROFILE_UPDATE');
    raise exception 'System logs test failed: staff inserted a browser audit row';
  exception when insufficient_privilege or check_violation then null;
  end;
end
$$;
reset role;

select set_config('request.jwt.claim.sub', '83000000-0000-0000-0000-000000000002', true);
set local role authenticated;
do $$ begin
  if not exists (select 1 from public.system_logs) then
    raise exception 'System logs test failed: audit viewer cannot read logs';
  end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub', '83000000-0000-0000-0000-000000000003', true);
set local role authenticated;
do $$ begin
  if not exists (select 1 from public.system_logs) then
    raise exception 'System logs test failed: administrator cannot read logs';
  end if;
end $$;
reset role;
rollback;
