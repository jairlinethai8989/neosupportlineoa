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

drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
drop policy if exists "Users can update own profile." on public.profiles;
drop policy if exists "Authenticated staff read profiles" on public.profiles;
create policy "Authenticated staff read profiles"
on public.profiles for select to authenticated
using (public.is_staff());
create policy "Authenticated users update own profile"
on public.profiles for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Allow select for customers" on public.customers;
drop policy if exists "Allow public insert on customers" on public.customers;
drop policy if exists "Allow public update on customers" on public.customers;

drop policy if exists "Allow select for tickets" on public.tickets;
drop policy if exists "Allow public insert on tickets" on public.tickets;
drop policy if exists "Allow authenticated update on tickets" on public.tickets;

drop policy if exists "Allow select for conversations" on public.conversations;
drop policy if exists "Allow public insert on conversations" on public.conversations;
drop policy if exists "Allow authenticated update on conversations" on public.conversations;

drop policy if exists "Allow select for messages" on public.messages;
drop policy if exists "Allow authenticated insert for messages" on public.messages;
drop policy if exists "Allow authenticated update on messages" on public.messages;

drop policy if exists "Allow select for csat_surveys" on public.csat_surveys;
drop policy if exists "Allow public select on csat_surveys" on public.csat_surveys;
drop policy if exists "Allow public insert on csat_surveys" on public.csat_surveys;
drop policy if exists "Allow public update on csat_surveys" on public.csat_surveys;
drop policy if exists "Allow authenticated insert on csat_surveys" on public.csat_surveys;

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
end
$$;

commit;
