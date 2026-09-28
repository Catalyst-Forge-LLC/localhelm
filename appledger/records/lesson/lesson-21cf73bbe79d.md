---
format_version: 0.1.0
id: lesson-21cf73bbe79d
kind: lesson
title: Vite checkout SSR throws Could not determine clientAddress after
  optimized depen
record_status: active
created_at: 2026-09-14T22:15:00Z
updated_at: 2026-09-14T22:15:00Z
recorded_by:
  id: migration-import
  type: import
visibility: internal
relations: []
claims: []
data:
  context: Imported from workflow tracking gotchas[].
  problem: Vite checkout SSR throws Could not determine clientAddress after
    optimized dependencies changed. reloading. The operator hook did not catch
    it, so /api/status and /api/plugins 500ed.
  resolution: readClientAddress swallows the throw. Missing peer + loopback Host
    is still the operator face. LAN Host stays Deck-only.
  limits: Imported as a historical assertion. Verification was not recorded.
  generalization_status: observed
---


