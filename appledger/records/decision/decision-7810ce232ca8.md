---
format_version: 0.1.0
id: decision-7810ce232ca8
kind: decision
title: A multi-id publish continues after a per-id failure and writes each
  result to se
record_status: active
created_at: 2026-09-14T18:15:00Z
updated_at: 2026-09-14T18:15:00Z
recorded_by:
  id: migration-import
  type: import
visibility: internal
relations: []
claims: []
data:
  status: accepted
  choice: A multi-id publish continues after a per-id failure and writes each
    result to sessionStorage. Vite checkout watch ignores dashboard/, dist/, and
    .svelte-kit output/generated so publishing localhelm does not full-reload
    the serving board. A reload restores the result modal including leftover
    GitHub Publish links.
  rationale: Imported from workflow tracking. Verification was not recorded.
  alternatives: []
  authority: import
---


