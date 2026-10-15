---
format_version: 0.1.0
id: evidence-remove-npm-private-20261014
kind: evidence
title: Inline npm private removal verified in isolated fixtures
record_status: active
created_at: 2026-10-15T02:01:08Z
updated_at: 2026-10-15T02:01:08Z
recorded_by:
  id: codex
  type: agent
visibility: internal
relations: []
claims: []
data:
  evidence_kind: test_run
  repository_id: repo-home
  source: src/lib/packagePrivacy.ts
  digest: 91895cce3d03c38473a1bae5f252e28839618dc1ffebad16863cc80332e9a975
  checked_at: 2026-10-15T02:01:08.968Z
  result: All 326 runtime tests passed. Runtime/dashboard builds passed and
    dashboard checking found zero errors. Browser QA verified the inline private
    link without added public-row controls, exact-target confirmation, Cancel,
    mobile apply, property removal, refreshed state, and repeat without writes.
  limitations:
    - Browser checks used synthetic temporary repositories and isolated Git/npm configuration.
    - Existing TodayBoard empty-block and Vite chunk-size warnings remain.
    - No existing project private flag, publication, push, deployment, or installed package was changed.
---

Core cases include read-only planning; first/middle/last/only property removal;
unchanged nested private fields, strings, CRLF, spacing, and unrelated files;
missing/false flags; malformed/non-object/non-boolean/duplicate manifests; changed
enrollment/content; and linked manifests. The confirmation test binds apply to
the displayed file and revision and requests a complete targeted npm/status refresh.

The built dashboard browser pass at 1440px and 390px exercised both private and
public rows. API checks rejected additions, missing targets, unknown IDs, stale
revisions, demo writes, and non-loopback Host requests. Screenshots of the compact
Fleet row and mobile confirmation were inspected. Receipt and screenshots are
under `.localhelm/package-privacy-qa/` (ignored, synthetic data).
