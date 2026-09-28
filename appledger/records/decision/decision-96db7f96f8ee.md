---
format_version: 0.1.0
id: decision-96db7f96f8ee
kind: decision
title: job.lock is stolen when the recorded pid is gone. Serve clears a leftover
  lock o
record_status: active
created_at: 2026-09-14T13:55:00Z
updated_at: 2026-09-14T13:55:00Z
recorded_by:
  id: migration-import
  type: import
visibility: internal
relations: []
claims: []
data:
  status: accepted
  choice: "job.lock is stolen when the recorded pid is gone. Serve clears a
    leftover lock on start. A live holder is named in the error. Multi-id
    confirms offer Stop: finish the current id, do not start the rest. Never
    --force. Do not abort an in-flight npm/ship."
  rationale: Imported from workflow tracking. Verification was not recorded.
  alternatives: []
  authority: import
---


