---
title: Dashboard
---

```bash
localhelm serve
localhelm serve --host 127.0.0.1 --port 4321
```

Default bind is **all interfaces** on **4321**. `--host` / `--hosts` (Vite-style, with or without an address) also means all interfaces. `--host 127.0.0.1` stays loopback-only. The checkout dashboard (`app/`) calls the same library as the CLI.

The phone on a LAN/Tailscale Host is the **visitor** face: tiles for listening sites past loopback. Tap a tile to open it on that same host. The operator board (Today / Fleet / writes) stays on loopback. Write APIs stay loopback-only.

## Tabs

| Tab | What it is |
| --- | --- |
| Today | Needs you (writes), Looks (Ports facts), Sites and Ports snapshots |
| Fleet | Enrolled repos: version, git, pins, the same writes as Today |
| Sites | FilePress jobs if the filepress checkout is enrolled |
| Ports | LocalSlip leases if the localslip checkout is enrolled |

The same product can appear on three tabs. **Also on** chips jump and check that id.

## Writes

Click Push, Publish, Cut version, or Write pins. The modal is the plan. Confirm applies. Close leaves disk unchanged.

Publish OTP lives in the confirm modal. Never `--force`.
