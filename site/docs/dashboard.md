---
title: Dashboard
---

```bash
localhelm serve
localhelm serve --host 127.0.0.1 --port 4321
```

Default bind is **all interfaces** on **4321**. `--host` / `--hosts` (Vite-style, with or without an address) also means all interfaces. `--host 127.0.0.1` stays loopback-only. The checkout dashboard (`app/`) calls the same library as the CLI.

A phone on LAN or Tailscale opens **`/visitor`**: tiles for listening sites. Tap a tile to open it on that host. From the operator board, **Visitor** is the same page. Write APIs stay on loopback.

## Tabs

| Tab | What it is |
| --- | --- |
| Today | Needs you (writes), Looks (Ports facts), Sites and Ports snapshots |
| Fleet | Enrolled repos: version, git, pins, the same writes as Today |
| Sites | FilePress jobs, if a FilePress site is enrolled |
| Ports | [LocalSlip](https://localslip.dev) leases, if enrolled |

The same product can appear on three tabs. **Also on** chips jump and check that id.

## Writes

Click Push, Publish, Cut version, or Write pins. The modal is the plan. Confirm applies. Close leaves disk unchanged.

Publish OTP lives in the confirm modal. Never `--force`.
