---
format_version: 0.1.0
id: lesson-9c21b0911a0e
kind: lesson
title: Ctrl+C mid-publish leaves .localhelm/job.lock. The next write (or a
  dashboard ac
record_status: active
created_at: 2026-09-14T13:55:00Z
updated_at: 2026-09-14T13:55:00Z
recorded_by:
  id: migration-import
  type: import
visibility: internal
relations: []
claims: []
data:
  context: Imported from workflow tracking gotchas[].
  problem: Ctrl+C mid-publish leaves .localhelm/job.lock. The next write (or a
    dashboard action after serve) says another job holds the lock even though
    the process is gone. Confirm Cancel is also disabled while busy, so the only
    abort was killing serve.
  resolution: Steal the lock when the pid is dead. Serve clears leftovers.
    Multi-id confirms get Stop after the current item.
  limits: Imported as a historical assertion. Verification was not recorded.
  generalization_status: observed
---


