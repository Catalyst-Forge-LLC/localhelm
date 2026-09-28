---
format_version: 0.1.0
id: lesson-b5a7067d10b7
kind: lesson
title: "ensure-lease localhelm-site --port 5188 failed: that port is already
  leased by d"
record_status: active
created_at: 2026-08-27T17:00:00Z
updated_at: 2026-08-27T17:00:00Z
recorded_by:
  id: migration-import
  type: import
visibility: internal
relations: []
claims: []
data:
  context: Imported from workflow tracking gotchas[].
  problem: "ensure-lease localhelm-site --port 5188 failed: that port is already
    leased by docupuncture-site. FilePress still listed the site as localhelm
    (repo folder). Ports never showed localhelm-site."
  resolution: Claim 5201. ensure-lease now passes --or-next. Sites open icon joins
    the listening *-site lease.
  limits: Imported as a historical assertion. Verification was not recorded.
  generalization_status: observed
---


