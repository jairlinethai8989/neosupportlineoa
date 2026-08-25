-- Restore the attachment metadata schema required by Portal and staff chat readers.
-- The columns are nullable so existing messages remain valid and unchanged.
begin;

alter table public.messages
  add column if not exists media_path text,
  add column if not exists media_mime_type text;

do $$
declare
  target_column text;
  column_type text;
begin
  foreach target_column in array array['media_path', 'media_mime_type']
  loop
    select data_type
    into column_type
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'messages'
      and column_name = target_column;

    if column_type is distinct from 'text' then
      raise exception 'Messages schema upgrade failed: %.% must exist as text', 'messages', target_column;
    end if;
  end loop;
end
$$;

commit;
