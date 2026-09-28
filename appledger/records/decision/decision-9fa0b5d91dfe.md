---
format_version: 0.1.0
id: decision-9fa0b5d91dfe
kind: decision
title: Land skips ship when the site HEAD+dirty fingerprint matches the last
  successful
record_status: active
created_at: 2026-08-23T22:20:00Z
updated_at: 2026-08-23T22:20:00Z
recorded_by:
  id: migration-import
  type: import
visibility: internal
relations: []
claims: []
data:
  status: accepted
  choice: Land skips ship when the site HEAD+dirty fingerprint matches the last
    successful ship (stored in .localhelm/land-ships.json). FilePress exposes
    shipFingerprint and a one-pass plan --action land. Land status only loads
    engine+companion ids.
  rationale: Imported from workflow tracking. Verification was not recorded.
  alternatives: []
  authority: import
---


