-- Lock SLA rule mutations behind the staff settings_sla edit permission.
-- Apply after the SLA settings page uses server-mediated writes.

alter table public.company_settings
  add column if not exists active_threshold_minutes integer not null default 15;

create or replace function public.has_staff_permission(permission_key text, required_level text default 'view')
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.status = 'Active'
      and p.role in ('Agent', 'Administrator')
      and (
        p.role = 'Administrator'
        or (
          required_level = 'view'
          and p.permissions ->> permission_key in ('view', 'edit')
        )
        or (
          required_level = 'edit'
          and p.permissions ->> permission_key = 'edit'
        )
      )
  );
$$;

revoke all on function public.has_staff_permission(text, text) from public;
grant execute on function public.has_staff_permission(text, text) to authenticated, service_role;

alter table public.sla_rules enable row level security;

do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'sla_rules'
  loop
    execute format('drop policy %I on public.sla_rules', policy_row.policyname);
  end loop;
end
$$;

create policy "Active staff can read SLA rules"
on public.sla_rules for select to authenticated
using (public.is_staff());

create policy "SLA editors can create SLA rules"
on public.sla_rules for insert to authenticated
with check (public.has_staff_permission('settings_sla', 'edit'));

create policy "SLA editors can update SLA rules"
on public.sla_rules for update to authenticated
using (public.has_staff_permission('settings_sla', 'edit'))
with check (public.has_staff_permission('settings_sla', 'edit'));

create policy "SLA editors can delete SLA rules"
on public.sla_rules for delete to authenticated
using (public.has_staff_permission('settings_sla', 'edit'));

revoke all privileges on table public.sla_rules from public, anon, authenticated;
grant select, insert, update, delete on table public.sla_rules to authenticated;
grant all privileges on table public.sla_rules to service_role;
