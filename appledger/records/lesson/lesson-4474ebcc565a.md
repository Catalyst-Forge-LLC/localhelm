---
format_version: 0.1.0
id: lesson-4474ebcc565a
kind: lesson
title: "findManifest walked forever on Windows: toPosix flipped Z: and Z:/ so
  parent nev"
record_status: active
created_at: 2026-08-20T19:05:00Z
updated_at: 2026-08-20T19:05:00Z
recorded_by:
  id: migration-import
  type: import
visibility: internal
relations: []
claims: []
data:
  context: Imported from workflow tracking gotchas[].
  problem: "findManifest walked forever on Windows: toPosix flipped Z: and Z:/ so
    parent never equaled dir. enroll appeared to hang."
  resolution: Normalize drive roots as X:/, stop walk-up at isFsRoot, cap iterations at 64.
  limits: Imported as a historical assertion. Verification was not recorded.
  generalization_status: observed
---


