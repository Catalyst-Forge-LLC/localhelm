---
format_version: 0.1.0
id: lesson-3b85f37318bc
kind: lesson
title: Publishing localhelm from the same checkout that is serving runs app
  build. Vite
record_status: active
created_at: 2026-09-14T18:15:00Z
updated_at: 2026-09-14T18:15:00Z
recorded_by:
  id: migration-import
  type: import
visibility: internal
relations: []
claims: []
data:
  context: Imported from workflow tracking gotchas[].
  problem: Publishing localhelm from the same checkout that is serving runs app
    build. Vite saw .svelte-kit/generated change and full-reloaded. The
    in-memory confirm (and remaining GitHub links) vanished. Activity had only
    the plan, no apply note.
  resolution: Ignore generated/dashboard/dist in Vite watch. Persist each publish
    id. Restore the result modal on load. Continue the batch after a per-id
    failure.
  limits: Imported as a historical assertion. Verification was not recorded.
  generalization_status: observed
---


