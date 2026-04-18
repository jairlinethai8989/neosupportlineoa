# Schema Audit

Last reviewed: 2026-04-18
Scope: database shape inferred from SQL migrations plus application usage in `src/`

## Purpose

This document is the working schema baseline for auditing, cleanup, and future migrations.

The repository does not currently contain one complete authoritative SQL definition for every table. Several tables are fully defined in SQL, while others are only partially represented and must be inferred from runtime code usage.

Confidence levels used in this document:

- `Defined`: explicitly created in SQL in this repo
- `Altered`: explicitly extended by `ALTER TABLE` in SQL in this repo
- `Observed`: inferred from application queries, inserts, updates, joins, or filters

## Canonical Schema

### `profiles`

Purpose: internal staff profile table mapped 1:1 to Supabase Auth users.

Status:

- `Defined` in [supabase_setup.sql](/D:/Project%20APP/AntiGravity/neo_line_oa/supabase_setup.sql)
- `Altered` in [supabase_update_v1.2.sql](/D:/Project%20APP/AntiGravity/neo_line_oa/supabase_update_v1.2.sql)
- `Altered` in [fix_templates_columns.sql](/D:/Project%20APP/AntiGravity/neo_line_oa/fix_templates_columns.sql)
- `Observed` in multiple app files

Columns:

| Column | Type | Confidence | Notes |
|---|---|---|---|
| `id` | `uuid` | Defined | PK, FK to `auth.users(id)` |
| `full_name` | `text` | Defined | Display name for staff |
| `avatar_url` | `text` | Defined | Staff avatar |
| `department` | `text` | Defined | Free-text department name |
| `role` | `text` | Defined | Used for authorization |
| `status` | `text` | Defined | Agent availability status |
| `updated_at` | `timestamptz` | Defined | Audit/update timestamp |
| `team_id` | `uuid` | Altered | FK to `teams(id)` |
| `quick_replies` | `jsonb` | Altered | Personal canned replies |
| `resolution_templates` | `jsonb` | Altered | Personal resolution templates |
| `permissions` | unknown | Observed | Permission object used in UI gating |

Relations:

- `profiles.id -> auth.users.id`
- `profiles.team_id -> teams.id`

Primary consumers:

- [src/app/actions/ticketActions.ts](/D:/Project%20APP/AntiGravity/neo_line_oa/src/app/actions/ticketActions.ts)
- [src/app/actions/messageActions.ts](/D:/Project%20APP/AntiGravity/neo_line_oa/src/app/actions/messageActions.ts)
- [src/components/layout/MainSidebar.tsx](/D:/Project%20APP/AntiGravity/neo_line_oa/src/components/layout/MainSidebar.tsx)

### `company_settings`

Purpose: single-row global config table for branding, master lists, and shared templates.

Status:

- `Defined` in [supabase_setup.sql](/D:/Project%20APP/AntiGravity/neo_line_oa/supabase_setup.sql)
- `Altered` in [fix_templates_columns.sql](/D:/Project%20APP/AntiGravity/neo_line_oa/fix_templates_columns.sql)
- `Observed` in settings and workflow pages

Columns:

| Column | Type | Confidence | Notes |
|---|---|---|---|
| `id` | `bigint` | Defined | Identity PK |
| `company_name` | `text` | Defined | Branding |
| `logo_url` | `text` | Defined | Branding asset |
| `departments` | `text[]` | Defined | Legacy/shared department list |
| `updated_at` | `timestamptz` | Defined | Update timestamp |
| `resolution_templates` | `jsonb` | Altered | Global resolution templates |
| `modules` | unknown array | Observed | Module list used during resolve flow |
| `issue_types` | unknown array | Observed | Issue taxonomy list |

Primary consumers:

- [src/app/(dashboard)/settings/branding/page.tsx](/D:/Project%20APP/AntiGravity/neo_line_oa/src/app/(dashboard)/settings/branding/page.tsx)
- [src/app/(dashboard)/settings/master/page.tsx](/D:/Project%20APP/AntiGravity/neo_line_oa/src/app/(dashboard)/settings/master/page.tsx)
- [src/app/(dashboard)/inbox/page.tsx](/D:/Project%20APP/AntiGravity/neo_line_oa/src/app/(dashboard)/inbox/page.tsx)

### `teams`

Purpose: support team structure for assignment and transfer routing.

Status:

- `Defined` in [supabase_update_v1.2.sql](/D:/Project%20APP/AntiGravity/neo_line_oa/supabase_update_v1.2.sql)

Columns:

| Column | Type | Confidence | Notes |
|---|---|---|---|
| `id` | `uuid` | Defined | PK |
| `name` | `text` | Defined | Unique team name |
| `description` | `text` | Defined | Optional |
| `manager_id` | `uuid` | Defined | FK to `auth.users(id)` |
| `color_code` | `text` | Defined | UI color |
| `created_at` | `timestamptz` | Defined | Creation timestamp |

Relations:

- `teams.manager_id -> auth.users.id`
- `profiles.team_id -> teams.id`
- `ticket_logs.to_team_id -> teams.id`
- `tickets.assigned_team_id -> teams.id` inferred from app usage

### `customers`

Purpose: LINE-linked customer identity and registration record.

Status:

- No full `CREATE TABLE` found in repo
- Structure inferred from portal, webhook, tickets, and customer management screens

Columns:

| Column | Type | Confidence | Notes |
|---|---|---|---|
| `id` | `uuid` or similar | Observed | PK assumed |
| `line_user_id` | `text` | Observed | Unique LINE identity |
| `display_name` | `text` | Observed | Customer-facing name |
| `hospital_id` | `uuid` or similar | Observed | FK to `hospitals(id)` |
| `department_id` | `uuid` or similar | Observed | FK to `departments(id)` |
| `position_id` | `uuid` or similar | Observed | FK to `positions(id)` |
| `avatar_url` | `text` | Observed | Used in customer list |
| `metadata` | `jsonb` | Observed | Webhook stores original LINE event |
| `created_at` | `timestamptz` | Observed | Used in UI sorting |
| `updated_at` | `timestamptz` | Observed | Set during portal upsert |
| `department` | unknown | Observed | Legacy or denormalized field in customer UI |
| `position` | unknown | Observed | Legacy or denormalized field in customer UI |

Relations:

- `customers.hospital_id -> hospitals.id`
- `customers.department_id -> departments.id`
- `customers.position_id -> positions.id`
- `tickets.customer_id -> customers.id`
- `conversations.customer_id -> customers.id`
- `messages.customer_id -> customers.id`

Primary consumers:

- [src/components/portal/ProfileRegistrationModal.tsx](/D:/Project%20APP/AntiGravity/neo_line_oa/src/components/portal/ProfileRegistrationModal.tsx)
- [src/app/portal/page.tsx](/D:/Project%20APP/AntiGravity/neo_line_oa/src/app/portal/page.tsx)
- [src/app/api/line/webhook/route.ts](/D:/Project%20APP/AntiGravity/neo_line_oa/src/app/api/line/webhook/route.ts)

### `hospitals`

Purpose: master data for hospital or organization registration and ticket numbering context.

Status:

- No full `CREATE TABLE` found in repo
- Strongly implied by settings and registration flows

Columns:

| Column | Type | Confidence | Notes |
|---|---|---|---|
| `id` | unknown | Observed | PK assumed |
| `name` | `text` | Observed | Primary display field |
| `abbreviation` | `text` | Observed | Shown in registration and ticket creation |
| `ticket_prefix` | `text` | Observed | Created in master settings |
| `is_active` | boolean-ish | Observed | Toggled in master settings |

Relations:

- `customers.hospital_id -> hospitals.id`
- `tickets.hospital_id -> hospitals.id`

### `departments`

Purpose: master list of customer departments.

Status:

- No full `CREATE TABLE` found in repo

Columns:

| Column | Type | Confidence | Notes |
|---|---|---|---|
| `id` | unknown | Observed | PK assumed |
| `name` | `text` | Observed | Display field |
| `is_active` | boolean-ish | Observed | Toggled in master settings |

Relations:

- `customers.department_id -> departments.id`

### `positions`

Purpose: master list of customer job positions.

Status:

- No full `CREATE TABLE` found in repo

Columns:

| Column | Type | Confidence | Notes |
|---|---|---|---|
| `id` | unknown | Observed | PK assumed |
| `name` | `text` | Observed | Display field |
| `is_active` | boolean-ish | Observed | Toggled in master settings |

Relations:

- `customers.position_id -> positions.id`

### `tickets`

Purpose: primary support work item.

Status:

- No full `CREATE TABLE` found in repo
- Multiple columns confirmed by actions, pages, analytics, survey, and fix scripts

Columns:

| Column | Type | Confidence | Notes |
|---|---|---|---|
| `id` | `uuid` or similar | Observed | PK assumed |
| `ticket_no` | `text` | Observed | Human-readable ticket number |
| `customer_id` | unknown | Observed | FK to `customers(id)` |
| `hospital_id` | unknown | Observed | FK to `hospitals(id)` |
| `subject` | `text` | Observed | Main title |
| `description` | `text` | Observed | Used for internal ticket creation |
| `status` | `text` | Observed | Workflow state |
| `priority` | `text` | Observed | SLA and board grouping |
| `department` | `text` | Observed | Used by webhook-created tickets |
| `source` | `text` | Observed | Used by internal tickets |
| `assigned_agent_id` | unknown | Observed | FK to `profiles(id)` |
| `assigned_team_id` | unknown | Observed | FK to `teams(id)` |
| `assigned_at` | `timestamptz` | Altered | Added by fix script |
| `resolved_at` | `timestamptz` | Altered | Added by fix script |
| `resolution_summary` | `text` | Altered | Added by fix script |
| `module` | `text` | Observed | Resolution classification |
| `issue_type` | `text` | Observed | Resolution classification |
| `sla_due_at` | `timestamptz` | Observed | SLA alerting and analytics |
| `created_at` | `timestamptz` | Observed | Sorting/filtering |
| `updated_at` | `timestamptz` | Observed | Mutations update this |

Relations:

- `tickets.customer_id -> customers.id`
- `tickets.hospital_id -> hospitals.id`
- `tickets.assigned_agent_id -> profiles.id`
- `tickets.assigned_team_id -> teams.id`
- `ticket_logs.ticket_id -> tickets.id`
- `messages.ticket_id -> tickets.id`
- `conversations.current_ticket_id -> tickets.id`
- `csat_surveys.ticket_id -> tickets.id`

Primary consumers:

- [src/app/actions/ticketActions.ts](/D:/Project%20APP/AntiGravity/neo_line_oa/src/app/actions/ticketActions.ts)
- [src/app/(dashboard)/tickets/new/page.tsx](/D:/Project%20APP/AntiGravity/neo_line_oa/src/app/(dashboard)/tickets/new/page.tsx)
- [src/hooks/useNotifications.ts](/D:/Project%20APP/AntiGravity/neo_line_oa/src/hooks/useNotifications.ts)

### `conversations`

Purpose: active or closed communication thread per customer.

Status:

- No full `CREATE TABLE` found in repo

Columns:

| Column | Type | Confidence | Notes |
|---|---|---|---|
| `id` | unknown | Observed | PK assumed |
| `customer_id` | unknown | Observed | FK to `customers(id)` |
| `status` | `text` | Observed | `active` or `closed` |
| `current_ticket_id` | unknown | Observed | FK to current ticket |
| `last_message_at` | `timestamptz` | Observed | Sort key for inbox |

Relations:

- `conversations.customer_id -> customers.id`
- `conversations.current_ticket_id -> tickets.id`
- `messages.conversation_id -> conversations.id`

### `messages`

Purpose: unified message store for agent, customer, system, and media events.

Status:

- No full `CREATE TABLE` found in repo

Columns:

| Column | Type | Confidence | Notes |
|---|---|---|---|
| `id` | unknown | Observed | PK assumed |
| `conversation_id` | unknown | Observed | FK to `conversations(id)` |
| `ticket_id` | unknown | Observed | FK to `tickets(id)` |
| `sender_type` | `text` | Observed | `agent`, `customer`, `system` |
| `staff_id` | unknown | Observed | FK to `profiles(id)` for agent messages |
| `customer_id` | unknown | Observed | FK to `customers(id)` for customer messages |
| `content` | `text` | Observed | Text body or storage path |
| `message_type` | `text` | Observed | `text`, `image`, `video`, `file`, `audio`, `unsent` |
| `line_message_id` | `text` | Observed | Idempotency key from LINE |
| `line_uid` | `text` | Observed | LINE user identifier |
| `created_at` | `timestamptz` | Observed | UI ordering |

Relations:

- `messages.conversation_id -> conversations.id`
- `messages.ticket_id -> tickets.id`
- `messages.staff_id -> profiles.id`
- `messages.customer_id -> customers.id`

### `sla_rules`

Purpose: SLA matrix keyed by priority.

Status:

- No full `CREATE TABLE` found in repo

Columns:

| Column | Type | Confidence | Notes |
|---|---|---|---|
| `id` | unknown | Observed | PK assumed |
| `priority` | `text` | Observed | `Critical`, `High`, `Medium`, `Low` |
| `response_time_minutes` | numeric/int | Observed | First response SLA |
| `resolution_time_minutes` | numeric/int | Observed | Resolution SLA |

Primary consumer:

- [src/app/(dashboard)/settings/sla/page.tsx](/D:/Project%20APP/AntiGravity/neo_line_oa/src/app/(dashboard)/settings/sla/page.tsx)

### `csat_surveys`

Purpose: post-resolution satisfaction survey records.

Status:

- No full `CREATE TABLE` found in repo
- Strong inconsistency exists around score field naming

Columns:

| Column | Type | Confidence | Notes |
|---|---|---|---|
| `ticket_id` | unknown | Observed | FK to `tickets(id)` |
| `sent_at` | `timestamptz` | Observed | Inserted when ticket is resolved |
| `score` | numeric/int | Observed | Written by survey page |
| `comment` | `text` | Observed | Free-text feedback |
| `responded_at` | `timestamptz` | Observed | Survey submission time |
| `rating` | numeric/int | Observed | Analytics expects this instead of `score` |
| `created_at` | `timestamptz` | Observed | Analytics filters by it |

Primary consumers:

- [src/app/actions/ticketActions.ts](/D:/Project%20APP/AntiGravity/neo_line_oa/src/app/actions/ticketActions.ts)
- [src/app/survey/[id]/page.tsx](/D:/Project%20APP/AntiGravity/neo_line_oa/src/app/survey/[id]/page.tsx)
- [src/app/(dashboard)/analytics/page.tsx](/D:/Project%20APP/AntiGravity/neo_line_oa/src/app/(dashboard)/analytics/page.tsx)

### `ticket_logs`

Purpose: ticket-level audit trail.

Status:

- `Defined` in [supabase_audit_logs_v1.sql](/D:/Project%20APP/AntiGravity/neo_line_oa/supabase_audit_logs_v1.sql)

Columns:

| Column | Type | Confidence | Notes |
|---|---|---|---|
| `id` | `uuid` | Defined | PK |
| `ticket_id` | `uuid` | Defined | FK to `tickets(id)` |
| `performer_id` | `uuid` | Defined | FK to `auth.users(id)` |
| `action_type` | `text` | Defined | claim/transfer/resolve/status_change/etc. |
| `from_status` | `text` | Defined | Optional |
| `to_status` | `text` | Defined | Optional |
| `to_user_id` | `uuid` | Defined | Optional target user |
| `to_team_id` | `uuid` | Defined | Optional target team |
| `note` | `text` | Defined | Human-readable detail |
| `created_at` | `timestamptz` | Defined | Event timestamp |

Relations:

- `ticket_logs.ticket_id -> tickets.id`
- `ticket_logs.performer_id -> auth.users.id`
- `ticket_logs.to_user_id -> auth.users.id`
- `ticket_logs.to_team_id -> teams.id`

### `system_logs`

Purpose: admin and platform-level audit trail.

Status:

- `Defined` in [supabase_audit_logs_v1.sql](/D:/Project%20APP/AntiGravity/neo_line_oa/supabase_audit_logs_v1.sql)

Columns:

| Column | Type | Confidence | Notes |
|---|---|---|---|
| `id` | `uuid` | Defined | PK |
| `performer_id` | `uuid` | Defined | FK to `auth.users(id)` |
| `action_type` | `text` | Defined | Arbitrary admin action |
| `entity_type` | `text` | Defined | ticket/staff/company/sla/etc. |
| `entity_id` | `text` | Defined | Entity identifier as text |
| `old_data` | `jsonb` | Defined | Before snapshot |
| `new_data` | `jsonb` | Defined | After snapshot |
| `note` | `text` | Defined | Human-readable detail |
| `created_at` | `timestamptz` | Defined | Event timestamp |

Relations:

- `system_logs.performer_id -> auth.users.id`

### `audit_timeline` view

Purpose: unified audit stream over `ticket_logs` and `system_logs`.

Status:

- `Defined` in [supabase_audit_logs_v1.sql](/D:/Project%20APP/AntiGravity/neo_line_oa/supabase_audit_logs_v1.sql)

Columns:

| Column | Type | Confidence | Notes |
|---|---|---|---|
| `id` | inherited | Defined | Source row id |
| `log_source` | `text` | Defined | `ticket` or `system` |
| `entity_id` | `uuid` | Defined | Cast for UUID-like entities |
| `performer_id` | `uuid` | Defined | Actor |
| `action_type` | `text` | Defined | Action code |
| `note` | `text` | Defined | Detail |
| `created_at` | `timestamptz` | Defined | Timestamp |

## Storage Schema

Defined in [supabase-migrations.sql](/D:/Project%20APP/AntiGravity/neo_line_oa/supabase-migrations.sql)

Buckets:

- `public`
  - public read bucket for logos and public assets
- `chat_media`
  - authenticated access bucket for message attachments

## Relationship Summary

### Auth and staff

- `auth.users 1:1 profiles`
- `teams 1:N profiles`

### Customer master data

- `hospitals 1:N customers`
- `departments 1:N customers`
- `positions 1:N customers`

### Ticket workflow

- `customers 1:N tickets`
- `hospitals 1:N tickets`
- `profiles 1:N tickets` through `assigned_agent_id`
- `teams 1:N tickets` through `assigned_team_id`

### Conversation workflow

- `customers 1:N conversations`
- `tickets 1:N messages`
- `conversations 1:N messages`
- `customers 1:N messages`
- `profiles 1:N messages` through `staff_id`

### Audit and survey

- `tickets 1:N ticket_logs`
- `profiles/auth.users 1:N ticket_logs`
- `teams 1:N ticket_logs`
- `profiles/auth.users 1:N system_logs`
- `tickets 1:1 or 1:N csat_surveys` based on current app logic, intended to behave like 1:1

## Inconsistencies

### 1. No canonical DDL for several runtime-critical tables

Severity: High

Affected tables:

- `customers`
- `hospitals`
- `departments`
- `positions`
- `tickets`
- `conversations`
- `messages`
- `sla_rules`
- `csat_surveys`

Why it matters:

- migration history is incomplete
- onboarding and schema recreation are fragile
- production drift is likely

Recommended fix:

- create one canonical baseline migration or `baseline_schema.sql`
- backfill missing table definitions from live DB before future changes

### 2. `csat_surveys.score` vs `csat_surveys.rating`

Severity: High

Observed mismatch:

- survey submission writes `score`
- analytics reads `rating`

Evidence:

- [src/app/survey/[id]/page.tsx](/D:/Project%20APP/AntiGravity/neo_line_oa/src/app/survey/[id]/page.tsx)
- [src/app/(dashboard)/analytics/page.tsx](/D:/Project%20APP/AntiGravity/neo_line_oa/src/app/(dashboard)/analytics/page.tsx)

Risk:

- analytics can silently underreport or show zero CSAT

Recommended fix:

- standardize on one column name, preferably `score` or `rating`
- add a migration to rename or duplicate temporarily
- update all reads and writes consistently

### 3. `profiles.role` values are inconsistent

Severity: High

Observed mismatch:

- SQL comment says `Admin` / `Agent`
- runtime checks use `Administrator` / `Agent`

Evidence:

- [supabase_setup.sql](/D:/Project%20APP/AntiGravity/neo_line_oa/supabase_setup.sql)
- [src/app/actions/ticketActions.ts](/D:/Project%20APP/AntiGravity/neo_line_oa/src/app/actions/ticketActions.ts)
- [src/app/actions/messageActions.ts](/D:/Project%20APP/AntiGravity/neo_line_oa/src/app/actions/messageActions.ts)

Risk:

- privilege checks can fail depending on seeded data

Recommended fix:

- enforce one enum-like set of role values
- migrate existing data
- update SQL comments and any setup scripts

### 4. `customers` appears partly normalized and partly denormalized

Severity: Medium

Observed mismatch:

- registration flow uses `hospital_id`, `department_id`, `position_id`
- customer page also reads `department` and `position`

Evidence:

- [src/components/portal/ProfileRegistrationModal.tsx](/D:/Project%20APP/AntiGravity/neo_line_oa/src/components/portal/ProfileRegistrationModal.tsx)
- [src/app/(dashboard)/customers/page.tsx](/D:/Project%20APP/AntiGravity/neo_line_oa/src/app/(dashboard)/customers/page.tsx)

Risk:

- duplicate source of truth
- inconsistent reporting and filtering

Recommended fix:

- choose normalized FK model as canonical
- deprecate text columns or make them computed/materialized intentionally

### 5. `company_settings` mixes branding and master data arrays

Severity: Medium

Observed behavior:

- same table stores branding plus `modules`, `issue_types`, `resolution_templates`, and legacy `departments`

Risk:

- single-row table becomes catch-all config blob
- auditing and schema evolution become harder

Recommended fix:

- keep branding in `company_settings`
- consider separate tables for `modules`, `issue_types`, and global templates if the lists continue to grow

### 6. `messages.content` is polymorphic

Severity: Medium

Observed behavior:

- plain text for text messages
- storage path for uploaded media
- placeholder/system strings for unsent/system records

Evidence:

- [src/app/api/line/webhook/route.ts](/D:/Project%20APP/AntiGravity/neo_line_oa/src/app/api/line/webhook/route.ts)
- [src/app/actions/messageActions.ts](/D:/Project%20APP/AntiGravity/neo_line_oa/src/app/actions/messageActions.ts)

Risk:

- downstream rendering/reporting logic must branch implicitly

Recommended fix:

- add explicit fields such as `media_path`, `media_mime_type`, `metadata`
- keep `content` for text-only payloads when possible

### 7. `ticket_logs.performer_id` and `to_user_id` reference `auth.users`, but app joins through `profiles`

Severity: Low

Observed behavior:

- DB FK is to `auth.users(id)`
- UI joins `profiles!performer_id` and `profiles!to_user_id`

Why it works:

- because `profiles.id` mirrors `auth.users.id`

Risk:

- acceptable, but should be documented as intentional

Recommended fix:

- no schema change strictly required
- add comment in baseline schema to make this join contract explicit

## Recommended Migration Order

1. Extract live schema for all observed-only tables from the database.
2. Standardize enum-like text domains:
   - `profiles.role`
   - `tickets.status`
   - `tickets.priority`
   - `messages.sender_type`
   - `messages.message_type`
3. Resolve `csat_surveys.score` vs `rating`.
4. Normalize `customers` fields and decide canonical shape.
5. Create a baseline migration containing:
   - full table definitions
   - foreign keys
   - indexes
   - storage setup
   - RLS policies
6. Layer post-baseline migrations for later feature additions.

## Files Used For This Audit

SQL:

- [supabase_setup.sql](/D:/Project%20APP/AntiGravity/neo_line_oa/supabase_setup.sql)
- [supabase_update_v1.2.sql](/D:/Project%20APP/AntiGravity/neo_line_oa/supabase_update_v1.2.sql)
- [supabase_audit_logs_v1.sql](/D:/Project%20APP/AntiGravity/neo_line_oa/supabase_audit_logs_v1.sql)
- [supabase-migrations.sql](/D:/Project%20APP/AntiGravity/neo_line_oa/supabase-migrations.sql)
- [fix_templates_columns.sql](/D:/Project%20APP/AntiGravity/neo_line_oa/fix_templates_columns.sql)
- [fix_tickets_resolve.sql](/D:/Project%20APP/AntiGravity/neo_line_oa/fix_tickets_resolve.sql)
- [.agent/setup_registration.sql](/D:/Project%20APP/AntiGravity/neo_line_oa/.agent/setup_registration.sql)

App usage:

- [src/app/actions/ticketActions.ts](/D:/Project%20APP/AntiGravity/neo_line_oa/src/app/actions/ticketActions.ts)
- [src/app/actions/messageActions.ts](/D:/Project%20APP/AntiGravity/neo_line_oa/src/app/actions/messageActions.ts)
- [src/app/actions/portalActions.ts](/D:/Project%20APP/AntiGravity/neo_line_oa/src/app/actions/portalActions.ts)
- [src/app/api/line/webhook/route.ts](/D:/Project%20APP/AntiGravity/neo_line_oa/src/app/api/line/webhook/route.ts)
- [src/app/(dashboard)/settings/master/page.tsx](/D:/Project%20APP/AntiGravity/neo_line_oa/src/app/(dashboard)/settings/master/page.tsx)
- [src/app/(dashboard)/settings/sla/page.tsx](/D:/Project%20APP/AntiGravity/neo_line_oa/src/app/(dashboard)/settings/sla/page.tsx)
- [src/app/(dashboard)/analytics/page.tsx](/D:/Project%20APP/AntiGravity/neo_line_oa/src/app/(dashboard)/analytics/page.tsx)
- [src/app/portal/page.tsx](/D:/Project%20APP/AntiGravity/neo_line_oa/src/app/portal/page.tsx)
- [src/app/survey/[id]/page.tsx](/D:/Project%20APP/AntiGravity/neo_line_oa/src/app/survey/[id]/page.tsx)
- [src/components/portal/ProfileRegistrationModal.tsx](/D:/Project%20APP/AntiGravity/neo_line_oa/src/components/portal/ProfileRegistrationModal.tsx)
