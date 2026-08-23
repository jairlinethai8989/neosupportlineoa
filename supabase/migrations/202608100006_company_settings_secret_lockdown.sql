-- Keep server-only integration credentials out of browser-accessible
-- company_settings queries. Apply after the server-mediated settings DTO is deployed.

begin;

alter table public.company_settings
  add column if not exists gemini_api_key text;
alter table public.company_settings enable row level security;

do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'company_settings'
  loop
    execute format('drop policy %I on public.company_settings', policy_row.policyname);
  end loop;
end
$$;

create policy "Authenticated staff read company settings"
on public.company_settings for select to authenticated
using (public.is_staff());

create policy "Authenticated staff update company settings"
on public.company_settings for update to authenticated
using (public.is_staff())
with check (public.is_staff());

revoke all privileges on table public.company_settings from public, anon, authenticated;
grant all privileges on table public.company_settings to service_role;

do $$
declare
  safe_columns text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
  into safe_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'company_settings'
    and column_name = any (array[
      'id',
      'company_name',
      'logo_url',
      'departments',
      'modules',
      'issue_types',
      'resolution_templates',
      'report_tags',
      'active_threshold_minutes',
      'global_quick_replies',
      'global_resolution_templates',
      'google_sheets_url',
      'report_broadcast_mode',
      'report_broadcast_group_id',
      'report_broadcast_schedules',
      'updated_at'
    ]);

  if safe_columns is null then
    raise exception 'Company settings lockdown aborted: safe column allowlist is empty';
  end if;

  execute format(
    'grant select (%s) on table public.company_settings to authenticated',
    safe_columns
  );
  execute format(
    'grant update (%s) on table public.company_settings to authenticated',
    safe_columns
  );
end
$$;

commit;
