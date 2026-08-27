---
title: Introduction
---

**LocalHelm** is status for the products you ship. A named fleet of local repos: git, npm, and dependents.

**LocalSlip** is the slip; **LocalHelm** is the wheel.

You have a folder of repos. `git status` in one of them answers that repo. After a morning of publishes, the scarce resource is knowing which products are dirty, unpublished, or still pinned to last week’s package.

Name the fleet so that does not happen. Scan a folder, check the ones you ship, then read every ship surface in one place.

## What it is

- A fleet file (`localhelm.fleet.json`) you chose — not an auto-enrolled disk walk
- `localhelm status` for local version, npm latest, git, and pins
- Writes print a plan; `--apply` is the confirm. Never `--force`
- A dashboard on **4321** (`localhelm serve`) that calls the same library

It is **not** a process manager. It does not claim ports. It does not bake in a shop catalog.

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
