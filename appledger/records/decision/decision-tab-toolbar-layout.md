---
format_version: 0.1.0
id: decision-tab-toolbar-layout
kind: decision
title: Tab actions share a right-aligned toolbar and compact overflow
record_status: active
created_at: 2026-10-06T11:21:22Z
updated_at: 2026-10-06T11:21:22Z
recorded_by:
  id: codex
  type: agent
visibility: internal
relations: []
claims: []
data:
  status: accepted
  choice: Fleet, plugin boards, and Ports share one right-aligned action row
    with consistent button heights. Below 55rem, bulk actions move into More.
    Today uses the same compact overflow pattern for its bulk action groups.
    Groups and More menus are positioned within the viewport, open above when
    appropriate, and scroll when the available vertical space is limited.
    Panels and grid tracks can shrink so wide tables scroll inside their panel.
  rationale: The operator reported Fleet actions wrapping awkwardly and a
    dropdown clipped off screen, and requested consistency between tabs.
  alternatives: []
  authority: operator
---

Verified the live dashboard at 1280px and 390px: the Fleet bulk action row fits
on desktop; Fleet, FilePress Sites, and Ports keep compact right-aligned rows
with selection actions in More at phone width. Checked Today compact controls
and dropdown bounds. Dashboard build passed. Svelte checking remains blocked
by the existing portLookCards declaration-order errors and empty Today block.
No phase transition or application write action was performed.
