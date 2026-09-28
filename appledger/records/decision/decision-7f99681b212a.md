---
format_version: 0.1.0
id: decision-7f99681b212a
kind: decision
title: "git fetch and git status use async spawn + mapPool (8). Dashboard fetch
  remotes "
record_status: active
created_at: 2026-09-15T01:45:00Z
updated_at: 2026-09-15T01:45:00Z
recorded_by:
  id: migration-import
  type: import
visibility: internal
relations: []
claims: []
data:
  status: accepted
  choice: git fetch and git status use async spawn + mapPool (8). Dashboard fetch
    remotes is one POST with the fleet ids. Status reuses the npmLatestMany map
    and skips git log for commitsSinceNpm unless Publish still needs a bump
    count. CLI land --apply continues after one site fails (exit 1 if any
    failed). Archive has planArchive; apply:false plans, omit/true writes.
  rationale: Imported from workflow tracking. Verification was not recorded.
  alternatives: []
  authority: import
---


