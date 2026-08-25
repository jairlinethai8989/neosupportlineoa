# Security Hardening Deployment Runbook

## Required environment changes

1. Generate a new random `CRON_SECRET` with at least 16 characters.
2. Replace `CRON_SECRET` in the active Vercel project before deploying this branch.
3. Set `LINE_LOGIN_CHANNEL_ID` to the LINE Login channel ID associated with the LIFF app.
4. Confirm the LIFF app has the `openid` scope so `liff.getIDToken()` returns an ID token.
5. Keep `ENABLE_DEBUG_ROUTES` disabled in preview and production.
6. Generate `HANDOFF_ACCESS_PEPPER` from at least 32 random characters and store it only as a server-side secret.

Changing `HANDOFF_ACCESS_PEPPER` invalidates every existing hashed handoff link. Treat pepper rotation as a planned revoke-and-reissue event.

Do not put any of these values in `vercel.json`, source files, URLs, or client-visible environment variables.

The legacy `/api/setup-admin` HTTP bootstrap route has been removed. Provision an initial Administrator as a one-off operation through an authorized Supabase administrative channel, then use the authenticated `/api/admin/staff` workflow for subsequent staff accounts. Do not reintroduce setup credentials in query strings.

## Deployment order

1. Rotate `CRON_SECRET` in Vercel.
2. Set `HANDOFF_ACCESS_PEPPER` in every application environment that creates or redeems handoffs.
3. In a disposable Supabase environment, apply migrations `202608100000` through `202608100011` in filename order. Run all SQL files under `supabase/tests/`, then repeat the disposable-database checks with the production rollout order described below.
4. Apply only the additive migrations `202608100000_private_chat_media_bucket.sql`, `202608100002_handoff_access_hardening.sql`, and `202608100004_profile_update_hardening.sql` to production. These add the private media bucket and new server/RPC seams while keeping legacy Portal policies temporarily available.
5. Deploy the application changes with the pepper configured. Confirm profile self-service writes now use `update_own_staff_profile` before continuing.
6. Confirm scheduled cron requests receive HTTP 200 with Vercel's Bearer header.
7. Confirm a signed-in Agent or Administrator can manually send a report from Reports Hub.
8. Confirm requests using the old `?key=` URL receive HTTP 401.
9. Confirm LIFF profile sync, ticket creation, customer messages, private attachment upload/read, and CSAT submission work with a real LINE account. Confirm a legacy `/survey/<ticket-uuid>` link redirects into the Portal and only the owning LINE identity can see or submit that survey.
10. Create a new handoff and verify the link/PIN are shown only in the creation response. Test PIN rejection, lockout, claim, private attachment upload, report submission, and completion.
11. Snapshot production `pg_policies`, grants, bucket configuration, active legacy handoffs, and migration history.
12. Apply `supabase/migrations/202608100001_portal_rls_lockdown.sql` and run the Portal/staff smoke checks.
13. Apply `supabase/migrations/202608100005_profile_update_lockdown.sql` immediately after the Portal lockdown. Verify an Agent can edit an allowlisted preference through the RPC but cannot directly update `role` or `permissions`.
14. Confirm Company and Master Settings load through the server DTO, the Gemini settings page reports only whether a key is configured, and replacing the key succeeds without returning the stored key to the browser. Then apply `supabase/migrations/202608100006_company_settings_secret_lockdown.sql`.
15. Confirm SLA Settings loads and saves through `saveSlaRulesAction`, then apply `supabase/migrations/202608100007_sla_rules_permission_lockdown.sql`. Verify active staff can read SLA rules for ticket creation, but only Administrators or staff with `settings_sla: edit` can create, update, or delete them.
16. Confirm the Audit Settings system-log tab loads through `getSystemLogsAction`, then apply `supabase/migrations/202608100008_system_logs_permission_lockdown.sql`. Verify only Administrators or staff with `settings_audit: view|edit` can read system logs and browser writes are initially append-only during the compatibility window.
17. Confirm internal ticket creation uses `createInternalTicketAction`, Ticket Detail reads and mutations use authenticated server actions, staff attachments use identity/ticket-scoped signed uploads, Notification ticket-log reads derive their Agent/Admin scope on the server, and Inbox text/system/link/media mutations use authenticated actions. Then apply `supabase/migrations/202608100009_ticket_logs_staff_lockdown.sql`. Verify staff can read ticket activity, while authenticated browsers cannot insert, update, or delete ticket logs.
18. Confirm Profile settings/templates and Profile/Branding asset uploads complete through authenticated server actions, and staff administration audit writes use a service-role client. Apply `supabase/migrations/202608100010_system_logs_server_write_only.sql`; verify authenticated browsers cannot insert, update, or delete `system_logs` while authorized viewers can still read them.
19. Apply `supabase/migrations/202608100003_handoff_rls_lockdown.sql`. This expires active legacy raw-credential links, clears raw token/PIN values, and removes browser handoff access.
20. Run Portal and staff E2E checks against the locked-down environment, including list, detail/static metadata, internal create, profile edit/read DTO, staff directory/management DTO, Profile/Branding signed asset upload, text/media message, attachment, CSAT, settings DTO/Gemini key replacement, Google Apps Script URL update/clear, Master Data CRUD/reference reads, SLA edit authorization, system/ticket audit-log authorization, and the full external handoff workflow.
21. Confirm Personal/Staff Analytics, cached AI evaluations, Evaluation 360 reads, and evaluation writes pass through authenticated server boundaries. Apply `supabase/migrations/202608100011_staff_evaluations_server_only.sql`; verify anon and authenticated browser roles have no privileges on either evaluation table while both evaluation workflows remain functional through the application.

### Migration ledger protocol

The phased production order is intentional and is the only exception to filename order. Do not rename versions that may already exist in an environment, and do not run a later `supabase db push` until every manually applied version has been recorded in Supabase migration history.

Before the first production change, capture the ledger:

```powershell
supabase migration list --linked
```

For each migration in steps 4 and 12–21, use this sequence and stop on any mismatch:

1. Confirm the version is absent from the remote side of `supabase migration list --linked`. If it is already present, do not reapply it; reconcile the deployed schema and migration source first.
2. Apply exactly one reviewed SQL file through the authorized Supabase SQL channel.
3. Only after that SQL transaction succeeds, record its 12-digit version, for example:

```powershell
supabase migration repair 202608100000 --status applied --linked
supabase migration list --linked
```

4. Confirm that exact version now appears on both the local and remote sides before continuing.

Use the versions in this exact order: `202608100000`, `202608100002`, `202608100004`, `202608100001`, `202608100005`, `202608100006`, `202608100007`, `202608100008`, `202608100009`, `202608100010`, `202608100003`, `202608100011`. If SQL succeeds but the repair command fails, do not rerun the SQL; repair and verify the ledger before continuing.

After the final smoke check, require both commands to agree that no migration remains pending:

```powershell
supabase migration list --linked
supabase db push --dry-run --linked
```

Master Data list/create/update/toggle and Google Sheets integration settings are now server-mediated and permission checked. Do not prepare or apply a Master Data RLS lockdown migration until a production/pre-production schema snapshot confirms the real table names, primary keys, foreign keys, existing policies, and grants. The repository currently contains conflicting historical names (including `organizations` and `hospitals`), so guessing that migration could lock out valid workflows or target the wrong table.

Profile avatars, signatures, and company logos remain in the legacy public `chat_media` bucket for stable public URLs, but new uploads use server-issued staff/kind-scoped signed paths and server-side post-upload size/MIME verification. Snapshot the real `storage.objects` policies and smoke-test every signed upload flow before revoking the remaining broad authenticated INSERT policy for `chat_media`/`chat_media_private`; that storage-policy lockdown is intentionally not guessed in this migration set.

Own-profile reads, staff presence/management directories, AppContext reference data, Ticket Detail static metadata, and both Audit Settings tabs now return explicit server DTOs. Database Realtime subscriptions that delivered whole `profiles` or `company_settings` rows to callbacks have been removed; presence tracking continues through Supabase Presence without carrying database row payloads.

The post-login landing-page lookup is server-mediated and derives the profile ID from the authenticated session. Authentication failures return a generic message instead of exposing provider details in the login UI.

Customer list/detail history, transfer team/staff targets, and notification enrichment now use authenticated server DTOs. The notification hook no longer subscribes browser callbacks to full Postgres rows from `tickets`, `ticket_logs`, `messages`, or `conversations`; it polls bounded, permission-aware activity DTOs every 10 seconds. Transfer mutations validate the ticket and selected Agent/Administrator/team against server-side records before updating assignments.

New Ticket form options, Dashboard filter options/export rows, and the main Analytics aggregate RPC are also server-mediated. Dashboard export inputs enforce a valid range of at most 366 days, UUID organization filters, bounded module/issue filters, fixed output columns, and a 10,000-row server cap; analytics aggregates are reduced to bounded `{name, value}` DTOs before reaching the browser.

Personal Analytics, Staff Analytics, cached staff evaluations, and Evaluation 360 reads are server-mediated as well. Staff-wide data requires `analytics_staff:view`; personal analytics derives the agent ID from the authenticated session instead of accepting it from the browser. Date ranges and staff IDs are strictly validated and capped at 366 days. Evaluation 360 returns only the current evaluator's matching record plus a bounded KPI DTO.

The shared analytics query and cron-service modules are marked server-only and use the service-role client only behind an authenticated staff action or an authenticated cron/report route.

The Playwright suite includes a read-only authenticated smoke path controlled by `E2E_ADMIN_USERNAME` and `E2E_ADMIN_PASSWORD`. The state-changing LIFF-to-ticket workflow requires the same explicit credentials and remains skipped by default so a normal test run cannot mutate an unintended environment.

Ticket Workspace pagination/conversation mapping and Inbox list/thread reads now run through authenticated, permission-checked server actions. Ticket Workspace validates its date/search/sort/page contract before composing PostgREST filters. Inbox validates UUID resources and paired cursors, returns normalized DTOs, and no longer delivers full `conversations` or `messages` rows through browser Realtime callbacks; the list and open thread refresh from safe server DTOs at 10-second and 5-second intervals respectively.

Staff Ticket Detail and Portal Ticket Detail also no longer subscribe browser callbacks to Postgres row changes. Staff detail refreshes its authenticated DTO every 5 seconds while visible (30 seconds in the background), and Portal refreshes its LINE-ownership-checked DTO every 10 seconds while visible (45 seconds in the background). Both preserve unmatched optimistic messages during refresh. The only remaining Supabase channel in the shared staff UI is Presence, which carries application-defined online presence rather than database rows.

## Outbound integration security

- Google Sheets export accepts only HTTPS deployments under `script.google.com/macros/s/.../exec` and follows redirects only to the documented one-time `script.googleusercontent.com/macros/echo` endpoint. Local, private, credentialed, non-Google, and deceptive hostnames must be rejected before ticket data is queried or transmitted.
- Saving the Google Sheets integration endpoint uses the same strict Google Apps Script allowlist through a `settings_master: edit` server action. The browser cannot choose the `company_settings` row, and clearing the URL intentionally disconnects the integration.
- Lark spreadsheet tokens and sheet IDs are identifier-only values; path separators, query characters, range syntax, and whitespace are rejected.
- LINE webhook media is imported only when `contentProvider.type` is `line`, through the LINE SDK, with a 15 MB streaming limit. `contentProvider.external` is intentionally left as an attachment placeholder and is never fetched by the application server. Portal attachments use the server-authorized signed upload flow instead.
- New Portal, staff, Inbox, handoff, and LINE webhook attachments are stored in the private `chat_media_private` bucket. Inbox uploads use server-issued user/conversation-scoped signed paths and are finalized only after the server verifies the stored object and ticket relationship. Staff reads go through `/api/media/chat`, which authenticates the staff session and redirects to a 60-second signed object URL. Portal and handoff reads are signed only after ownership/capability verification.
- The legacy `chat_media` bucket also contains public branding and signature assets. Leave it unchanged during this release. Existing message URLs remain compatible, but should be inventoried and backfilled into `chat_media_private` in a separate data-migration window before removing public access from the legacy bucket.
- Smoke-test Google and Lark exports with valid configured destinations after deployment. Also confirm a signed LINE webhook containing an external media provider creates no outbound request and does not interrupt later webhook events.
- Analytics Insights accepts only the documented query fields, UUID organization IDs, strict booleans, valid explicit date ranges up to 366 days, and a custom AI prompt of at most 2,000 characters. Gemini requests share a 20-second deadline and generated reports are validated against a bounded output contract before rendering; invalid model output falls back to the deterministic report.
- Smoke-test Analytics Insights with `all`, `7days`, `30days`, and a valid organization filter. Confirm unknown parameters, duplicate parameters, invalid UUIDs, malformed date ranges, and oversized prompts receive HTTP 400 before analytics data is queried.
- Staff AI Evaluation accepts only the dashboard request contract, a valid staff UUID, a valid date range up to 366 days, bounded KPI values, and the strict `force=true|false` query. Gemini calls have a 20-second deadline, provider error bodies are not logged, and both new and cached evaluation payloads must pass the bounded output contract before they are returned or persisted.
- Smoke-test Staff AI Evaluation with a valid dashboard request and both force values. Confirm unknown or duplicate query parameters, extra request/KPI fields, malformed dates, out-of-range metrics, and invalid UUIDs receive HTTP 400 before evaluation data is queried; confirm malformed provider output returns the deterministic simulated evaluation and is not saved.
- Analytics Insights, Staff AI Evaluation, and Evaluation-360 now share the external-AI envelope parser and 1 MB streaming response limit. Database-derived names, activity notes, and chat samples are stripped of unsafe controls and bounded before entering prompts; prompt data is explicitly treated as untrusted evidence rather than instructions.
- Smoke-test all three Analytics AI paths with valid provider responses, malformed envelopes, oversized responses, timeouts, and provider HTTP failures. Confirm malformed/oversized responses use deterministic fallbacks, no raw provider error reaches logs or clients, and invalid generated evaluations are never persisted.
- Presentation AI no longer reads or accepts Gemini API keys in the browser. Its request statistics, custom prompt, configured RAG endpoint, RAG/Gemini deadlines, and generated insights use bounded contracts; malformed provider output falls back to deterministic insights without exposing provider error bodies.
- Smoke-test Presentation AI with preset and custom prompts over valid report periods. Confirm client-provided API keys, extra fields, malformed or oversized report data, invalid dates, oversized prompts, and malformed model output are rejected or fall back safely without exposing a key or raw provider error.
- Ticket AI Summary validates the ticket UUID before querying, selects only the ticket/chat fields required for analysis, limits context to the latest 200 messages and 40,000 characters, applies RAG/Gemini deadlines and a 1 MB provider-response limit, and validates the post-mortem contract before updating `tickets.ai_analysis`.
- Smoke-test Ticket AI Summary for a resolved ticket and invalid UUID. Confirm malformed provider output is not persisted, provider failures return only the deterministic simulated summary, and browser/API responses and logs contain no raw provider error or AI secret.

## Verification commands

### Dependency audit exception

`npm audit --omit=dev` currently reports `image-size@1.2.1`, transitively required by `pptxgenjs@4.0.1`, for GHSA-w3rx-r6r6-pgpr and GHSA-5p2g-fcmc-qvqq. The upstream advisory marks every published `image-size` version as affected and lists no patched release. Do not run `npm audit fix --force`: npm resolves the alert by downgrading `pptxgenjs` to an API-incompatible version.

The affected parser is not reachable from a server request in this application. `pptxgenjs` is dynamically imported only by the client-side Presentation page, and the export path passes PNG data generated by `html2canvas`; it does not pass uploaded ICNS, JXL, or HEIF bytes to `image-size`. Keep the dependency lazy/client-only, do not add server-side PPTX generation with untrusted images, and replace or upgrade the package when an official patched release becomes available.

```powershell
npm run test:unit
npx tsc --noEmit
npm run test:security-db
npm run test:security-db -- -MigrationOrder production-rollout
npm run build
npm audit --omit=dev
```

`test:security-db` starts an isolated `postgres:17-alpine` container, applies the reconstructed baseline plus migrations `000` through `011`, runs the behavioral SQL checks, and removes the container. Its default `chronological` mode verifies filename order. The `production-rollout` mode verifies the phased order in this runbook, including representative historical production policy names and the security state immediately after the Portal lockdown. Neither mode reads, resets, or mutates the developer's local Supabase database.

The application is pinned to Next.js `16.3.0`; keep `next`, `eslint-config-next`, and `@next/bundle-analyzer` on the same release line. The legacy `xlsx` dependency has been removed. Spreadsheet exports now use the pure converter in `src/lib/exports/spreadsheet.ts` plus separate `spreadsheet.browser.ts` and `spreadsheet.server.ts` adapters so browser bundles cannot reach Node-only modules.

As of this hardening pass, `npm audit --omit=dev` reports two high findings from `pptxgenjs@4.0.1` and its `image-size@1.2.1` dependency. The registry-proposed remediation is a breaking downgrade to `pptxgenjs@1.1.5`, so it must not be applied with `npm audit fix --force`. Exposure is limited to the presentation export flow, where PptxGenJS receives a PNG data URL generated by `html2canvas`, not a user-uploaded image. Re-evaluate this exception when PptxGenJS publishes a compatible release using a fixed `image-size`; until then, do not add user-controlled image parsing to the presentation adapter.

The SQL checks must prove this access matrix before production migration:

| Actor | Portal-sensitive tables | `chat_media_private` |
| --- | --- | --- |
| `anon` | No read/write | No direct read/write |
| Authenticated without Agent/Administrator profile | No read/write | No direct read/write |
| Agent/Administrator | Staff read/write policies | Authenticated staff policies |
| Service role | Server-mediated Portal access | Signed upload/read issuance |

The company settings checks must additionally prove that anon and authenticated non-staff cannot read the table, authenticated staff can read only the browser-safe column allowlist, authenticated browser sessions cannot select or update `gemini_api_key`, and service role retains server-only key access.

The SLA checks must additionally prove that anon and authenticated non-staff cannot read or write `sla_rules`, active staff can read SLA rules for ticket workflows, and only Administrators or staff with `settings_sla: edit` can mutate them.

The system-log checks must additionally prove that anon, non-staff, and staff without `settings_audit` cannot read `system_logs`; authenticated browser sessions cannot insert, update, or delete audit rows after migration `010`; and service role retains server-side write access.

The ticket-log checks must additionally prove that anon and authenticated non-staff cannot read `ticket_logs`, authenticated staff can read ticket activity required by detail/notification/analytics views, authenticated browser sessions cannot insert, update, or delete audit rows, and trusted server/RPC paths retain write access.

The handoff matrix must additionally prove that `anon` and `authenticated` cannot access handoff tables or execute redemption/claim/report RPCs, while service role can redeem credentials with a five-attempt lockout and perform atomic claim/report transitions.

## RLS rollback rule

Do not restore an anon/public `USING (true)` policy. If the release must be rolled back after migrations `202608100001`, `202608100003`, `202608100005`, `202608100006`, `202608100007`, `202608100008`, `202608100009`, `202608100010`, or `202608100011`, keep the hardened schema and roll the application back only to a release that uses the verified server Portal, profile RPC/actions, handoff seams, safe company-settings DTO, server-mediated SLA settings writes, server-only system-log writes, server-mediated system-log reads, server-mediated internal ticket creation, and server-only staff evaluation access. Do not try to recover invalidated raw handoff credentials; issue new links from the hash-aware application. These migrations are prepared in source control but are not applied automatically by this branch.
