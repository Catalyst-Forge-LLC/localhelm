---
format_version: 0.1.0
id: lesson-8f75d3c3bbc8
kind: lesson
title: Land Today/Land N is the FilePress engine-sync list. After sync succeeds
  and shi
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
  context: Imported from workflow tracking gotchas[].
  problem: Land Today/Land N is the FilePress engine-sync list. After sync
    succeeds and ship fails, the site drops off Land and looks shipped even
    though land-ships.json was not updated.
  resolution: Mark pending on failed ship without changing the last success
    fingerprint. Union pending ids into Today Land. Continue the dashboard batch
    after one site fails.
  limits: Imported as a historical assertion. Verification was not recorded.
  generalization_status: observed
---


