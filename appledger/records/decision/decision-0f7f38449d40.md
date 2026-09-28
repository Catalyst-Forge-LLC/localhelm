---
format_version: 0.1.0
id: decision-0f7f38449d40
kind: decision
title: Install/Update global is a separate write (pnpm add -g name@version, npm
  if pnpm
record_status: active
created_at: 2026-09-11T03:50:00Z
updated_at: 2026-09-11T03:50:00Z
recorded_by:
  id: migration-import
  type: import
visibility: internal
relations: []
claims: []
data:
  status: accepted
  choice: Install/Update global is a separate write (pnpm add -g name@version, npm
    if pnpm is missing). Show it when package.json has a bin and this machine is
    missing or behind. After a successful laptop npm publish, confirm offers
    that version. Skip the prompt for GitHub-OIDC-only publishes. Named ids on
    apply. Never --force. Not a gold Today need and not a step inside the
    publish pipeline.
  rationale: Imported from workflow tracking. Verification was not recorded.
  alternatives: []
  authority: import
---


