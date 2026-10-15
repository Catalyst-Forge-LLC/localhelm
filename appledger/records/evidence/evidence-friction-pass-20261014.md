---
format_version: 0.1.0
id: evidence-friction-pass-20261014
kind: evidence
title: Verify LocalHelm guidance and recovery changes
record_status: active
created_at: 2026-10-15T03:11:56Z
updated_at: 2026-10-15T03:11:56Z
recorded_by:
  id: codex
  type: agent
visibility: internal
relations: []
claims: []
data:
  evidence_kind: test_run
  repository_id: repo-home
  source: docs/UX_REVIEW_2026-10-14.md
  checked_at: 2026-10-15T03:11:56Z
  result: 338 tests pass; library and dashboard builds pass; source and compiled CLI report the manifest version. Synthetic browser checks cover refresh ordering, interrupted streams, blocked releases, retained failed applies, activity isolation, keyboard scrolling, seven desktop/mobile views, and Deck.
  limitations:
    - Browser transport and subjects are synthetic; no live publisher, deployment, model call, service action, or label write was exercised.
    - Companion rendering does not establish actual companion command success.
    - No measured usability improvement is claimed.
---

Ignored receipts and screenshots: .localhelm/friction-qa/receipt.json and
.localhelm/friction-qa/*.png. Logs: .localhelm/friction-tests.log,
.localhelm/friction-check.log, and .localhelm/friction-build.log.
