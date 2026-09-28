---
format_version: 0.1.0
id: lesson-e6323aa50fe1
kind: lesson
title: app/src/lib/scan.ts re-export collided with src/lib/scan.ts. Vite loaded
  the Nod
record_status: active
created_at: 2026-09-15T18:27:00Z
updated_at: 2026-09-15T18:27:00Z
recorded_by:
  id: migration-import
  type: import
visibility: internal
relations: []
claims: []
data:
  context: Imported from workflow tracking gotchas[].
  problem: app/src/lib/scan.ts re-export collided with src/lib/scan.ts. Vite
    loaded the Node walker (paths.ts → node:os.homedir) into the dashboard
    client and HMR failed.
  resolution: Browser helper is $lib/scanPaths → src/lib/scanPaths.ts only. Do not
    name a Svelte $lib shim the same as a Node module in src/lib.
  limits: Imported as a historical assertion. Verification was not recorded.
  generalization_status: observed
---


