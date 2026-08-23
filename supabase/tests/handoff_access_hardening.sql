-- Behavioral checks for the 202608100002/003 handoff hardening sequence.
-- Run only against a disposable database. All fixtures are rolled back.

\set ON_ERROR_STOP on
begin;

do $$
begin
  if has_table_privilege('anon', 'public.ticket_handoffs', 'select')
    or has_table_privilege('authenticated', 'public.ticket_handoffs', 'select')
    or has_table_privilege('anon', 'public.ticket_handoff_reports', 'insert')
    or has_table_privilege('authenticated', 'public.ticket_verifications', 'select') then
    raise exception 'Handoff test failed: browser roles retain table privileges';
  end if;

  if has_function_privilege('anon', 'public.redeem_ticket_handoff(text,text)', 'execute')
    or has_function_privilege('authenticated', 'public.redeem_ticket_handoff(text,text)', 'execute')
    or has_function_privilege('anon', 'public.claim_ticket_handoff(uuid,text)', 'execute')
    or has_function_privilege('authenticated', 'public.submit_ticket_handoff_report(uuid,text,text,text,text[],text)', 'execute') then
    raise exception 'Handoff test failed: browser roles can execute handoff RPCs';
  end if;
end
$$;

insert into public.customers (id, line_user_id, display_name)
values ('71000000-0000-0000-0000-000000000001', 'U_HANDOFF_TEST', 'Handoff Test');

insert into public.tickets (id, ticket_no, customer_id, subject, description)
values ('72000000-0000-0000-0000-000000000001', 'HANDOFF-TEST', '71000000-0000-0000-0000-000000000001', 'Handoff Test', 'Handoff Test');

insert into public.ticket_handoffs (
  id, ticket_id, handoff_type, token_hash, secure_pin_hash, status, expires_at
) values (
  '73000000-0000-0000-0000-000000000001',
  '72000000-0000-0000-0000-000000000001',
  'Escalated', repeat('a', 64), repeat('b', 64), 'Active', now() + interval '1 hour'
);

set local role service_role;
do $$
declare
  result record;
  attempt integer;
begin
  for attempt in 1..4 loop
    select * into result from public.redeem_ticket_handoff(repeat('a', 64), repeat('c', 64));
    if result.allowed or result.reason <> 'invalid' then
      raise exception 'Handoff test failed: wrong PIN attempt % was not rejected', attempt;
    end if;
  end loop;

  select * into result from public.redeem_ticket_handoff(repeat('a', 64), repeat('c', 64));
  if result.allowed or result.reason <> 'locked' then
    raise exception 'Handoff test failed: fifth wrong PIN did not lock the handoff';
  end if;

  select * into result from public.redeem_ticket_handoff(repeat('a', 64), repeat('b', 64));
  if result.allowed or result.reason <> 'locked' then
    raise exception 'Handoff test failed: correct PIN bypassed active lockout';
  end if;
end
$$;
reset role;

update public.ticket_handoffs
set locked_until = now() - interval '1 second'
where id = '73000000-0000-0000-0000-000000000001';

set local role service_role;
do $$
declare
  result record;
begin
  select * into result from public.redeem_ticket_handoff(repeat('a', 64), repeat('b', 64));
  if not result.allowed or result.reason <> 'allowed' or result.ticket_id <> '72000000-0000-0000-0000-000000000001'::uuid then
    raise exception 'Handoff test failed: valid credential was not redeemed after lockout elapsed';
  end if;
end
$$;
reset role;

set local role service_role;
do $$
declare
  result record;
begin
  select * into result from public.claim_ticket_handoff(
    '73000000-0000-0000-0000-000000000001',
    'External Tester'
  );
  if not result.allowed then
    raise exception 'Handoff test failed: first claim was rejected';
  end if;

  select * into result from public.claim_ticket_handoff(
    '73000000-0000-0000-0000-000000000001',
    'Concurrent Tester'
  );
  if result.allowed or result.reason <> 'not_active' then
    raise exception 'Handoff test failed: a second claim was allowed';
  end if;

  select * into result from public.submit_ticket_handoff_report(
    '73000000-0000-0000-0000-000000000001',
    'Fix Completed',
    'External Tester',
    'Completed in disposable test',
    array[]::text[],
    '[External Report] Completed in disposable test'
  );
  if not result.allowed then
    raise exception 'Handoff test failed: atomic report submission was rejected';
  end if;
end
$$;
reset role;

do $$
begin
  if exists (
    select 1 from public.ticket_handoffs
    where id = '73000000-0000-0000-0000-000000000001'
      and (failed_attempts <> 0 or locked_until is not null or redeemed_at is null)
  ) then
    raise exception 'Handoff test failed: successful redemption did not reset attempt state';
  end if;

  if not exists (
    select 1 from public.ticket_handoffs
    where id = '73000000-0000-0000-0000-000000000001'
      and status = 'Completed'
      and assigned_to_external = 'External Tester'
  ) or not exists (
    select 1 from public.ticket_handoff_reports
    where handoff_id = '73000000-0000-0000-0000-000000000001'
      and status = 'Fix Completed'
  ) or not exists (
    select 1 from public.tickets
    where id = '72000000-0000-0000-0000-000000000001'
      and status = 'Fix Completed'
  ) then
    raise exception 'Handoff test failed: atomic claim/report state was incomplete';
  end if;
end
$$;

rollback;
