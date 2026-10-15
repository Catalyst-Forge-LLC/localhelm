---
format_version: 0.1.0
id: session-status-recovery-20261014
kind: session
title: Preserve status reads and require terminal action acknowledgements
record_status: active
created_at: 2026-10-15T02:51:00Z
updated_at: 2026-10-15T03:11:56Z
recorded_by:
  id: codex
  type: agent
visibility: internal
relations: []
claims: []
data:
  session_id: session-status-recovery-20261014
  accomplished:
    - Added per-project request ordering so independent row reads both update and older reads cannot overwrite newer subjects.
    - Kept broad status results for unrelated projects and invalidated reads on board changes.
    - Required a terminal result from progress streams; incomplete connections now preserve uncertainty and direct status refresh.
    - Passed nine focused regressions, the dashboard build, zero dashboard check errors, and synthetic browser refresh/interruption scenarios. The full library compile is completed in the follow-up guidance batch.
  left_off: First reliability batch in the requested broad UXcalibur pass. Static guidance, confirmation recovery, and the saved review are still in progress. No publication or push.
  next_steps:
    - Complete blocked-action guidance and retained failure outcomes.
    - Save the full review with implementation status and verification boundaries.
---

Browser evidence is ignored under .localhelm/friction-qa. It uses synthetic
API responses and an isolated empty workspace; it is not a live publisher test.
