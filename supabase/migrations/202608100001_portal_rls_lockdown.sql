-- Portal RLS lockdown.
-- Deploy the server-mediated Portal release before applying this migration.
-- The Portal authenticates with a verified LINE ID token at the application server and
-- reaches these tables/storage through the service role; the browser receives DTOs only.

begin;

alter table public.customers enable row level security;
alter table public.profiles enable row level security;
alter table public.tickets enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.csat_surveys enable row level security;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('Agent', 'Administrator')
  );
$$;
revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to authenticated, service_role;

-- Historical environments accumulated several generations of permissive policies
-- under different names. Converge the six Portal-sensitive tables to one explicit
-- policy set instead of trying to enumerate every legacy name.
do $$
declare
  legacy_policy record;
begin
  for legacy_policy in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any (array['profiles', 'customers', 'tickets', 'conversations', 'messages', 'csat_surveys'])
  loop
    execute format(
      'drop policy %I on public.%I',
      legacy_policy.policyname,
      legacy_policy.tablename
    );
  end loop;
end
$$;

create policy "Authenticated staff read profiles"
on public.profiles for select to authenticated
using (public.is_staff());

create policy "Authenticated staff manage customers"
on public.customers for all to authenticated
using (public.is_staff())
with check (public.is_staff());

create policy "Authenticated staff manage tickets"
on public.tickets for all to authenticated
using (public.is_staff())
with check (public.is_staff());

create policy "Authenticated staff manage conversations"
on public.conversations for all to authenticated
using (public.is_staff())
with check (public.is_staff());

create policy "Authenticated staff manage messages"
on public.messages for all to authenticated
using (public.is_staff())
with check (public.is_staff());

create policy "Authenticated staff manage csat surveys"
on public.csat_surveys for all to authenticated
using (public.is_staff())
with check (public.is_staff());

-- New conversation media is isolated in a private bucket. The legacy chat_media bucket
-- also contains public branding/signature assets, so it cannot be made private until
-- those assets have been migrated to a dedicated public bucket.
insert into storage.buckets (id, name, public)
values ('chat_media_private', 'chat_media_private', false)
on conflict (id) do update set public = false;
drop policy if exists "Allow agent access to chat media" on storage.objects;
drop policy if exists "Allow authenticated users to upload chat media" on storage.objects;
drop policy if exists "Pre-lockdown staff read private chat media" on storage.objects;
drop policy if exists "Pre-lockdown staff upload private chat media" on storage.objects;
create policy "Staff read chat media"
on storage.objects for select to authenticated
using (
  bucket_id in ('chat_media', 'chat_media_private')
  and public.is_staff()
);
create policy "Staff upload chat media"
on storage.objects for insert to authenticated
with check (
  bucket_id in ('chat_media', 'chat_media_private')
  and public.is_staff()
);

-- Unknown historical permissive policies may still apply to storage.objects.
-- Restrictive policies are ANDed with every permissive policy for the matching
-- API role, so broad or differently named policies cannot expose the private bucket.
drop policy if exists "Authenticated private chat media guard" on storage.objects;
create policy "Authenticated private chat media guard"
on storage.objects as restrictive for all to authenticated
using (
  bucket_id <> 'chat_media_private'
  or public.is_staff()
)
with check (
  bucket_id <> 'chat_media_private'
  or public.is_staff()
);

drop policy if exists "Anonymous private chat media guard" on storage.objects;
create policy "Anonymous private chat media guard"
on storage.objects as restrictive for all to anon
using (bucket_id <> 'chat_media_private')
with check (bucket_id <> 'chat_media_private');

-- Fail closed if a future/historical policy name left anon or PUBLIC access behind.
do $$
declare
  unsafe_policy_count integer;
begin
  select count(*) into unsafe_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename = any (array['profiles', 'customers', 'tickets', 'conversations', 'messages', 'csat_surveys'])
    and (roles && array['public', 'anon']::name[]);

  if unsafe_policy_count > 0 then
    raise exception 'Portal lockdown aborted: % anon/public policies remain', unsafe_policy_count;
  end if;

  if (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = any (array['profiles', 'customers', 'tickets', 'conversations', 'messages', 'csat_surveys'])
  ) <> 6 then
    raise exception 'Portal lockdown aborted: final policy inventory is not canonical';
  end if;

  if (
    select count(*)
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and permissive = 'RESTRICTIVE'
      and policyname in ('Authenticated private chat media guard', 'Anonymous private chat media guard')
  ) <> 2 then
    raise exception 'Portal lockdown aborted: private media restrictive guards are missing';
  end if;
end
$$;

commit;
