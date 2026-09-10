---
title: Dashboard
---

```bash
localhelm serve
localhelm serve --host 127.0.0.1 --port 4321
```

Default bind is **all interfaces** on **4321**. `--host` / `--hosts` (Vite-style, with or without an address) also means all interfaces. `--host 127.0.0.1` stays loopback-only. The checkout dashboard (`app/`) calls the same library as the CLI.

A phone on LAN or Tailscale opens the **Deck** (`/deck`): tiles for listening leases the phone can reach. Tap a tile to open it on that host. From the operator board, menu **Deck** is the same page. `/visitor` still redirects there. Write APIs stay on loopback.

## Tabs

| Tab | What it is |
| --- | --- |
| Today | Needs you (writes), Looks (Ports facts), Sites and Ports snapshots |
| Fleet | Enrolled repos: version, git, pins, the same writes as Today |
| Sites | FilePress jobs, if a FilePress site is enrolled |
| Ports | [LocalSlip](https://localslip.dev) leases, if enrolled |

The same product can appear on three tabs. **Also on** chips jump and check that id.

## Reads versus writes

Header **Refresh** re-reads enrolled projects, Sites, and Ports. Row refresh is the same for one id. **Fetch remotes** runs `git fetch` and clears the five-minute npm cache. Those are observations plus a remote update. They do not publish.

Start and stop on Ports ask LocalSlip. Push, Publish, Write pins, enroll, and plugin jobs open a plan modal. Confirm applies. Close leaves disk unchanged. Publish covers both an already-bumped version and a bump plus npm when origin has commits since the last published version.

Publish OTP lives in the confirm modal. Never `--force`.

## Stale and unavailable

If a remote cannot be read, the board says ahead and behind counts may be stale. Local dirty and version cells stay from this machine. An npm fetch error is an error, not a clean match. Empty Sites or Ports means that plugin or LocalSlip is not in play, not that those systems are healthy.
