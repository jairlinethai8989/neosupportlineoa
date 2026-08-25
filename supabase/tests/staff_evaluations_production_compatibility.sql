-- The production snapshot has staff_evaluations_360 but not staff_evaluations.
-- The server-only lockdown must harden every evaluation table that exists
-- without requiring an unused historical table to be created first.

drop table public.staff_evaluations;
