---
format_version: 0.1.0
id: evidence-compact-actions-20261015
kind: evidence
title: Keep next actions visible and version choices intact
record_status: active
created_at: 2026-10-15T04:35:00Z
updated_at: 2026-10-15T04:35:00Z
recorded_by: { id: codex, type: agent }
visibility: internal
relations: []
claims: []
data:
  evidence_kind: test_run
  repository_id: repo-home
  source: docs/specs/ux-friction-packets.md
  checked_at: 2026-10-15T04:35:00Z
  result: 25 focused tests pass; library/dashboard builds and Svelte check pass; synthetic 60-project long-name Fleet, manual minor bump plan, Publish major replan and keyboard More focus return pass.
  limitations:
    - Browser subjects and API results are synthetic; no real version write, publication, push or deployment.
    - No measured usability improvement is claimed.
---

The rendered prototype established that manual Bump remained available in More
before the duplicate column was removed. The final mobile layout places next
actions below identity; detailed versions/Git/pins remain horizontally scrollable.
Desktop keeps one emphasized next action per row. Patch/minor/major choices are
available in manual Bump and Publish, including individual choices in batch plans.
Apply uses the version choice from the confirmed plan.

Screenshots under .localhelm/friction-qa include fleet-actions-prototype.png,
fleet-actions-mobile.png and publish-version-desktop.png. Final mobile and Publish
screens were visually inspected. Full seven-view desktop/mobile and Deck checks
also pass in packet-c-browser.log. Action meanings are shared by Fleet, Today help
and CLI help. No phase transition or push.
