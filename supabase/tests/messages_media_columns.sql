-- Portal and staff chat readers require both attachment metadata columns.

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
      raise exception 'Messages schema contract failed: %.% must exist as text', 'messages', target_column;
    end if;
  end loop;

  perform media_path, media_mime_type
  from public.messages
  limit 1;
end
$$;
