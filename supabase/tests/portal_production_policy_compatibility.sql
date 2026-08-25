-- Reproduce representative historical policies observed in the production
-- snapshot before the Portal lockdown. The migration must converge from this
-- inventory without relying on a finite list of policy names.

create policy "profiles_safe_all"
on public.profiles
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Allow individuals to select their own record"
on public.customers for select
using (true);

create policy "tickets_update_support"
on public.tickets for update to authenticated
using (true)
with check (true);

create policy "Global access for conversations"
on public.conversations
using (true)
with check (true);

create policy "messages_select_authenticated"
on public.messages for select to authenticated
using (true);

create policy "Anyone can read/write CSAT"
on public.csat_surveys to authenticated
using (true)
with check (true);

create policy "Legacy authenticated private media access"
on storage.objects for all to authenticated
using (bucket_id = 'chat_media_private')
with check (bucket_id = 'chat_media_private');

create policy "Legacy anonymous private media access"
on storage.objects for all to anon
using (bucket_id = 'chat_media_private')
with check (bucket_id = 'chat_media_private');
