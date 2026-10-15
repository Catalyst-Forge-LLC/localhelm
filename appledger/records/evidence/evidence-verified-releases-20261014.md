---
format_version: 0.1.0
id: evidence-verified-releases-20261014
kind: evidence
title: Verify npm release targets and archive integrity
record_status: active
created_at: 2026-10-15T03:59:00Z
updated_at: 2026-10-15T03:59:00Z
recorded_by: { id: codex, type: agent }
visibility: internal
relations: []
claims: []
data:
  evidence_kind: test_run
  repository_id: repo-home
  source: docs/specs/ux-friction-packets.md
  checked_at: 2026-10-15T03:59:00Z
  result: 18 release lifecycle and publish tests pass; library/dashboard builds and Svelte diagnostics pass; synthetic desktop/mobile browser pass verifies release targets and existing recovery flows.
  limitations:
    - Publishers and browser APIs are synthetic; no real publish, push, deployment, model or companion mutation.
    - The active npm installation lacks promise-retry; packing fixtures use the complete alternate installed npm through npm_execpath.
    - Full suite initially passed 349 of 350 tests; the remaining assertion expected the former symlink error wording, updated to accept the earlier containment guard.
---

Receipts/logs are ignored under .localhelm/release-tests.log,
.localhelm/packets-tests.log, .localhelm/packets-check.log,
.localhelm/packets-build.log and .localhelm/friction-qa/.
Generated-public-package, binary omission, library without bin, lifecycle order,
identical publication bytes, changed source/archive and acknowledged publication
with a failed postpublish hook are exercised. Windows local Git remotes now decode
Git config escapes correctly.

UXcalibur 0.1.2 was separately verified against uncached registry metadata and a
real npx install in a temporary project. Its executable works and installed skill
bytes match the source. No personal installation was changed.
