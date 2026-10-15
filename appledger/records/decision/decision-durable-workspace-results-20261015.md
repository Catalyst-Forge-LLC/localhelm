---
format_version: 0.1.0
id: decision-durable-workspace-results-20261015
kind: decision
title: Preserve acknowledgements and reject stale workspace state
record_status: active
created_at: 2026-10-15T04:53:00Z
updated_at: 2026-10-15T04:53:00Z
recorded_by: { id: codex, type: agent }
visibility: internal
relations: []
claims: []
data:
  status: accepted
  choice: Keep browser action receipts separate from Activity, order companion reads per plugin and board epoch, and save Activity idempotently with clear generations.
  rationale: A failed refresh or log save cannot invalidate an acknowledged action; lost acknowledgements and stale replies must not trigger repeated writes or resurrect cleared logs.
  alternatives:
    - Automatically replay interrupted write payloads.
    - Replace local operation with an account-backed job service.
  authority: user
---

The authorized UX packets preserve the existing local product and plan boundaries.
Action receipts store identity/result metadata without OTPs or write payloads.
Recovery reads current status and opens a fresh plan. Browser Activity buffering
is separate from workspace Activity and never changes action result state.
Workspace locking and atomic replacement protect companion preferences and logs;
per-plugin sequence and board epochs reject stale successes and failures.
