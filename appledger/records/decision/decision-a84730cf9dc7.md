---
format_version: 0.1.0
id: decision-a84730cf9dc7
kind: decision
title: "Keep local is a separate persist from Archive.
  .localhelm/local-only.json (ids, "
record_status: active
created_at: 2026-09-16T18:40:00Z
updated_at: 2026-09-16T18:40:00Z
recorded_by:
  id: migration-import
  type: import
visibility: internal
relations: []
claims: []
data:
  status: accepted
  choice: Keep local is a separate persist from Archive.
    .localhelm/local-only.json (ids, markedAt). Rows stay on Fleet/Sites/Ports
    for start, commit, bump, and Sync. They drop off Publish, Ship, and Today
    Land until Include. A fleet id also covers id-site. Archive remains
    hide-from-Today.
  rationale: Imported from workflow tracking. Verification was not recorded.
  alternatives: []
  authority: import
---


