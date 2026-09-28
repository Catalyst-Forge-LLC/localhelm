---
format_version: 0.1.0
id: decision-48ec5f691a39
kind: decision
title: The xFacts board always shows five label columns (app, tool, skill,
  agent, model
record_status: active
created_at: 2026-09-05T03:20:00Z
updated_at: 2026-09-05T03:20:00Z
recorded_by:
  id: migration-import
  type: import
visibility: internal
relations: []
claims: []
data:
  status: accepted
  choice: The xFacts board always shows five label columns (app, tool, skill,
    agent, model). The app cell is the product name with its /v link. Helm hides
    only name and status (status stays a problem chip). The bridge walks the
    repo for every *_FACTS.md kind. SKILL.md packs are not SkillFacts. Add
    labels still writes AppFacts only. “no label” means no facts files at all.
  rationale: Imported from workflow tracking. Verification was not recorded.
  alternatives: []
  authority: import
---


