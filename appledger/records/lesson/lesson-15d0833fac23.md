---
format_version: 0.1.0
id: lesson-15d0833fac23
kind: lesson
title: Land localslip sync engine failed ERR_PNPM_UNEXPECTED_VIRTUAL_STORE.
  site/node_m
record_status: active
created_at: 2026-09-15T00:10:00Z
updated_at: 2026-09-15T00:10:00Z
recorded_by:
  id: migration-import
  type: import
visibility: internal
relations: []
claims: []
data:
  context: Imported from workflow tracking gotchas[].
  problem: Land localslip sync engine failed ERR_PNPM_UNEXPECTED_VIRTUAL_STORE.
    site/node_modules/.modules.yaml still pointed at Z:\workspace\localberth
    after the rename.
  resolution: Reinstalled localslip/site. FilePress applyUpdate reinstalls when
    virtualStoreDir is stale, then retries pnpm update. Not a Helm path
    allowlist.
  limits: Imported as a historical assertion. Verification was not recorded.
  generalization_status: observed
---


