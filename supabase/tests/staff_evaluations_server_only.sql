-- Evaluation records contain sensitive staff performance data and must be server-only.
\set ON_ERROR_STOP on

do $$
declare target_table text;
begin
  foreach target_table in array array['staff_evaluations', 'staff_evaluations_360']
  loop
    if exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = target_table
    ) then
      raise exception 'Evaluation lockdown failed: policy remains on %', target_table;
    end if;
    if has_table_privilege('anon', format('public.%I', target_table), 'SELECT')
      or has_table_privilege('authenticated', format('public.%I', target_table), 'SELECT')
      or has_table_privilege('authenticated', format('public.%I', target_table), 'INSERT')
      or has_table_privilege('authenticated', format('public.%I', target_table), 'UPDATE')
      or has_table_privilege('authenticated', format('public.%I', target_table), 'DELETE') then
      raise exception 'Evaluation lockdown failed: browser privilege remains on %', target_table;
    end if;
    if not has_table_privilege('service_role', format('public.%I', target_table), 'SELECT')
      or not has_table_privilege('service_role', format('public.%I', target_table), 'INSERT')
      or not has_table_privilege('service_role', format('public.%I', target_table), 'UPDATE')
      or not has_table_privilege('service_role', format('public.%I', target_table), 'DELETE') then
      raise exception 'Evaluation lockdown failed: service role lacks access to %', target_table;
    end if;
  end loop;
end
$$;

begin;
set local role authenticated;
do $$
begin
  begin
    perform 1 from public.staff_evaluations limit 1;
    raise exception 'Evaluation lockdown failed: browser read staff evaluations';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.staff_evaluations_360 limit 1;
    raise exception 'Evaluation lockdown failed: browser read 360 evaluations';
  exception when insufficient_privilege then null;
  end;
end
$$;
reset role;
rollback;
