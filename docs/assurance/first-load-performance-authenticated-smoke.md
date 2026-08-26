# Candidate-bound authenticated smoke receipt

- Candidate: `sha256:6daff436e55270af1ad3f2797d90ee3ae5e648a9599745b510769d3da0030f12`
- Build input: the exact candidate manifest at `docs/assurance/first-load-performance-candidate.json`.
- Server command: `npm start` after the successful `npm run build`; Next.js 16.3.0 reported ready at `http://localhost:3000` in 973 ms using `.env.production.local` and `.env.local` from the successful build.
- Browser command: `node node_modules/@playwright/test/cli.js test authenticated_smoke.spec.ts --project=chromium --reporter=line` with `E2E_ADMIN_USERNAME` and `E2E_ADMIN_PASSWORD` supplied as process environment variables (values intentionally omitted from durable evidence).
- Test: `tests/authenticated_smoke.spec.ts:9`, read-only login plus protected server-mediated page navigation without redirect back to login.
- Observed output: `Running 1 test using 1 worker`; `[chromium] ... opens protected server-mediated pages without redirecting back to login`; `1 passed (10.7s)`.
- Exit code: `0`.
- Scope note: `test-results/.last-run.json` is a generated Playwright runner artifact and was restored byte-for-byte to base after the run; it is clean in `git status` and is not candidate or assurance evidence.
