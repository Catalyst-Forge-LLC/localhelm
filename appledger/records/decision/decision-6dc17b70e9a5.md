---
format_version: 0.1.0
id: decision-6dc17b70e9a5
kind: decision
title: adapter-node dashboard SSR uses Vite ssr.noExternal so a global install
  does not
record_status: active
created_at: 2026-09-11T10:46:00Z
updated_at: 2026-09-11T10:46:00Z
recorded_by:
  id: migration-import
  type: import
visibility: internal
relations: []
claims: []
data:
  status: accepted
  choice: adapter-node dashboard SSR uses Vite ssr.noExternal so a global install
    does not need app/ dependencies. A test fails the build if dashboard/ still
    has bare npm imports.
  rationale: Imported from workflow tracking. Verification was not recorded.
  alternatives: []
  authority: import
---


