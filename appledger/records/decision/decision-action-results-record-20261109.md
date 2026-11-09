---
format_version: 0.1.0
id: decision-action-results-record-20261109
kind: decision
title: Action results are a record, never a gate
record_status: active
created_at: 2026-11-09T20:45:00Z
updated_at: 2026-11-09T20:45:00Z
recorded_by: { id: cursor, type: agent }
visibility: internal
relations: []
claims: []
data:
  status: accepted
  authority: user
  choice: Saved action results never stop a new action. The newest 50 are kept
    and older ones drop off. Marking a result reviewed is optional, needs no
    status refresh, and can be done for all at once. A result that cannot be
    saved is reported and the action still runs.
  rationale: The operator was blocked from every write by “Review the 50
    unfinished actions before starting another” and did not know review was
    required. Each action already plans from current status before confirm, so
    an old result cannot cause a repeated write.
  alternatives:
    - Remove saved action results entirely.
    - Keep required review, raise the limit, and add “mark all reviewed”.
---

Narrows decision-durable-workspace-results-20261015: results are still kept
separately from Activity and never store OTPs or write payloads. “Open a fresh
plan” from a saved result still asks for a status refresh first.

An update that names no dependent to write is no longer saved as unknown.
