-- Handoff credential hardening.
-- Apply this additive migration before deploying the hash-aware application.
-- The application requires HANDOFF_ACCESS_PEPPER before creating or redeeming handoffs.

begin;

-- External work reports transition tickets to Fix Completed. Keep the database
-- workflow constraint aligned with the application/RPC before exposing that path.
alter table public.tickets
  drop constraint if exists tickets_status_check;
alter table public.tickets
  add constraint tickets_status_check check (
    status in ('New', 'Assigned', 'In Progress', 'Escalated', 'Pending', 'Fix Completed', 'Resolved', 'Closed', 'Canceled')
  ) not valid;
alter table public.tickets validate constraint tickets_status_check;

alter table public.ticket_handoffs
  add column if not exists token_hash text,
  add column if not exists secure_pin_hash text,
  add column if not exists failed_attempts integer not null default 0,
  add column if not exists locked_until timestamp with time zone,
  add column if not exists redeemed_at timestamp with time zone,
  add column if not exists revoked_at timestamp with time zone;

alter table public.ticket_handoffs alter column token drop not null;
alter table public.ticket_handoffs alter column secure_pin drop not null;

alter table public.ticket_handoffs
  drop constraint if exists ticket_handoffs_failed_attempts_check;
alter table public.ticket_handoffs
  add constraint ticket_handoffs_failed_attempts_check check (failed_attempts between 0 and 5);
alter table public.ticket_handoffs
  drop constraint if exists ticket_handoffs_token_hash_check;
alter table public.ticket_handoffs
  add constraint ticket_handoffs_token_hash_check check (token_hash is null or token_hash ~ '^[0-9a-f]{64}$');
alter table public.ticket_handoffs
  drop constraint if exists ticket_handoffs_pin_hash_check;
alter table public.ticket_handoffs
  add constraint ticket_handoffs_pin_hash_check check (secure_pin_hash is null or secure_pin_hash ~ '^[0-9a-f]{64}$');

create unique index if not exists idx_ticket_handoffs_token_hash
  on public.ticket_handoffs(token_hash)
  where token_hash is not null;

create or replace function public.redeem_ticket_handoff(
  p_token_hash text,
  p_pin_hash text
)
returns table (
  allowed boolean,
  reason text,
  handoff_id uuid,
  ticket_id uuid,
  handoff_status text,
  handoff_type text,
  target_team text,
  assigned_to_external text,
  created_by uuid,
  expires_at timestamp with time zone
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  h public.ticket_handoffs%rowtype;
  next_attempts integer;
begin
  if p_token_hash !~ '^[0-9a-f]{64}$' or p_pin_hash !~ '^[0-9a-f]{64}$' then
    return query select false, 'invalid'::text, null::uuid, null::uuid, null::text, null::text, null::text, null::text, null::uuid, null::timestamptz;
    return;
  end if;

  select * into h
  from public.ticket_handoffs
  where token_hash = p_token_hash
  for update;

  if not found then
    return query select false, 'invalid'::text, null::uuid, null::uuid, null::text, null::text, null::text, null::text, null::uuid, null::timestamptz;
    return;
  end if;

  if h.revoked_at is not null or h.status in ('Expired', 'Rejected') or h.expires_at <= timezone('utc'::text, now()) then
    if h.status <> 'Expired' then
      update public.ticket_handoffs set status = 'Expired', updated_at = timezone('utc'::text, now()) where id = h.id;
    end if;
    return query select false, 'expired'::text, null::uuid, null::uuid, null::text, null::text, null::text, null::text, null::uuid, null::timestamptz;
    return;
  end if;

  if h.locked_until is not null and h.locked_until > timezone('utc'::text, now()) then
    return query select false, 'locked'::text, null::uuid, null::uuid, null::text, null::text, null::text, null::text, null::uuid, null::timestamptz;
    return;
  end if;

  if h.secure_pin_hash is distinct from p_pin_hash then
    next_attempts := least(h.failed_attempts + 1, 5);
    update public.ticket_handoffs
    set failed_attempts = next_attempts,
        locked_until = case when next_attempts >= 5 then timezone('utc'::text, now()) + interval '15 minutes' else null end,
        updated_at = timezone('utc'::text, now())
    where id = h.id;
    return query select false, case when next_attempts >= 5 then 'locked' else 'invalid' end::text,
      null::uuid, null::uuid, null::text, null::text, null::text, null::text, null::uuid, null::timestamptz;
    return;
  end if;

  update public.ticket_handoffs
  set failed_attempts = 0,
      locked_until = null,
      redeemed_at = coalesce(redeemed_at, timezone('utc'::text, now())),
      updated_at = timezone('utc'::text, now())
  where id = h.id;

  return query select true, 'allowed'::text, h.id, h.ticket_id, h.status, h.handoff_type,
    h.target_team, h.assigned_to_external, h.created_by, h.expires_at;
end;
$$;

revoke all on function public.redeem_ticket_handoff(text, text) from public, anon, authenticated;
grant execute on function public.redeem_ticket_handoff(text, text) to service_role;

create or replace function public.claim_ticket_handoff(
  p_handoff_id uuid,
  p_receiver_name text
)
returns table (allowed boolean, reason text, ticket_id uuid)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  h public.ticket_handoffs%rowtype;
  receiver_name text := btrim(coalesce(p_receiver_name, ''));
begin
  if receiver_name = '' or char_length(receiver_name) > 200 then
    return query select false, 'invalid'::text, null::uuid;
    return;
  end if;

  select * into h from public.ticket_handoffs where id = p_handoff_id for update;
  if not found or h.revoked_at is not null or h.expires_at <= timezone('utc'::text, now()) then
    return query select false, 'expired'::text, null::uuid;
    return;
  end if;
  if h.status <> 'Active' then
    return query select false, 'not_active'::text, null::uuid;
    return;
  end if;

  update public.ticket_handoffs
  set status = 'Claimed', assigned_to_external = receiver_name, updated_at = timezone('utc'::text, now())
  where id = h.id;

  insert into public.ticket_logs (ticket_id, action_type, note)
  values (
    h.ticket_id,
    'claim',
    '[Job Claimed by External] Receiver: ' || receiver_name || ' (time: ' ||
      to_char(timezone('utc'::text, now()), 'YYYY-MM-DD HH24:MI:SS') || ' UTC)'
  );

  update public.tickets set updated_at = timezone('utc'::text, now()) where id = h.ticket_id;
  return query select true, 'allowed'::text, h.ticket_id;
end;
$$;

revoke all on function public.claim_ticket_handoff(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_ticket_handoff(uuid, text) to service_role;

create or replace function public.submit_ticket_handoff_report(
  p_handoff_id uuid,
  p_status text,
  p_reporter_name text,
  p_notes text,
  p_attachments text[],
  p_report_text text
)
returns table (
  allowed boolean,
  reason text,
  ticket_id uuid,
  ticket_no text,
  assigned_agent_id uuid
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  h public.ticket_handoffs%rowtype;
  t public.tickets%rowtype;
  reporter_name text := btrim(coalesce(p_reporter_name, ''));
  notes text := btrim(coalesce(p_notes, ''));
  report_text text := btrim(coalesce(p_report_text, ''));
  next_handoff_status text;
begin
  if p_status not in ('In Progress', 'Pending', 'Fix Completed')
    or reporter_name = '' or char_length(reporter_name) > 200
    or char_length(notes) > 10000
    or report_text = '' or char_length(report_text) > 20000
    or coalesce(cardinality(p_attachments), 0) > 10 then
    return query select false, 'invalid'::text, null::uuid, null::text, null::uuid;
    return;
  end if;

  select * into h from public.ticket_handoffs where id = p_handoff_id for update;
  if not found or h.revoked_at is not null or h.expires_at <= timezone('utc'::text, now()) then
    return query select false, 'expired'::text, null::uuid, null::text, null::uuid;
    return;
  end if;
  if h.status not in ('Active', 'Claimed') then
    return query select false, 'not_active'::text, null::uuid, null::text, null::uuid;
    return;
  end if;

  select * into t from public.tickets where id = h.ticket_id for update;
  if not found then
    return query select false, 'invalid'::text, null::uuid, null::text, null::uuid;
    return;
  end if;

  insert into public.ticket_handoff_reports (handoff_id, status, reporter_name, notes, attachments)
  values (h.id, p_status, reporter_name, notes, coalesce(p_attachments, array[]::text[]));

  next_handoff_status := case when p_status = 'Fix Completed' then 'Completed' else 'Claimed' end;
  update public.ticket_handoffs
  set status = next_handoff_status, updated_at = timezone('utc'::text, now())
  where id = h.id;

  update public.tickets
  set status = p_status,
      resolved_at = null,
      resolution_summary = concat_ws(E'\n\n', nullif(t.resolution_summary, ''), report_text),
      updated_at = timezone('utc'::text, now())
  where id = t.id;

  insert into public.ticket_logs (ticket_id, action_type, from_status, to_status, note)
  values (t.id, 'status_change', t.status, p_status, report_text);

  update public.conversations
  set status = 'active', current_ticket_id = t.id, updated_at = timezone('utc'::text, now())
  where id = (
    select m.conversation_id from public.messages m
    where m.ticket_id = t.id and m.conversation_id is not null
    order by m.created_at desc limit 1
  );

  return query select true, 'allowed'::text, t.id, t.ticket_no::text, t.assigned_agent_id;
end;
$$;

revoke all on function public.submit_ticket_handoff_report(uuid, text, text, text, text[], text) from public, anon, authenticated;
grant execute on function public.submit_ticket_handoff_report(uuid, text, text, text, text[], text) to service_role;

commit;
