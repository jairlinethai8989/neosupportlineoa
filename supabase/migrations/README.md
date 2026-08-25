# Canonical migrations

New production schema changes must be added here as timestamped, forward-only migrations and applied in filename order. SQL files outside this directory are historical inputs and must not be assumed to describe the deployed schema.

The migrations `202608100000` through `202608100011` have a documented phased rollout because the additive server seams must precede the application deployment and later lockdowns. Follow `docs/SECURITY_HARDENING_DEPLOYMENT.md`, record every manually applied version with `supabase migration repair --status applied`, and verify the remote ledger after each file. This is a bounded exception; new migrations return to filename order.

Before applying a security migration, capture the target environment's `pg_policies`, table grants, bucket configuration, and migration history. Never restore a permissive `USING (true)` policy as an emergency rollback; roll back the application to the server-mediated release instead.
