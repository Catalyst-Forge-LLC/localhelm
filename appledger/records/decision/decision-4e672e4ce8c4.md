---
format_version: 0.1.0
id: decision-4e672e4ce8c4
kind: decision
title: LocalHelm gets a LocalSlip-style visitor tile face when the client is not
  on loo
record_status: active
created_at: 2026-08-28T03:40:00Z
updated_at: 2026-08-28T03:40:00Z
recorded_by:
  id: migration-import
  type: import
visibility: internal
relations: []
claims: []
data:
  status: accepted
  choice: LocalHelm gets a LocalSlip-style visitor tile face when the client is
    not on loopback Host. Tiles come from the Ports plugin (listening LAN
    leases). Open URLs rewrite onto the phone Host. Favicons are loaded by the
    phone from each app. Write /api routes stay loopback-only except GET
    /api/visitor. Do not fold peek, claim, or firewall into Helm.
  rationale: Imported from workflow tracking. Verification was not recorded.
  alternatives: []
  authority: import
---


