---
format_version: 0.1.0
id: decision-61f113ec8e5f
kind: decision
title: Dashboard boot paints table chrome before fleet status finishes. GET
  /api/roster
record_status: active
created_at: 2026-09-04T10:30:00Z
updated_at: 2026-09-04T10:30:00Z
recorded_by:
  id: migration-import
  type: import
visibility: internal
relations: []
claims: []
data:
  status: accepted
  choice: Dashboard boot paints table chrome before fleet status finishes. GET
    /api/roster is manifest+archive only. Plugin boards load in parallel with
    /api/status. Pending fleet cells and empty Sites/Ports boards show a
    spinner. Write buttons stay disabled until that row’s facts exist.
    Sites/Ports must not say plugin-not-loaded while pluginsReady is false.
  rationale: Imported from workflow tracking. Verification was not recorded.
  alternatives: []
  authority: import
---


