-- Behavioral RLS matrix for a disposable Supabase database.
-- Prerequisite: apply the application baseline, then the Portal lockdown migration.
-- This script grants the API roles table privileges inside a transaction so the
-- assertions exercise RLS policies (not a coincidental missing GRANT), then rolls back.

\set ON_ERROR_STOP on
begin;

grant select, insert, update, delete on
  public.customers,
  public.tickets,
  public.conversations,
  public.messages,
  public.csat_surveys,
  public.profiles
to anon, authenticated, service_role;

grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;

insert into auth.users (id, email, role, aud, created_at, updated_at)
values ('10000000-0000-0000-0000-000000000001', 'rls-agent@example.invalid', 'authenticated', 'authenticated', now(), now());

insert into public.profiles (id, full_name, role, status)
values ('10000000-0000-0000-0000-000000000001', 'RLS Agent', 'Agent', 'Active');

insert into public.customers (id, line_user_id, display_name)
values ('20000000-0000-0000-0000-000000000001', 'U_RLS_FIXTURE', 'RLS Fixture');

insert into public.tickets (id, ticket_no, customer_id, subject, description)
values ('30000000-0000-0000-0000-000000000001', 'RLS-001', '20000000-0000-0000-0000-000000000001', 'RLS Fixture', 'RLS Fixture');

insert into public.conversations (id, customer_id, current_ticket_id)
values ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001');

insert into public.messages (id, conversation_id, ticket_id, sender_type, customer_id, content)
values ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'customer', '20000000-0000-0000-0000-000000000001', 'RLS Fixture');

insert into public.csat_surveys (ticket_id)
values ('30000000-0000-0000-0000-000000000001');

insert into storage.objects (id, bucket_id, name)
values ('60000000-0000-0000-0000-000000000001', 'chat_media_private', 'rls/private-fixture.txt');

set local role anon;
do $$
begin
  if exists (select 1 from public.profiles where id = '10000000-0000-0000-0000-000000000001')
    or exists (select 1 from public.customers where id = '20000000-0000-0000-0000-000000000001')
    or exists (select 1 from public.tickets where id = '30000000-0000-0000-0000-000000000001')
    or exists (select 1 from public.conversations where id = '40000000-0000-0000-0000-000000000001')
    or exists (select 1 from public.messages where id = '50000000-0000-0000-0000-000000000001')
    or exists (select 1 from public.csat_surveys where ticket_id = '30000000-0000-0000-0000-000000000001')
    or exists (select 1 from storage.objects where id = '60000000-0000-0000-0000-000000000001') then
    raise exception 'RLS matrix failed: anon can read Portal-sensitive data';
  end if;

  begin
    insert into public.customers (line_user_id, display_name) values ('U_ANON_DENY', 'Anon must fail');
    raise exception 'RLS matrix failed: anon can insert customers';
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into storage.objects (bucket_id, name) values ('chat_media_private', 'rls/anon-must-fail.txt');
    raise exception 'RLS matrix failed: anon can upload private media';
  exception when insufficient_privilege then
    null;
  end;
end
$$;
reset role;

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000099', true);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.profiles where id = '10000000-0000-0000-0000-000000000001')
    or exists (select 1 from public.customers where id = '20000000-0000-0000-0000-000000000001')
    or exists (select 1 from public.tickets where id = '30000000-0000-0000-0000-000000000001')
    or exists (select 1 from public.conversations where id = '40000000-0000-0000-0000-000000000001')
    or exists (select 1 from public.messages where id = '50000000-0000-0000-0000-000000000001')
    or exists (select 1 from public.csat_surveys where ticket_id = '30000000-0000-0000-0000-000000000001')
    or exists (select 1 from storage.objects where id = '60000000-0000-0000-0000-000000000001') then
    raise exception 'RLS matrix failed: authenticated non-staff can read Portal-sensitive data';
  end if;

  begin
    update public.tickets set subject = 'Non-staff must fail' where id = '30000000-0000-0000-0000-000000000001';
    if found then raise exception 'RLS matrix failed: authenticated non-staff can update tickets'; end if;
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into storage.objects (bucket_id, name) values ('chat_media_private', 'rls/non-staff-must-fail.txt');
    raise exception 'RLS matrix failed: authenticated non-staff can upload private media';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform public.update_own_staff_profile('{"status":"Busy"}'::jsonb);
    raise exception 'RLS matrix failed: authenticated non-staff can update profile preferences';
  exception when insufficient_privilege then
    null;
  end;
end
$$;
reset role;

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
set local role authenticated;
do $$
begin
  if not exists (select 1 from public.profiles where id = '10000000-0000-0000-0000-000000000001')
    or not exists (select 1 from public.customers where id = '20000000-0000-0000-0000-000000000001')
    or not exists (select 1 from public.tickets where id = '30000000-0000-0000-0000-000000000001')
    or not exists (select 1 from public.conversations where id = '40000000-0000-0000-0000-000000000001')
    or not exists (select 1 from public.messages where id = '50000000-0000-0000-0000-000000000001')
    or not exists (select 1 from public.csat_surveys where ticket_id = '30000000-0000-0000-0000-000000000001')
    or not exists (select 1 from storage.objects where id = '60000000-0000-0000-0000-000000000001') then
    raise exception 'RLS matrix failed: active staff cannot read required Portal data';
  end if;

  insert into storage.objects (bucket_id, name) values ('chat_media_private', 'rls/staff-upload.txt');

  update public.tickets set subject = 'Staff update allowed' where id = '30000000-0000-0000-0000-000000000001';
  if not found then raise exception 'RLS matrix failed: active staff cannot update tickets'; end if;

  update public.profiles
  set role = 'Administrator', permissions = '{"settings_staff":"edit"}'::jsonb
  where id = '10000000-0000-0000-0000-000000000001';
  if found then
    raise exception 'RLS matrix failed: staff can directly escalate own role or permissions';
  end if;

  if not public.update_own_staff_profile('{"status":"Busy"}'::jsonb) then
    raise exception 'RLS matrix failed: staff preference RPC rejected a safe update';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = '10000000-0000-0000-0000-000000000001'
      and status = 'Busy'
      and role = 'Agent'
      and permissions = '{}'::jsonb
  ) then
    raise exception 'RLS matrix failed: safe profile update changed protected fields';
  end if;
end
$$;
reset role;

set local role service_role;
do $$
begin
  if not exists (select 1 from public.customers where id = '20000000-0000-0000-0000-000000000001')
    or not exists (select 1 from public.messages where id = '50000000-0000-0000-0000-000000000001') then
    raise exception 'RLS matrix failed: service role cannot access Portal data';
  end if;
end
$$;
reset role;

rollback;
