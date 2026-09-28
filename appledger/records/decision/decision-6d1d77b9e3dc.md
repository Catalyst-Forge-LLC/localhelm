---
format_version: 0.1.0
id: decision-6d1d77b9e3dc
kind: decision
title: Dashboard named applies (publish, Land, plugin jobs, pull, push, ship,
  commit, b
record_status: active
created_at: 2026-09-15T00:35:00Z
updated_at: 2026-09-15T00:35:00Z
recorded_by:
  id: migration-import
  type: import
visibility: internal
relations: []
claims: []
data:
  status: accepted
  choice: Dashboard named applies (publish, Land, plugin jobs, pull, push, ship,
    commit, bump) continue after one id fails. runNamedBatch honors Stop. CLI
    publish --apply continues and uses isPublishedReason (GitHub OIDC is
    success); exit 1 if any publish row failed. CLI land --apply still stops.
    Pin behind is cascade from the publisher; FilePress Land stays getfilepress
    sites only.
  rationale: Imported from workflow tracking. Verification was not recorded.
  alternatives: []
  authority: import
---


