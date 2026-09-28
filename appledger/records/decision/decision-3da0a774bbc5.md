---
format_version: 0.1.0
id: decision-3da0a774bbc5
kind: decision
title: writeGate.ts is a re-export barrel. plainError.ts holds stderr shorteners
  and la
record_status: active
created_at: 2026-09-15T00:50:00Z
updated_at: 2026-09-15T00:50:00Z
recorded_by:
  id: migration-import
  type: import
visibility: internal
relations: []
claims: []
data:
  status: accepted
  choice: writeGate.ts is a re-export barrel. plainError.ts holds stderr
    shorteners and landPluginApplyOk; publishResults.ts holds publish outcome
    copy; fleetWrites.ts holds gates, labels, global install copy, and pin
    helpers. No node:* in any of them. Existing writeGate imports stay.
  rationale: Imported from workflow tracking. Verification was not recorded.
  alternatives: []
  authority: import
---


