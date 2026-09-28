---
format_version: 0.1.0
id: lesson-ea9e05c40083
kind: lesson
title: Leftover vite dev process kept port 4321 bound after the parent serve was
  killed
record_status: active
created_at: 2026-08-20T20:12:00Z
updated_at: 2026-08-20T20:12:00Z
recorded_by:
  id: migration-import
  type: import
visibility: internal
relations: []
claims: []
data:
  context: Imported from workflow tracking gotchas[].
  problem: Leftover vite dev process kept port 4321 bound after the parent serve
    was killed, so the next localhelm serve failed with strictPort.
  resolution: Kill the whole tree (taskkill /T) or check the port owner before
    reserving; a LocalBerth lease avoids the collision.
  limits: Imported as a historical assertion. Verification was not recorded.
  generalization_status: observed
---


