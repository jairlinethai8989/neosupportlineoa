# First-load performance rollout assurance ledger

## Identity

- ASSURANCE_UNIT_ID: `neo-line-oa/performance/first-load-rollout`
- REOPEN_GENERATION: `0`
- LEDGER_LOCATION: `docs/assurance/first-load-performance-rollout.md`
- ATTEMPT_COORDINATION_LOCATION: `docs/assurance/first-load-performance-review-attempts.json`; atomic primitive: exclusive directory creation at `.codex/assurance/first-load-performance-review.lock`
- UNIT_STATUS: `ship`

## Authority and boundary

- Objective: reduce first useful load time for customer Portal and staff pages without weakening authentication, authorization, tenant ownership, or secret handling.
- Canonical scope authority: user-approved implementation of the prioritized performance recommendations in the active Codex task.
- Acceptance criteria:
  - Portal first load performs one trusted LINE token verification for customer synchronization plus home data bootstrap.
  - A new LINE customer still receives a valid Portal home response and existing profile fields remain compatible.
  - Staff first-load bootstrap obtains profile, safe company settings, and ticket options through one authenticated server boundary.
  - Noncritical staff presence/notification work does not block first useful content.
  - Vercel Functions are configured for Singapore (`sin1`) near the Singapore Supabase project.
  - Unit, lint, build, authenticated read-only smoke, and production post-deploy checks are green before completion.
- Base state: `1d9ec272d2c528eef9f6f94c63fa0741752092f9` on `codex/security-hardening`; initial unrelated dirty files: `docs/NEW_SYSTEM_DESIGN_TH.md` and six `scratch/production-*.sql` snapshots.
- Spec or contract revision: not-applicable.
- Candidate scope: performance product code, tests, Vercel configuration, and this assurance unit's evidence artifacts; exclude the ledger and attempt-coordination artifacts from the behavior candidate identity.
- DELIVERY_ARTIFACT_MANIFEST: not-applicable; no installed/generated runtime copies are part of the delivery boundary.
- DELIVERY_ARTIFACT_MANIFEST_LOCATION: not-applicable.
- Bundled TDD delivery: not-applicable; the skill installation is not being changed.
- CANDIDATE_MANIFEST_LOCATION: `docs/assurance/first-load-performance-candidate.json` (to be generated at freeze).
- FROZEN_CANDIDATE_ID: `sha256:6daff436e55270af1ad3f2797d90ee3ae5e648a9599745b510769d3da0030f12`.
- Candidate identity recipe: the complete sorted file/hash records and deterministic aggregate recipe in `docs/assurance/first-load-performance-candidate.json`; includes every staged, unstaged, and untracked path in behavior scope.
- ASSURANCE_PACKET_ID: `sha256:6b9ccc5917c51014684e02c61854e0c47dd8d2a8a48080ffb63560be0fbce466` (same-attempt metadata closure snapshot).
- Closure packet identity recipe: SHA-256 of `normalized-ledger-pending-new:<sha>\nnormalized-packet-pending-new:<sha>\n`, where only ASSURANCE_PACKET_ID fields are represented by `pending-new`; normalized ledger SHA-256 `3adf44b6e0e781be13856ccfe8b59efa0c23be7f16b76f0d8ba11e59bf7d885f`, normalized packet SHA-256 `a8b422865586089212e0b9173c6e4fc101c7e1d90956d14ac750fb6e1ce9fbb4`.
- Declared final boundary: complete cumulative candidate immediately before production deployment.
- Protected boundaries: production auth behavior, production deployment, push, and any database migration execution.
- REVIEW_BUDGET_MODE: `default`
- REVIEW_BUDGET_AUTHORITY: Solweaver default policy.
- TARGET_REVIEW_CALLS: `1`
- MAX_REVIEW_CALLS: `3`
- REVIEW_CALLS_USED: `1`
- ACTIVE_REVIEW_RESERVATION: `none`

## Repository verification profile

- Authority inspected: root `AGENTS.md`, `package.json`, `playwright.config.ts`, and current repository scripts.
- FOCUSED_CHECKS: targeted Vitest files for Portal/staff bootstrap; targeted ESLint for changed source/test files.
- CANDIDATE_CHECKS: `npm run test:unit`, `npm run lint`, `npm run build`, and production-configured authenticated Playwright smoke.
- COMPOSE_CHECK: not-applicable; the repository defines no authoritative Compose rehearsal for this application.
- CANDIDATE_BOUNDARY: before independent review.
- COMPOSE_LIFECYCLE: not-applicable.
- EVIDENCE_REUSE: only for an unchanged `FROZEN_CANDIDATE_ID` or assurance-metadata-only changes.
- EARLY_GATE_OVERRIDES: focused auth/Portal tests may run early because the changed path is production-critical.

## TDD

- TDD_REQUIRED: yes for Portal and staff behavior changes; no for the Vercel region configuration-only change.
- Test seams: exported Portal server action behavior and exported staff bootstrap server action behavior.
- RED evidence:
  - Portal: `vitest run src/app/actions/portalActions.performance.test.ts`; failed because `customerUpsertCount` was `0` instead of `1` while LINE verification was already one call.
  - Portal polling regression: the existing-customer refresh test failed because `customerUpsertCount` was `1` instead of `0`.
  - Staff: `vitest run src/app/actions/staffBootstrapActions.performance.test.ts`; failed because the single bootstrap action was absent (`undefined` instead of `function`).
- GREEN/REFACTOR evidence:
  - Portal/staff/LINE focused run: 3 files, 6 tests passed.
  - Portal polling test rerun: 1 file, 2 tests passed; new customers are created while existing customers are not rewritten.
  - Focused ESLint over all changed production/test TypeScript: exit 0 with no output after removing the unused fallback binding.
- Exceptions authorized: configuration-only region change as permitted by the TDD skill.

## Checkpoints

| Checkpoint | Changed scope | Parent verification | Decisions | Known gaps | Status |
| --- | --- | --- | --- | --- | --- |
| preflight | ledger only | repository status and baseline inspection | preserve all unrelated untracked files | implementation and runtime evidence pending | open |
| portal-green | Portal action, LIFF hook, Portal performance test | 6 focused tests pass; focused lint green | verify LINE once inside home request; sync customer there; lazy-load LIFF SDK | full candidate and production evidence pending | checkpoint-ready |
| staff-green | staff bootstrap action, AppContext, staff performance test | one-auth safe DTO test green; focused lint green | replace three critical layout actions with one authenticated bootstrap | full candidate and production evidence pending | checkpoint-ready |
| region-config | `vercel.json` | config inspected against official Vercel region contract | pin Functions to `sin1`; no database migration | deployment verification pending | checkpoint-ready |
| candidate-freeze | complete behavior candidate | unit 44 files/217 tests; lint clean; production build 50 routes; Chromium authenticated smoke 1 passed | quarantine corrupted generated `.next/dev/types/validator.ts` cache and rerun build successfully | real LIFF requires post-deploy user observation | candidate-ready |

## Reviewability gate

- One coherent objective and invariant family: yes; first-load latency while preserving existing identity and authorization boundaries.
- Explicit risk surfaces: LINE identity verification, customer upsert compatibility, staff session/role authorization, safe settings DTO, production region/deploy behavior.
- Complete diff inspectable in one full reviewer pass: expected yes.
- Cross-unit and unchanged-code interactions captured: Portal create/detail actions, staff layout/notifications, proxy auth, dashboard data loading.
- REVIEWABILITY: `pass`

## Parent adversarial readiness

| Risk or counterexample | Reachable path | Direct evidence or closure | Result |
| --- | --- | --- | --- |
| New LINE customer has no DB row when Portal home loads | `getPortalHomeAction` after trusted token verification | performance test proves one verification, one creation, and a populated home response | closed |
| Existing customer polling repeatedly writes profile metadata | Portal home refresh/polling | observed RED at one upsert; GREEN proves zero upserts for existing customer | closed |
| Untrusted caller bypasses LINE identity | every Portal bootstrap request | `requireTrustedLineIdentity` remains mandatory; LINE identity suite 4/4 passed | closed |
| Staff bootstrap leaks server-only settings | authenticated layout bootstrap | action applies `toClientCompanySettings`; focused test checks secret keys are absent | closed |
| Staff bootstrap performs repeated authorization calls | initial AppContext authenticated path | focused test proves one `requireStaffAuth` call while loading all bootstrap data | closed |
| Region pin breaks build/routing | Vercel configuration and Next build | production build passed and generated all 50 routes | closed pre-deploy; region existence remains a post-deploy check |
| Authenticated pages regress | production artifact served by `next start` | Chromium authenticated read-only smoke passed 1/1 | closed |
| Real LIFF container behavior differs from unit environment | LINE in-app browser | cannot be fully automated without a live LINE ID token; existing security tests plus post-deploy user observation | explicitly permitted non-blocking operational check |

PARENT_ADVERSARIAL_READY: yes.

## Final-strict readiness gate

- REVIEW_READY: `yes`
- REVIEW_BLOCKERS: call 1 found assurance-metadata-only gaps; candidate behavior remains unblocked. Same-attempt metadata closure is in progress with the runner artifact restored, a durable smoke receipt added, and readiness being rebound to the active attempt.
- FINAL_STRICT_READINESS_RECORD_LOCATION: `docs/assurance/first-load-performance-readiness.json`
- MACHINE_READINESS_PROOF_LOCATION: `docs/assurance/first-load-performance-readiness-proof.json`

## Review attempts

| REVIEW_ATTEMPT_ID | Call | State | Runtime gate | Verdict | Outcome |
| --- | --- | --- | --- | --- | --- |
| first-load-performance-g0-call1 | 1 | completed | pass; observed `gpt-5.6-sol` / `max`, rollout SHA-256 `8851fc220e6e892e157de69010d51b2c97f2ba68562cfff8e6694bc3bf55241c`, session ordinal 0, turn-context ordinals 7 and 372 | ship | accepted after one permitted assurance-metadata closure; behavior candidate unchanged |

## Post-phase retrospective

- Final result: `ship`; no behavior blocker remained.
- Review call usage: 1 of 3; the same reviewer completed one permitted assurance-metadata closure without consuming another call.
- Effective controls: per-file candidate hashes caught scope drift concerns; a durable browser receipt and exact child runtime extraction made the production gate auditable.
- Workflow improvement retained locally: restore generated Playwright runner artifacts immediately after smoke and persist the credential-safe receipt before initial readiness freeze.
- Residual operational checks: observe real LIFF first load and confirm deployed Functions run in `sin1` after production deployment.
