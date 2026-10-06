---
format_version: 0.1.0
id: decision-git-directory-trust-20261006
kind: decision
title: Confirm trust for one enrolled checkout when Git refuses ownership
record_status: active
created_at: 2026-10-06T12:02:15Z
updated_at: 2026-10-06T12:02:15Z
recorded_by:
  id: codex-localhelm
  type: agent
visibility: internal
relations: []
claims: []
data:
  status: accepted
  choice: Today and Fleet offer Trust this directory for Git's dubious-ownership
    error. A read-only plan shows the canonical checkout root; confirmation adds
    that exact directory to the running account's global safe.directory list and
    refreshes the row. Apply rechecks the enrollment, directory, and Git error.
  rationale: The operator resolved this error manually for UXcalibur and asked
    LocalHelm to provide a button that confirms in a modal and adds the directory.
    Unavailable Git status must not appear as nothing to do or All quiet.
  alternatives:
    - Require the operator to copy Git's suggested command into a terminal.
    - Automatically trust all workspace checkouts without confirmation.
  authority: user
---

The operator requested: “Maybe we could add a button to LocalHelm for that scenario? It confirms in a modal and adds the dir.”

The modal names the exact directory and account scope, explains that trust permits Git to read the repository and run its hooks, and states that Cancel makes no change. The directory comes from the enrolled folder and its nearest checkout root on disk, never an error-message path. No wildcard entries are accepted. Demo mode and the existing loopback operator API gate remain enforced.

Other Git errors show Git status unavailable and do not offer trust. This change does not address generated npm artifacts inside a private development harness. Build remains in progress; no phase transition or release is authorized by this request.
