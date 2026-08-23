-- Finalize handoff credential rotation after the hash-aware application release is healthy.
-- This intentionally invalidates every legacy raw-credential handoff.

begin;

update public.ticket_handoffs
set status = case when status in ('Active', 'Claimed') then 'Expired' else status end,
    revoked_at = case
      when token_hash is null and status in ('Active', 'Claimed')
        then coalesce(revoked_at, timezone('utc'::text, now()))
      else revoked_at
    end,
    token = null,
    secure_pin = null,
    updated_at = timezone('utc'::text, now())
where token is not null
   or secure_pin is not null;

update public.tickets t
set escalation_token = null,
    updated_at = timezone('utc'::text, now())
where escalation_token is not null;

drop policy if exists "Allow select for ticket_handoffs" on public.ticket_handoffs;
drop policy if exists "Allow insert for authenticated users on ticket_handoffs" on public.ticket_handoffs;
drop policy if exists "Allow update for everyone on ticket_handoffs" on public.ticket_handoffs;
drop policy if exists "Allow select for ticket_handoff_reports" on public.ticket_handoff_reports;
drop policy if exists "Allow public insert for ticket_handoff_reports" on public.ticket_handoff_reports;
drop policy if exists "Allow select for ticket_verifications" on public.ticket_verifications;
drop policy if exists "Allow insert for authenticated users on ticket_verifications" on public.ticket_verifications;

alter table public.ticket_handoffs enable row level security;
alter table public.ticket_handoff_reports enable row level security;
alter table public.ticket_verifications enable row level security;

revoke all on public.ticket_handoffs from anon, authenticated;
revoke all on public.ticket_handoff_reports from anon, authenticated;
revoke all on public.ticket_verifications from anon, authenticated;
grant select, insert, update, delete on public.ticket_handoffs to service_role;
grant select, insert, update, delete on public.ticket_handoff_reports to service_role;
grant select, insert, update, delete on public.ticket_verifications to service_role;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = any (array['ticket_handoffs', 'ticket_handoff_reports', 'ticket_verifications'])
      and (roles && array['public', 'anon', 'authenticated']::name[])
  ) then
    raise exception 'Handoff lockdown aborted: browser-accessible policies remain';
  end if;

  if exists (
    select 1 from public.ticket_handoffs
    where token is not null or secure_pin is not null
  ) then
    raise exception 'Handoff lockdown aborted: raw credentials remain';
  end if;
end
$$;

commit;
