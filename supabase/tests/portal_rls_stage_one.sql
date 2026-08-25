-- Verify the state immediately after migration 001, before migration 005.
-- A separate migration transaction must not leave a direct self-update path
-- that can change role or permissions.

\set ON_ERROR_STOP on
begin;

grant select, update on public.profiles to authenticated;

insert into auth.users (id, email, role, aud, created_at, updated_at)
values ('10000000-0000-0000-0000-000000000011', 'stage-one-agent@example.invalid', 'authenticated', 'authenticated', now(), now());

insert into public.profiles (id, full_name, role, status)
values ('10000000-0000-0000-0000-000000000011', 'Stage One Agent', 'Agent', 'Active');

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000011', true);
set local role authenticated;
do $$
begin
  update public.profiles
  set role = 'Administrator', permissions = '{"settings_staff":"edit"}'::jsonb
  where id = '10000000-0000-0000-0000-000000000011';

  if found then
    raise exception 'Portal stage-one lockdown failed: staff can directly escalate own role or permissions';
  end if;
end
$$;
reset role;

rollback;
