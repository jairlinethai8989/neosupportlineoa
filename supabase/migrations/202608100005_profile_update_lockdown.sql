-- Remove direct profile writes after the application has switched to the
-- allowlisted update_own_staff_profile RPC from migration 202608100004.

begin;

do $$
begin
  if to_regprocedure('public.update_own_staff_profile(jsonb)') is null then
    raise exception 'Profile lockdown aborted: update_own_staff_profile(jsonb) is missing';
  end if;
end;
$$;

drop policy if exists "Authenticated users update own profile" on public.profiles;
drop policy if exists "Users can update own profile." on public.profiles;
revoke update on public.profiles from anon, authenticated;

do $$
declare
  unsafe_policy_count integer;
begin
  select count(*) into unsafe_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'profiles'
    and cmd = 'UPDATE'
    and (roles && array['public', 'anon', 'authenticated']::name[]);

  if unsafe_policy_count > 0 then
    raise exception 'Profile lockdown aborted: % direct client UPDATE policies remain', unsafe_policy_count;
  end if;

  if has_table_privilege('anon', 'public.profiles', 'UPDATE')
    or has_table_privilege('authenticated', 'public.profiles', 'UPDATE') then
    raise exception 'Profile lockdown aborted: direct client UPDATE grant remains';
  end if;
end;
$$;

commit;
