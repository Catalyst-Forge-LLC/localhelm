---
format_version: 0.1.0
id: decision-headline-run-commit-ship-20261028
kind: decision
title: Public headline is “Run, commit, and ship every project from one board.”
record_status: active
created_at: 2026-10-29T02:30:00Z
updated_at: 2026-10-29T02:30:00Z
recorded_by: { id: cursor, type: agent }
visibility: internal
relations: []
claims: []
data:
  status: accepted
  authority: user
  choice: Headline is “Run, commit, and ship every project from one board.” The
    slogan is “Local command center for your projects,” which fits the helm
    concept. Copy leads with running apps locally. npm publish and site deploys
    are supported for projects that go out, not implied for every project.
  rationale: The operator said “See which projects need your attention” describes
    only the read side. LocalHelm also runs dev servers, commits, pushes, bumps,
    publishes to npm, updates dependents, and deploys sites in batches. Many
    projects are only run and committed locally and never ship.
  alternatives:
    - “From uncommitted to shipped, across every repo.” (skips local-only use)
    - “Commit, publish, and ship all your projects from one board.” (skips running)
    - “Twenty repos. One release run.”
    - “Steer every repo from one wheel.”
---

Replaces the slogan in decision-6440d8938e87 (“Control panel for local
development”). Its point still holds: the board includes local-only tools that
never publish.

Applies to the site hero and meta, CLI usage line, docs introduction, about page, README lead, package description, and the
Catalyst Forge shelf entry. Copy checks keep facts and links, not the headline
wording.
