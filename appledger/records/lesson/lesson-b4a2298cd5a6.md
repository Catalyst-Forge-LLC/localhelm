---
format_version: 0.1.0
id: lesson-b4a2298cd5a6
kind: lesson
title: "Published 0.1.10 dashboard started, then GET / 500ed:
  @iconify-json/lucide was a"
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
  context: Imported from workflow tracking gotchas[].
  problem: "Published 0.1.10 dashboard started, then GET / 500ed:
    @iconify-json/lucide was an external SSR import. Global install has no app/
    deps."
  resolution: "vite ssr.noExternal: true. Test scans dashboard/ for bare npm imports."
  limits: Imported as a historical assertion. Verification was not recorded.
  generalization_status: observed
---


