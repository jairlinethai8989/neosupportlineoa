-- Ticket audit rows are readable by staff but writable only through trusted server/RPC paths.
-- Apply after internal ticket creation and every ticket-log mutation use server mediation.
\set ON_ERROR_STOP on

alter table public.ticket_logs enable row level security;

do $$
declare policy_row record;
begin
  for policy_row in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'ticket_logs'
  loop
    execute format('drop policy %I on public.ticket_logs', policy_row.policyname);
  end loop;
end
$$;

create policy "Staff can read ticket logs"
on public.ticket_logs for select to authenticated
using (public.is_staff());

revoke all privileges on table public.ticket_logs from public, anon, authenticated;
grant select on table public.ticket_logs to authenticated;
grant all privileges on table public.ticket_logs to service_role;
