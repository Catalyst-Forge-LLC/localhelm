---
format_version: 0.1.0
id: decision-2d3692bf7285
kind: decision
title: A failed Land/ship does not write the success fingerprint in
  land-ships.json. Th
record_status: active
created_at: 2026-09-14T19:45:00Z
updated_at: 2026-09-14T19:45:00Z
recorded_by:
  id: migration-import
  type: import
visibility: internal
relations: []
claims: []
data:
  status: accepted
  choice: A failed Land/ship does not write the success fingerprint in
    land-ships.json. The site is marked pending and stays on Today Land until
    ship succeeds. Dashboard multi-site Land continues after one site fails. CLI
    land --apply still stops. Skip ship only when the tree matches the last
    successful ship and the site is not pending.
  rationale: Imported from workflow tracking. Verification was not recorded.
  alternatives: []
  authority: import
---


