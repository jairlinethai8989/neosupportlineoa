-- Browser-facing company settings must never be public because the table also
-- stores server-only integration credentials.
\set ON_ERROR_STOP on

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'company_settings'
      and (roles && array['public', 'anon']::name[])
  ) then
    raise exception 'Company settings test failed: anon/public policy remains';
  end if;

  if has_column_privilege('anon', 'public.company_settings', 'company_name', 'SELECT') then
    raise exception 'Company settings test failed: anon can select browser settings';
  end if;

  if not has_column_privilege('authenticated', 'public.company_settings', 'company_name', 'SELECT') then
    raise exception 'Company settings test failed: authenticated staff cannot select safe settings';
  end if;

  if has_column_privilege('authenticated', 'public.company_settings', 'gemini_api_key', 'SELECT')
    or has_column_privilege('authenticated', 'public.company_settings', 'gemini_api_key', 'UPDATE') then
    raise exception 'Company settings test failed: browser role can access Gemini key';
  end if;

  if not has_column_privilege('service_role', 'public.company_settings', 'gemini_api_key', 'SELECT')
    or not has_column_privilege('service_role', 'public.company_settings', 'gemini_api_key', 'UPDATE') then
    raise exception 'Company settings test failed: service role cannot manage Gemini key';
  end if;
end
$$;

begin;

insert into auth.users (id, email, role, aud, created_at, updated_at)
values ('81000000-0000-0000-0000-000000000001', 'settings-agent@example.invalid', 'authenticated', 'authenticated', now(), now());

insert into public.profiles (id, full_name, role, status)
values ('81000000-0000-0000-0000-000000000001', 'Settings Agent', 'Agent', 'Active');

select set_config('request.jwt.claim.sub', '81000000-0000-0000-0000-000000000099', true);
set local role authenticated;
do $$
begin
  if exists (select company_name from public.company_settings) then
    raise exception 'Company settings test failed: authenticated non-staff can read settings';
  end if;
end
$$;
reset role;

select set_config('request.jwt.claim.sub', '81000000-0000-0000-0000-000000000001', true);
set local role authenticated;
do $$
begin
  if not exists (select company_name from public.company_settings) then
    raise exception 'Company settings test failed: staff cannot read safe settings';
  end if;

  begin
    perform gemini_api_key from public.company_settings;
    raise exception 'Company settings test failed: staff selected Gemini key';
  exception when insufficient_privilege then
    null;
  end;

  begin
    update public.company_settings set gemini_api_key = 'browser-must-fail';
    raise exception 'Company settings test failed: staff updated Gemini key';
  exception when insufficient_privilege then
    null;
  end;
end
$$;
reset role;

set local role service_role;
update public.company_settings set gemini_api_key = 'service-role-test-key';
do $$
begin
  if not exists (
    select 1 from public.company_settings where gemini_api_key = 'service-role-test-key'
  ) then
    raise exception 'Company settings test failed: service role cannot read Gemini key';
  end if;
end
$$;
reset role;

rollback;
