-- SLA rules should be visible to active staff for ticket workflows, but mutable
-- only by staff with settings_sla edit permission.
\set ON_ERROR_STOP on

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'sla_rules'
      and (roles && array['public', 'anon']::name[])
  ) then
    raise exception 'SLA rules test failed: anon/public policy remains';
  end if;

  if has_table_privilege('anon', 'public.sla_rules', 'SELECT')
    or has_table_privilege('anon', 'public.sla_rules', 'INSERT')
    or has_table_privilege('anon', 'public.sla_rules', 'UPDATE')
    or has_table_privilege('anon', 'public.sla_rules', 'DELETE') then
    raise exception 'SLA rules test failed: anon has table privileges';
  end if;
end
$$;

begin;

insert into auth.users (id, email, role, aud, created_at, updated_at)
values
  ('82000000-0000-0000-0000-000000000001', 'sla-reader@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('82000000-0000-0000-0000-000000000002', 'sla-editor@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('82000000-0000-0000-0000-000000000003', 'sla-admin@example.invalid', 'authenticated', 'authenticated', now(), now());

insert into public.profiles (id, full_name, role, status, permissions)
values
  ('82000000-0000-0000-0000-000000000001', 'SLA Reader', 'Agent', 'Active', '{}'::jsonb),
  ('82000000-0000-0000-0000-000000000002', 'SLA Editor', 'Agent', 'Active', '{"settings_sla":"edit"}'::jsonb),
  ('82000000-0000-0000-0000-000000000003', 'SLA Admin', 'Administrator', 'Active', '{}'::jsonb);

select set_config('request.jwt.claim.sub', '82000000-0000-0000-0000-000000000099', true);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.sla_rules) then
    raise exception 'SLA rules test failed: non-staff can read SLA rules';
  end if;
end
$$;
reset role;

select set_config('request.jwt.claim.sub', '82000000-0000-0000-0000-000000000001', true);
set local role authenticated;
do $$
begin
  perform 1 from public.sla_rules limit 1;

  begin
    insert into public.sla_rules (priority, response_time_minutes, resolution_time_minutes)
    values ('Critical', 1, 1);
    raise exception 'SLA rules test failed: staff without settings_sla edit inserted rule';
  exception when insufficient_privilege or check_violation then
    null;
  end;
end
$$;
reset role;

select set_config('request.jwt.claim.sub', '82000000-0000-0000-0000-000000000002', true);
set local role authenticated;
insert into public.sla_rules (priority, response_time_minutes, resolution_time_minutes)
values ('Critical', 5, 30);
update public.sla_rules set response_time_minutes = 10 where priority = 'Critical';
delete from public.sla_rules where priority = 'Critical';
reset role;

select set_config('request.jwt.claim.sub', '82000000-0000-0000-0000-000000000003', true);
set local role authenticated;
insert into public.sla_rules (priority, response_time_minutes, resolution_time_minutes)
values ('High', 15, 60);
delete from public.sla_rules where priority = 'High';
reset role;

rollback;
