-- Ticket logs are staff-readable and browser-immutable.
\set ON_ERROR_STOP on

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ticket_logs'
      and (roles && array['public', 'anon']::name[])
  ) then
    raise exception 'Ticket logs test failed: anon/public policy remains';
  end if;
  if has_table_privilege('anon', 'public.ticket_logs', 'SELECT')
    or has_table_privilege('anon', 'public.ticket_logs', 'INSERT') then
    raise exception 'Ticket logs test failed: anon has table privileges';
  end if;
  if has_table_privilege('authenticated', 'public.ticket_logs', 'INSERT')
    or has_table_privilege('authenticated', 'public.ticket_logs', 'UPDATE')
    or has_table_privilege('authenticated', 'public.ticket_logs', 'DELETE') then
    raise exception 'Ticket logs test failed: authenticated browser can mutate logs';
  end if;
end
$$;

begin;
insert into auth.users (id, email, role, aud, created_at, updated_at)
values
  ('86000000-0000-0000-0000-000000000001', 'ticket-log-staff@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('86000000-0000-0000-0000-000000000002', 'ticket-log-nonstaff@example.invalid', 'authenticated', 'authenticated', now(), now());
insert into public.profiles (id, full_name, role, status, permissions)
values ('86000000-0000-0000-0000-000000000001', 'Ticket Log Staff', 'Agent', 'Active', '{}'::jsonb);
insert into public.customers (id, line_user_id, display_name)
values ('86000000-0000-0000-0000-000000000010', 'ticket-log-customer', 'Ticket Log Customer');
insert into public.tickets (id, ticket_no, customer_id, subject)
values ('86000000-0000-0000-0000-000000000020', 'TICKET-LOG-TEST', '86000000-0000-0000-0000-000000000010', 'Ticket log test');
insert into public.ticket_logs (ticket_id, performer_id, action_type, note)
values ('86000000-0000-0000-0000-000000000020', '86000000-0000-0000-0000-000000000001', 'create', 'service seed');

select set_config('request.jwt.claim.sub', '86000000-0000-0000-0000-000000000002', true);
set local role authenticated;
do $$ begin
  if exists (select 1 from public.ticket_logs) then
    raise exception 'Ticket logs test failed: non-staff can read logs';
  end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub', '86000000-0000-0000-0000-000000000001', true);
set local role authenticated;
do $$
begin
  if not exists (select 1 from public.ticket_logs) then
    raise exception 'Ticket logs test failed: staff cannot read logs';
  end if;
  begin
    insert into public.ticket_logs (ticket_id, performer_id, action_type)
    values ('86000000-0000-0000-0000-000000000020', '86000000-0000-0000-0000-000000000001', 'forged');
    raise exception 'Ticket logs test failed: staff inserted a browser log';
  exception when insufficient_privilege then null;
  end;
end
$$;
reset role;
rollback;
