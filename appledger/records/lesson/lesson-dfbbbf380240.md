---
format_version: 0.1.0
id: lesson-dfbbbf380240
kind: lesson
title: npm can take seconds to a minute after publish before name@version is
  fetchable.
record_status: active
created_at: 2026-09-11T11:10:00Z
updated_at: 2026-09-11T11:10:00Z
recorded_by:
  id: migration-import
  type: import
visibility: internal
relations: []
claims: []
data:
  context: Imported from workflow tracking gotchas[].
  problem: npm can take seconds to a minute after publish before name@version is
    fetchable. Immediate pnpm add -g then 404s or looks like it failed.
  resolution: Probe the version document first. Dashboard offers Wait or Try
    again. CLI --apply polls up to 90s.
  limits: Imported as a historical assertion. Verification was not recorded.
  generalization_status: observed
---


