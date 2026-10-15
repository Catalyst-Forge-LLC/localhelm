---
format_version: 0.1.0
id: decision-verified-releases-20261014
kind: decision
title: Publish the exact verified npm archive
record_status: active
created_at: 2026-10-15T03:59:00Z
updated_at: 2026-10-15T03:59:00Z
recorded_by: { id: codex, type: agent }
visibility: internal
relations: []
claims: []
data:
  status: accepted
  choice: Resolve explicit release sources, pack and inspect before pushing, then publish the same archive bytes.
  rationale: A version comparison cannot detect a missing executable or generated development harness target.
  alternatives:
    - Trust version-only status and directory publication.
  authority: user
---

The user authorized the UX packets after publishing UXcalibur. Optional checked-in
release configuration separates public distribution from the enrolled checkout.
Libraries need no executable. GitHub workflows own their release verification.
No phase transition or real external write is authorized by these checks.
