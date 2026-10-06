---
format_version: 0.1.0
id: evidence-git-directory-trust-20261006
kind: evidence
title: Verified Git directory trust recovery in the local build
record_status: active
created_at: 2026-10-06T12:02:15Z
updated_at: 2026-10-06T12:02:15Z
recorded_by:
  id: codex-localhelm
  type: agent
visibility: internal
relations: []
claims: []
data:
  evidence_kind: test_run
  repository_id: repo-home
  source: src/lib/gitTrust.ts
  digest: dd353015d526d177977e515b55f7429bcb6138ea9b2a7dacfec3b401a376421d
  checked_at: 2026-10-06T12:01:44.475Z
  result: All 316 runtime tests passed. Runtime and dashboard builds passed;
    dashboard type checking found zero errors. Desktop and mobile browser checks
    verified cancel, exact-directory confirmation, a real isolated Git config
    write, row recovery, repeat without duplication, demo refusal, and the
    operator API guard.
  limitations:
    - Browser checks used a synthetic repository and temporary global Git config.
    - Dubious ownership was induced with Git's test-only environment flag.
    - No personal Git config, existing checkout, npm package, or deployed site was changed.
    - Svelte's existing TodayBoard empty-block warning and Vite's chunk-size warning remain.
---

Commands passed: `pnpm test` (316 tests, zero failures), `pnpm build`, `pnpm --dir app check` (zero errors), and `pnpm dashboard:build`.

`src/lib/gitTrust.test.ts` covers canonical paths, nested package roots, read-only plans, changed targets, unenrolled IDs, unrelated Git errors, failed config writes, post-write errors, and a real Git write into an isolated global config. `src/lib/gitTrustActions.test.ts` verifies confirmation binds apply to the displayed path and refreshes only that row. Gate and header tests ensure unavailable Git status is not presented as quiet.

The built dashboard was served against a synthetic private package with a path containing spaces and `GIT_TEST_ASSUME_DIFFERENT_OWNER=1`. Playwright exercised Today and Fleet, desktop and 390px mobile layouts, Cancel, and Confirm. Confirm wrote one exact `safe.directory` entry into an isolated temporary config; Git then read the repo and the warning disappeared after refresh. A repeated apply did not add another entry. Missing or changed directories, malformed apply input, and unknown IDs were rejected. Demo apply was refused and a non-loopback Host received HTTP 403.

Local browser receipt and screenshots are retained under `.localhelm/git-trust-qa/` (ignored, synthetic data). No dependency or package version changed. These observations concern the local candidate, not an installed or published release.
