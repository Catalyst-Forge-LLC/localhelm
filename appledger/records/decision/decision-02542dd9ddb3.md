---
format_version: 0.1.0
id: decision-02542dd9ddb3
kind: decision
title: Dashboard status reads use GET /api/status?progress=1 NDJSON. fleetStatus
  onProg
record_status: active
created_at: 2026-09-15T01:55:00Z
updated_at: 2026-09-15T01:55:00Z
recorded_by:
  id: migration-import
  type: import
visibility: internal
relations: []
claims: []
data:
  status: accepted
  choice: Dashboard status reads use GET /api/status?progress=1 NDJSON.
    fleetStatus onProgress emits packages, npm, git, and globals labels with
    (done of total). Refresh then awaits Sites and Ports. Unprefixed GET
    /api/status stays a single JSON body.
  rationale: Imported from workflow tracking. Verification was not recorded.
  alternatives: []
  authority: import
---


