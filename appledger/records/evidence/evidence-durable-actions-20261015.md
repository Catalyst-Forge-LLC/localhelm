---
format_version: 0.1.0
id: evidence-durable-actions-20261015
kind: evidence
title: Preserve acknowledged actions and recover unfinished batches
record_status: active
created_at: 2026-10-15T04:14:00Z
updated_at: 2026-10-15T04:14:00Z
recorded_by: { id: codex, type: agent }
visibility: internal
relations: []
claims: []
data:
  evidence_kind: test_run
  repository_id: repo-home
  source: docs/specs/ux-friction-packets.md
  checked_at: 2026-10-15T04:14:00Z
  result: 12 focused journal/batch/stream tests pass; library/dashboard builds and Svelte diagnostics pass; synthetic browser verifies Stop, reload, fresh remaining plan and post-write refresh failure.
  limitations:
    - Recovery receipts live in browser localStorage, scoped to origin, workspace and Main/Demo; clearing browser storage removes them.
    - Unknown outcomes require checking current status; no automatic rollback or write replay is claimed.
    - No real project write, publisher, deployment or companion command was exercised.
---

Action results retain named subjects, pending/running/succeeded/failed/unknown
states, exact returned error text and operation identity. The journal saves before
the request and immediately after acknowledgement, before status refresh. A
storage failure prevents another write. OTPs and write payloads are not stored.
Cascade reads its dependent targets before applying; Land retains its site IDs.
Old Publish/Land session results remain explicitly reviewable without an automatic
second recovery dialog. Mark reviewed preserves history after a status read.

Receipts: .localhelm/packet-b-tests.log, packet-b-check.log,
packet-b-build.log, packet-b-browser.log and friction-qa/action-history-mobile.png.
The mobile result was visually inspected. No phase transition or push.
