---
format_version: 0.1.0
id: lesson-690ce853d7a4
kind: lesson
title: "pnpm ship died in filepress build: 404 /favicon.png (linked from /).
  site/static"
record_status: active
created_at: 2026-08-28T04:28:00Z
updated_at: 2026-08-28T04:28:00Z
recorded_by:
  id: migration-import
  type: import
visibility: internal
relations: []
claims: []
data:
  context: Imported from workflow tracking gotchas[].
  problem: "pnpm ship died in filepress build: 404 /favicon.png (linked from /).
    site/static had logo.png and favicon.svg only. getfilepress 0.1.18 always
    links the PNG."
  resolution: Add site/static/favicon.png (64×64 from logo.png). Engine
    handleHttpError will ignore missing favicons after the next getfilepress
    publish.
  limits: Imported as a historical assertion. Verification was not recorded.
  generalization_status: observed
---


