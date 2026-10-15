---
format_version: 0.1.0
id: evidence-companion-activity-durability-20261015
kind: evidence
title: Verify companion and Activity recovery across failures
record_status: active
created_at: 2026-10-15T04:53:00Z
updated_at: 2026-10-15T04:53:00Z
recorded_by: { id: codex, type: agent }
visibility: internal
relations: []
claims: []
data:
  evidence_kind: test_run
  repository_id: repo-home
  source: docs/specs/ux-friction-packets.md
  checked_at: 2026-10-15T04:49:48Z
  result: Full 359-test suite and 22 focused durability tests pass; library/dashboard builds and Svelte diagnostics pass; 26 combined desktop/mobile browser checks pass. Added malformed-preferences regression and related 15-test group also pass.
  limitations:
    - Browser subjects and companion responses are synthetic; no real publisher, push, deployment, model, service or label write.
    - The actual Activity API was exercised only in an isolated temporary workspace.
    - Browser storage is scoped to origin/workspace/Main or Demo; when unavailable, unsaved entries remain in memory with a visible warning.
    - The active npm installation is incomplete; pack fixtures use the complete alternate npm through npm_execpath.
---

Server checks cover concurrent appends, original receipt deduplication, content
collision, pre-clear generation rejection, and concurrent preference writes.
Dashboard checks cover offline reload, lost acknowledgement, local Clear with an
in-flight save, another-session Clear with explicit queued review, and quota failure
without replacing action state. Companion reads finish independently out of order,
failed reads retain marked last-known data, failed/pending toggles retain the last
acknowledged state, and Main/Demo/Main ignores an old-board failure. Corrupt
preferences are reported without silently enabling or overwriting companions.

Ignored evidence: .localhelm/packet-d-tests.log, packet-d-check.log,
packet-d-build.log, packet-d-plugin-tests.log, packets-final-tests.log,
packets-final-browser.log and friction-qa/*.png. Stale companion and quota warning
screens were visually inspected. No phase transition, push or external release.
