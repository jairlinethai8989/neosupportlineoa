ROLE
Act as a fresh read-only reviewer. Do not edit files, implement fixes, commit, push, or orchestrate other agents.

EXECUTION MODE
auto

ASSURANCE MODE
final-strict

ASSURANCE UNIT
- ASSURANCE_UNIT_ID: neo-line-oa/performance/first-load-rollout
- REOPEN_GENERATION: 0
- LEDGER_LOCATION: docs/assurance/first-load-performance-rollout.md
- ATTEMPT_COORDINATION_LOCATION: docs/assurance/first-load-performance-review-attempts.json plus exclusive directory creation at .codex/assurance/first-load-performance-review.lock
- UNIT_CONTINUITY_CHECKED: yes, including the resumed task and zero prior review calls
- UNIT_STATUS: open
- COORDINATION_PRIMITIVE: atomically create the exact lock directory, reread journal/readiness/identity, persist reservation, and release the lock
- RESERVATION_EVIDENCE: to be persisted in the attempt journal immediately before this packet is sent

REVIEW BUDGET
- REVIEW_BUDGET_MODE: default
- REVIEW_BUDGET_AUTHORITY: Solweaver default policy
- TARGET_REVIEW_CALLS: 1
- MAX_REVIEW_CALLS: 3
- REVIEW_CALLS_USED: 0 before this reserved call
- REVIEW_ATTEMPT_ID: first-load-performance-g0-call1
- CALL_STATE: reserved
- THIS_CALL: 1

RE-REVIEW PREPARATION
- Required for this call: not-applicable for call 1
- Prior call outcomes: not-applicable for call 1
- Candidate refrozen after closure: not-applicable for call 1
- Complete readiness gate rerun: not-applicable for call 1
- Parent adversarial readiness rerun: not-applicable for call 1
- Neutral re-review closure matrix attached: not-applicable for call 1

OBJECTIVE
Reduce first useful load time for customer Portal and staff pages without weakening authentication, authorization, tenant ownership, or secret handling. Portal must verify LINE once in its home bootstrap, create a missing customer, avoid repeated writes for existing-customer polling, and return home data. Staff must load safe layout-critical bootstrap data through one authenticated server action. Functions must target Singapore. Unit, lint, build, and authenticated smoke must pass.

CHANGE SCOPE
- Base or starting state: 1d9ec272d2c528eef9f6f94c63fa0741752092f9 on codex/security-hardening
- Intended files or modules: Portal server action/LIFF hook, staff bootstrap/AppContext, performance tests, Vercel region
- Actual changed files: src/app/actions/portalActions.ts; src/app/actions/portalActions.performance.test.ts; src/app/actions/profileSettingsActions.ts; src/app/actions/staffBootstrapActions.performance.test.ts; src/contexts/AppContext.tsx; src/hooks/useLiff.ts; vercel.json
- Staged, unstaged, and untracked scope reconciliation: complete seven-path behavior scope is bound by per-file hashes; unrelated docs/NEW_SYSTEM_DESIGN_TH.md and six scratch/production-*.sql files are excluded and preserved
- Candidate scope exclusions: this ledger, attempt journal, reviewer packet, readiness record/proof, and candidate manifest are assurance metadata outside behavior identity
- CANDIDATE_MANIFEST_LOCATION: docs/assurance/first-load-performance-candidate.json
- FROZEN_CANDIDATE_ID: sha256:6daff436e55270af1ad3f2797d90ee3ae5e648a9599745b510769d3da0030f12
- ASSURANCE_PACKET_ID: sha256:6b9ccc5917c51014684e02c61854e0c47dd8d2a8a48080ffb63560be0fbce466
- DELIVERY_ARTIFACT_MANIFEST: not-applicable because no installed/generated/runtime-loaded copy is in the declared acceptance boundary
- DELIVERY_ARTIFACT_MANIFEST_LOCATION: not-applicable

RISK
- Assurance reason: production-critical authentication and customer identity paths plus protected production rollout
- Invariants: trusted LINE token verification remains mandatory; tickets remain customer-owned; new customers can enter Portal; existing polling avoids writes; staff auth is mandatory; settings secrets stay server-only; no database migration occurs

EVIDENCE
- Diff inspected by parent: yes; cumulative seven-file candidate reconciled against git status and untracked scope
- Commands rerun by parent: targeted Portal Vitest 2/2; npm run test:unit 44 files/217 tests; npm run lint exit 0; npm run build exit 0 with 50 routes; production `next start` plus authenticated Chromium smoke 1/1
- Repository verification profile: focused behavior tests, full candidate unit/lint/build, production-artifact authenticated smoke; Compose not-applicable because repository defines no authoritative Compose rehearsal
- Candidate verification receipt: fresh after the final Portal polling behavior change and bound to the manifest hashes; authenticated browser receipt is `docs/assurance/first-load-performance-authenticated-smoke.md`
- Compose receipt: not-applicable; no repository Compose contract
- Prior candidate evidence reused: no
- TDD applicability and evidence: observed Portal new-customer RED then GREEN, staff missing-action RED then GREEN, and existing-customer repeated-write RED then GREEN; config-only region change exempt
- Reviewability gate: pass
- Parent adversarial readiness: yes; risk/counterexample matrix in ledger
- FINAL_STRICT_READINESS_RECORD_LOCATION: docs/assurance/first-load-performance-readiness.json
- MACHINE_READINESS_PROOF: docs/assurance/first-load-performance-readiness-proof.json, same-attempt metadata-closure phase bound to the active attempt and current evidence hashes
- Applicable missing or not-run evidence: none
- Explicitly permitted non-blocking gaps: live LIFF end-to-end requires a real LINE in-app identity and is a post-deploy observation; deployment region is verified after deploy
- Product and architecture decisions resolved: yes
- REVIEW_READY: yes

FINAL-STRICT ASSURANCE UNIT
- Base state: 1d9ec272d2c528eef9f6f94c63fa0741752092f9
- FROZEN_CANDIDATE_ID: sha256:6daff436e55270af1ad3f2797d90ee3ae5e648a9599745b510769d3da0030f12
- ASSURANCE_PACKET_ID: sha256:6b9ccc5917c51014684e02c61854e0c47dd8d2a8a48080ffb63560be0fbce466
- Declared final boundary: complete cumulative candidate immediately before production deployment
- Complete cumulative diff: git diff plus explicit untracked test/config manifest reconciliation; seven behavior paths listed above
- Durable checkpoint ledger reconciled: yes; Portal, staff, region, tests, build, and smoke checkpoints recorded

REPORT LANGUAGE
English.

REVIEW
Inspect the actual files and complete diff. Prioritize correctness, regressions, security, data integrity, concurrency, public contracts, and missing tests. Apply the reviewer blocker evidence bar. Continue the complete audit after the first blocker and report every blocking finding discovered. If the full scope cannot be reviewed in one pass, return rethink rather than a partial audit.

RETURN
VERDICT: ship | fix-first | rethink
AUDIT_COMPLETENESS: complete | scope-too-broad
FINDING_CLASS: behavior | assurance-metadata-only | mixed | none
BEHAVIOR_BLOCKERS: ordered blockers or none
CANDIDATE_CHANGE_REQUIRED: yes | no
FINDINGS: ordered evidence-bar-qualified blockers or none
EVIDENCE: what supports the verdict
RESIDUAL RISK: non-blocking uncertainty, optional hardening, or none
