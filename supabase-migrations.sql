-- Create storage buckets for the application
insert into storage.buckets (id, name, public) 
values 
  ('public', 'public', true),
  ('chat_media', 'chat_media', false);

-- Policy for Public Bucket (Company logos, avatars)
create policy "Allow public access to public bucket" 
on storage.objects for select 
using (bucket_id = 'public');

create policy "Allow authenticated users to upload to public bucket" 
on storage.objects for insert 
with check (bucket_id = 'public' and auth.role() = 'authenticated');

-- Policy for Chat Media Bucket (PRIVATE)
create policy "Allow agent access to chat media" 
on storage.objects for select 
using (bucket_id = 'chat_media' and auth.role() = 'authenticated');

create policy "Allow authenticated users to upload chat media" 
on storage.objects for insert 
with check (bucket_id = 'chat_media' and auth.role() = 'authenticated');
