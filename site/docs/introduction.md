---
title: Introduction
---

**LocalHelm** is the control panel for local development. Fleet, sites, and ports — including tools that never ship.

**LocalSlip** is the slip; **LocalHelm** is the wheel.

You have a folder of repos. `git status` in one of them answers that repo. The board is also for local tools that never publish: sites, ports, and the phone tile grid.

Name the fleet. Scan a folder, check the ones you keep, then read git, npm, dependents, and listening leases in one place.

## What it is

- A fleet file (`localhelm.fleet.json`) you chose — not an auto-enrolled disk walk
- `localhelm status` for local version, npm latest, git, and pins
- Writes print a plan; `--apply` is the confirm. Never `--force`
- A dashboard on **4321** (`localhelm serve`) that calls the same library

It is **not** a lease kernel. It does not claim ports. Start/stop on the board asks LocalSlip. It does not bake in a shop catalog.

## Two surfaces

| Surface | What it is |
| --- | --- |
| [localhelm.dev](https://localhelm.dev) | This site: what it is and how to use it |
| npm `localhelm` | The CLI and dashboard, on your machine |

The domain never serves your fleet.

## Next

- [Install](/docs/install) — npm or a checkout
- [Quick start](/docs/quick-start) — scan, enroll, status, serve
- [Commands](/docs/commands) — full reference
