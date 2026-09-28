---
format_version: 0.1.0
id: lesson-d83d2ccadc72
kind: lesson
title: "Aborting a checkout pnpm serve (Cursor background shell) left Vite
  listening on "
record_status: active
created_at: 2026-09-11T10:40:00Z
updated_at: 2026-09-11T10:40:00Z
recorded_by:
  id: migration-import
  type: import
visibility: internal
relations: []
claims: []
data:
  context: Imported from workflow tracking gotchas[].
  problem: Aborting a checkout pnpm serve (Cursor background shell) left Vite
    listening on 4321. localhelm serve then crashed with EADDRINUSE and no pid.
  resolution: Probe the port before spawn. Print the LISTENING pid and command.
    --free-port stops it. Never --force.
  limits: Imported as a historical assertion. Verification was not recorded.
  generalization_status: observed
---


