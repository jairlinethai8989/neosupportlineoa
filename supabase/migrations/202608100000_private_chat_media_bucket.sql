-- Additive media seam. Apply before deploying code that writes new conversation
-- attachments to chat_media_private. This migration does not lock down Portal tables.

begin;

insert into storage.buckets (id, name, public)
values ('chat_media_private', 'chat_media_private', false)
on conflict (id) do update set public = false;

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

drop policy if exists "Pre-lockdown staff read private chat media" on storage.objects;
create policy "Pre-lockdown staff read private chat media"
on storage.objects for select to authenticated
using (
  bucket_id = 'chat_media_private'
  and public.is_staff()
);

drop policy if exists "Pre-lockdown staff upload private chat media" on storage.objects;
create policy "Pre-lockdown staff upload private chat media"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'chat_media_private'
  and public.is_staff()
);

commit;
