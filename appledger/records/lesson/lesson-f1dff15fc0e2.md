---
format_version: 0.1.0
id: lesson-f1dff15fc0e2
kind: lesson
title: VisitorFace imported visitorOpenHref from visitorTiles.ts, which also
  imported n
record_status: active
created_at: 2026-08-28T03:55:00Z
updated_at: 2026-08-28T03:55:00Z
recorded_by:
  id: migration-import
  type: import
visibility: internal
relations: []
claims: []
data:
  context: Imported from workflow tracking gotchas[].
  problem: VisitorFace imported visitorOpenHref from visitorTiles.ts, which also
    imported node:os. Vite externalized os and the browser threw Cannot access
    node:os.hostname; HMR then forced a full reload.
  resolution: Split hostname/NIC listing into visitorMachine.ts (server only).
    Client uses visitorHttpUrl from loopback.ts.
  limits: Imported as a historical assertion. Verification was not recorded.
  generalization_status: observed
---


