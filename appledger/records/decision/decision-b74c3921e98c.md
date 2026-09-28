---
format_version: 0.1.0
id: decision-b74c3921e98c
kind: decision
title: applyBump skips SkillFacts under gitignored paths (git check-ignore).
  commitPath
record_status: active
created_at: 2026-09-15T02:40:00Z
updated_at: 2026-09-15T02:40:00Z
recorded_by:
  id: migration-import
  type: import
visibility: internal
relations: []
claims: []
data:
  status: accepted
  choice: applyBump skips SkillFacts under gitignored paths (git check-ignore).
    commitPaths also drops ignored paths. listFactsFiles skips build and
    FilePress site output dirs. Publish no longer fails when FilePress copies
    skills into site/build or site/static/skills.
  rationale: Imported from workflow tracking. Verification was not recorded.
  alternatives: []
  authority: import
---


