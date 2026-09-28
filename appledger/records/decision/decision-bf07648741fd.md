---
format_version: 0.1.0
id: decision-bf07648741fd
kind: decision
title: Every batch write patches the board as each row finishes, then reloads
  git (or a
record_status: active
created_at: 2026-09-15T21:45:00Z
updated_at: 2026-09-15T21:45:00Z
recorded_by:
  id: migration-import
  type: import
visibility: internal
relations: []
claims: []
data:
  status: accepted
  choice: Every batch write patches the board as each row finishes, then reloads
    git (or a light pin reread for cascade). Post-write status never counts
    commits-since-npm or calls npm whoami. Busy says reading git/fleet, not the
    last N of N.
  rationale: Imported from workflow tracking. Verification was not recorded.
  alternatives: []
  authority: import
---


