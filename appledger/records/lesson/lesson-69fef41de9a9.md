---
format_version: 0.1.0
id: lesson-69fef41de9a9
kind: lesson
title: npmjs.com does not load relative README images from the tarball. GitHub
  is priva
record_status: active
created_at: 2026-08-20T20:50:00Z
updated_at: 2026-08-20T20:50:00Z
recorded_by:
  id: migration-import
  type: import
visibility: internal
relations: []
claims: []
data:
  context: Imported from workflow tracking gotchas[].
  problem: npmjs.com does not load relative README images from the tarball. GitHub
    is private, so raw.githubusercontent.com 404s even when site/static/logo.png
    is in files.
  resolution: Keep logo in files. Point README at
    https://unpkg.com/localhelm/site/static/logo.png. Do not put the AppFacts
    hash URL under a Nutrition label heading — npm strips it and leaves an empty
    heading.
  limits: Imported as a historical assertion. Verification was not recorded.
  generalization_status: observed
---


