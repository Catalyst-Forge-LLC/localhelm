---
format_version: 0.1.0
id: decision-remove-npm-private-20261014
kind: decision
title: Make the existing private marker a confirmed removal action
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
  status: accepted
  choice: Fleet's existing private text opens a plan and confirmation to remove
    private true from the enrolled package.json. Public rows have no new control.
    There is no add-private action. The edit stays local for review and commit;
    metadata and npm state refresh afterward.
  rationale: The owner requested removal through LocalHelm, then specified that
    separate on/off buttons cluttered the table and the private marker itself
    should be the link. npm publishability is independent of GitHub visibility.
  alternatives:
    - Add a separate publishing toggle to every row.
  authority: user
---

The owner specified: “Maybe make the 'private' be the link to remove it? We don't
need to add it.” The final implementation follows that scope, with the existing
confirmation modal. No existing package flag is changed merely by installing
this feature. Confirmation does not publish or commit. A separate generated npm
release still needs its own release-target integration.
