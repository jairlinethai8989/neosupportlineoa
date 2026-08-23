# Canonical migrations

New production schema changes must be added here as timestamped, forward-only migrations and applied in filename order. SQL files outside this directory are historical inputs and must not be assumed to describe the deployed schema.

Before applying a security migration, capture the target environment's `pg_policies`, table grants, bucket configuration, and migration history. Never restore a permissive `USING (true)` policy as an emergency rollback; roll back the application to the server-mediated release instead.
