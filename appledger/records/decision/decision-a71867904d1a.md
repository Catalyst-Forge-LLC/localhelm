---
format_version: 0.1.0
id: decision-a71867904d1a
kind: decision
title: getClientAddress is wrapped. If Vite has no socket (dep optimize reload),
  operat
record_status: active
created_at: 2026-09-14T22:15:00Z
updated_at: 2026-09-14T22:15:00Z
recorded_by:
  id: migration-import
  type: import
visibility: internal
relations: []
claims: []
data:
  status: accepted
  choice: getClientAddress is wrapped. If Vite has no socket (dep optimize
    reload), operator APIs still allow a loopback Host only — never a LAN Host,
    never X-Forwarded-For. Windows serve spawns pnpm as one shell string so Node
    DEP0190 is not raised.
  rationale: Imported from workflow tracking. Verification was not recorded.
  alternatives: []
  authority: import
---


