-- Add the allowlisted self-service profile RPC before deploying application code.
-- Direct profile UPDATE remains available until the follow-up lockdown migration so
-- the application can be deployed without a profile-settings outage.

begin;

alter table public.profiles
  add column if not exists last_seen timestamp with time zone default timezone('utc'::text, now()),
  add column if not exists signature_url text,
  add column if not exists landing_page text,
  add column if not exists theme_color text,
  add column if not exists notif_sound_enabled boolean not null default true,
  add column if not exists notif_sound_mode text not null default 'beep',
  add column if not exists notif_sound_voice text not null default 'female',
  add column if not exists notif_event_new_ticket boolean not null default true,
  add column if not exists notif_event_new_message boolean not null default true,
  add column if not exists notif_event_transfer boolean not null default true,
  add column if not exists notif_event_sla_warning boolean not null default true;

create or replace function public.update_own_staff_profile(p_updates jsonb)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  allowed_keys constant text[] := array[
    'full_name',
    'avatar_url',
    'department',
    'landing_page',
    'theme_color',
    'signature_url',
    'quick_replies',
    'resolution_templates',
    'auto_logout_minutes',
    'status',
    'last_seen',
    'notif_sound_enabled',
    'notif_sound_mode',
    'notif_sound_voice',
    'notif_event_new_ticket',
    'notif_event_new_message',
    'notif_event_transfer',
    'notif_event_sla_warning'
  ];
begin
  if auth.uid() is null or not public.is_staff() then
    raise insufficient_privilege using message = 'staff authentication required';
  end if;

  if p_updates is null or jsonb_typeof(p_updates) <> 'object' then
    raise exception using errcode = '22023', message = 'updates must be a JSON object';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_updates) as requested(key)
    where not (requested.key = any(allowed_keys))
  ) then
    raise exception using errcode = '22023', message = 'profile update contains protected fields';
  end if;

  if p_updates ? 'full_name'
    and (nullif(btrim(p_updates->>'full_name'), '') is null or char_length(p_updates->>'full_name') > 200) then
    raise exception using errcode = '22023', message = 'invalid full_name';
  end if;

  if p_updates ? 'department' and char_length(coalesce(p_updates->>'department', '')) > 200 then
    raise exception using errcode = '22023', message = 'invalid department';
  end if;

  if p_updates ? 'landing_page'
    and p_updates->>'landing_page' is not null
    and p_updates->>'landing_page' not in ('dashboard', 'inbox') then
    raise exception using errcode = '22023', message = 'invalid landing_page';
  end if;

  if p_updates ? 'theme_color'
    and p_updates->>'theme_color' is not null
    and p_updates->>'theme_color' !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception using errcode = '22023', message = 'invalid theme_color';
  end if;

  if p_updates ? 'avatar_url'
    and p_updates->>'avatar_url' is not null
    and (char_length(p_updates->>'avatar_url') > 2048 or p_updates->>'avatar_url' !~ '^https?://') then
    raise exception using errcode = '22023', message = 'invalid avatar_url';
  end if;

  if p_updates ? 'signature_url'
    and p_updates->>'signature_url' is not null
    and (char_length(p_updates->>'signature_url') > 2048 or p_updates->>'signature_url' !~ '^https?://') then
    raise exception using errcode = '22023', message = 'invalid signature_url';
  end if;

  if p_updates ? 'auto_logout_minutes'
    and (
      jsonb_typeof(p_updates->'auto_logout_minutes') <> 'number'
      or (p_updates->>'auto_logout_minutes')::integer not in (0, 5, 15, 30, 60, 120)
    ) then
    raise exception using errcode = '22023', message = 'invalid auto_logout_minutes';
  end if;

  if p_updates ? 'status' and p_updates->>'status' not in ('Active', 'Away', 'Offline', 'Busy') then
    raise exception using errcode = '22023', message = 'invalid status';
  end if;

  if p_updates ? 'notif_sound_mode'
    and p_updates->>'notif_sound_mode' not in ('beep', 'beep-retro', 'beep-cosmic', 'beep-digital', 'beep-alert', 'voice') then
    raise exception using errcode = '22023', message = 'invalid notif_sound_mode';
  end if;

  if p_updates ? 'notif_sound_voice' and p_updates->>'notif_sound_voice' not in ('female', 'male') then
    raise exception using errcode = '22023', message = 'invalid notif_sound_voice';
  end if;

  if exists (
    select 1
    from unnest(array[
      'notif_sound_enabled',
      'notif_event_new_ticket',
      'notif_event_new_message',
      'notif_event_transfer',
      'notif_event_sla_warning'
    ]) as boolean_key(key)
    where p_updates ? boolean_key.key
      and jsonb_typeof(p_updates->boolean_key.key) <> 'boolean'
  ) then
    raise exception using errcode = '22023', message = 'invalid notification preference';
  end if;

  if p_updates ? 'quick_replies' then
    if jsonb_typeof(p_updates->'quick_replies') <> 'array'
      or jsonb_array_length(p_updates->'quick_replies') > 100
      or exists (
        select 1 from jsonb_array_elements(p_updates->'quick_replies') as item(value)
        where jsonb_typeof(item.value) <> 'string' or char_length(item.value #>> '{}') > 2000
      ) then
      raise exception using errcode = '22023', message = 'invalid quick_replies';
    end if;
  end if;

  if p_updates ? 'resolution_templates' then
    if jsonb_typeof(p_updates->'resolution_templates') <> 'array'
      or jsonb_array_length(p_updates->'resolution_templates') > 100
      or exists (
        select 1 from jsonb_array_elements(p_updates->'resolution_templates') as item(value)
        where jsonb_typeof(item.value) <> 'string' or char_length(item.value #>> '{}') > 5000
      ) then
      raise exception using errcode = '22023', message = 'invalid resolution_templates';
    end if;
  end if;

  update public.profiles
  set full_name = case when p_updates ? 'full_name' then btrim(p_updates->>'full_name') else full_name end,
      avatar_url = case when p_updates ? 'avatar_url' then p_updates->>'avatar_url' else avatar_url end,
      department = case when p_updates ? 'department' then p_updates->>'department' else department end,
      landing_page = case when p_updates ? 'landing_page' then p_updates->>'landing_page' else landing_page end,
      theme_color = case when p_updates ? 'theme_color' then p_updates->>'theme_color' else theme_color end,
      signature_url = case when p_updates ? 'signature_url' then p_updates->>'signature_url' else signature_url end,
      quick_replies = case when p_updates ? 'quick_replies' then p_updates->'quick_replies' else quick_replies end,
      resolution_templates = case when p_updates ? 'resolution_templates' then p_updates->'resolution_templates' else resolution_templates end,
      auto_logout_minutes = case when p_updates ? 'auto_logout_minutes' then (p_updates->>'auto_logout_minutes')::integer else auto_logout_minutes end,
      status = case when p_updates ? 'status' then p_updates->>'status' else status end,
      last_seen = case when p_updates ? 'last_seen' then timezone('utc'::text, now()) else last_seen end,
      notif_sound_enabled = case when p_updates ? 'notif_sound_enabled' then (p_updates->>'notif_sound_enabled')::boolean else notif_sound_enabled end,
      notif_sound_mode = case when p_updates ? 'notif_sound_mode' then p_updates->>'notif_sound_mode' else notif_sound_mode end,
      notif_sound_voice = case when p_updates ? 'notif_sound_voice' then p_updates->>'notif_sound_voice' else notif_sound_voice end,
      notif_event_new_ticket = case when p_updates ? 'notif_event_new_ticket' then (p_updates->>'notif_event_new_ticket')::boolean else notif_event_new_ticket end,
      notif_event_new_message = case when p_updates ? 'notif_event_new_message' then (p_updates->>'notif_event_new_message')::boolean else notif_event_new_message end,
      notif_event_transfer = case when p_updates ? 'notif_event_transfer' then (p_updates->>'notif_event_transfer')::boolean else notif_event_transfer end,
      notif_event_sla_warning = case when p_updates ? 'notif_event_sla_warning' then (p_updates->>'notif_event_sla_warning')::boolean else notif_event_sla_warning end,
      updated_at = timezone('utc'::text, now())
  where id = auth.uid();

  return found;
end;
$$;

revoke all on function public.update_own_staff_profile(jsonb) from public, anon;
grant execute on function public.update_own_staff_profile(jsonb) to authenticated, service_role;

commit;
