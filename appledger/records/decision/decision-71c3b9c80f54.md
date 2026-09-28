---
format_version: 0.1.0
id: decision-71c3b9c80f54
kind: decision
title: Cut version (and a publish plan that would bump) only when origin has
  commits af
record_status: active
created_at: 2026-08-26T21:05:00Z
updated_at: 2026-08-26T21:05:00Z
recorded_by:
  id: migration-import
  type: import
visibility: internal
relations: []
claims: []
data:
  status: accepted
  choice: Cut version (and a publish plan that would bump) only when origin has
    commits after the last published version. Count is git rev-list from v-tag
    or the last package.json version bump to origin/<branch>. 0 → skip 'nothing
    to cut'. Unknown (null) does not skip. Unpublished-ahead still publishes
    without this gate.
  rationale: Imported from workflow tracking. Verification was not recorded.
  alternatives: []
  authority: import
---


