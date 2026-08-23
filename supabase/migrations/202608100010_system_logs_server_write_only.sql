-- All application audit writers are now authenticated server actions or route handlers.
-- Remove the final authenticated-browser INSERT seam while preserving permission-gated reads.
\set ON_ERROR_STOP on

begin;

do $$
declare policy_row record;
begin
  for policy_row in
    select policyname from pg_policies
    where schemaname = 'public'
      and tablename = 'system_logs'
      and cmd = 'INSERT'
  loop
    execute format('drop policy %I on public.system_logs', policy_row.policyname);
  end loop;
end
$$;

revoke insert on table public.system_logs from authenticated;
grant select on table public.system_logs to authenticated;
grant all privileges on table public.system_logs to service_role;

commit;
