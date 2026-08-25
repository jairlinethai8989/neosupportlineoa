-- Production was created before attachment metadata columns were introduced.
-- Reproduce that legacy schema so the rollout-order gate exercises its upgrade.

alter table public.messages drop column if exists media_path;
alter table public.messages drop column if exists media_mime_type;
