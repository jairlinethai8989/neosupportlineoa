-- Analytics evaluation reads and writes now pass through authenticated server boundaries.
-- Remove direct browser access to sensitive performance and peer-review data.
begin;

do $$
declare
  target_table text;
  policy_row record;
begin
  foreach target_table in array array['staff_evaluations', 'staff_evaluations_360']
  loop
    if to_regclass(format('public.%I', target_table)) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', target_table);

    for policy_row in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = target_table
    loop
      execute format('drop policy %I on public.%I', policy_row.policyname, target_table);
    end loop;

    execute format(
      'revoke all privileges on table public.%I from public, anon, authenticated',
      target_table
    );
    execute format('grant all privileges on table public.%I to service_role', target_table);

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

commit;
