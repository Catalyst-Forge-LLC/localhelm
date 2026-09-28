---
format_version: 0.1.0
id: lesson-c5c465cf12fd
kind: lesson
title: Adding a folder to the Helm fleet does not list it under FilePress Sites.
  Helm h
record_status: active
created_at: 2026-09-21T21:50:00Z
updated_at: 2026-09-21T21:50:00Z
recorded_by:
  id: migration-import
  type: import
visibility: internal
relations: []
claims: []
data:
  context: Imported from workflow tracking gotchas[].
  problem: Adding a folder to the Helm fleet does not list it under FilePress
    Sites. Helm had no Add sites control.
  resolution: FilePress plugin gained scan/enroll. Helm Add sites uses that. Live
    fleet enroll also asks FilePress to list sites under the new folders.
  limits: Imported as a historical assertion. Verification was not recorded.
  generalization_status: observed
---


