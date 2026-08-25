-- Restrict browser access to system audit logs while server/service writes remain available.
-- Apply after the Audit Settings system-log read path uses getSystemLogsAction.
alter table public.system_logs enable row level security;

do $$
declare policy_row record;
begin
  for policy_row in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'system_logs'
  loop
    execute format('drop policy %I on public.system_logs', policy_row.policyname);
  end loop;
end
$$;

create policy "Audit viewers can read system logs"
on public.system_logs for select to authenticated
using (public.has_staff_permission('settings_audit', 'view'));

create policy "Staff can append their own system logs"
on public.system_logs for insert to authenticated
with check (public.is_staff() and performer_id = auth.uid());

revoke all privileges on table public.system_logs from public, anon, authenticated;
grant select, insert on table public.system_logs to authenticated;
grant all privileges on table public.system_logs to service_role;
