-- Analytics evaluation reads and writes now pass through authenticated server boundaries.
-- Remove direct browser access to sensitive performance and peer-review data.
\set ON_ERROR_STOP on

begin;

alter table public.staff_evaluations enable row level security;
alter table public.staff_evaluations_360 enable row level security;

do $$
declare
  target_table text;
  policy_row record;
begin
  foreach target_table in array array['staff_evaluations', 'staff_evaluations_360']
  loop
    for policy_row in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = target_table
    loop
      execute format('drop policy %I on public.%I', policy_row.policyname, target_table);
    end loop;
  end loop;
end
$$;

revoke all privileges on table public.staff_evaluations from public, anon, authenticated;
revoke all privileges on table public.staff_evaluations_360 from public, anon, authenticated;
grant all privileges on table public.staff_evaluations to service_role;
grant all privileges on table public.staff_evaluations_360 to service_role;

commit;
