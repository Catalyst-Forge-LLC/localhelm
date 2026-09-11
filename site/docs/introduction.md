---
title: Introduction
---

**LocalHelm** is the control panel for local development. The local fleet is the apps and sites you keep, including tools that never publish. Ports sit on the same board when [LocalSlip](https://localslip.dev) is present.

You have a folder of repos. `git status` in one of them answers that repo. Scan, enroll, and `status` work with only LocalHelm installed.

## Observations versus writes

| Kind | Commands | What happens |
| --- | --- | --- |
| Observation | `scan`, `status`, `deps`, `ready`, `brief`, `plugins`, `auth` | Read disk, git, or npm. `scan` never writes |
| Remote refresh | `fetch` | `git fetch` on enrolled remotes. Clears a stale ahead/behind read |
| Plan, then write | `enroll`, `unenroll`, `bump`, `pull`, `push`, `export`, `publish`, `cascade`, `archive`, `plugin`, `land`, `ship`, `global` | Prints a plan. `--apply` writes. `publish`, `push`, `ship`, and `global` need named ids |

Passive inspection does not publish, bump, or repair projects. npm latest is a remote check with a five-minute cache, not a local file. Local dirty state is always from this machine.

## Stale versus unavailable

| What you see | Meaning |
| --- | --- |
| Clean local git / matching pins | Last successful local read |
| Dirty, unpublished-ahead, pin behind | Needs attention from local files |
| Ahead/behind after a fetch error | Stale remote counts. Local state below is still accurate |
| npm error or missing registry read | Unavailable remote check. Not proof that nothing needs work |
| Refresh | Re-reads enrolled projects. Fetch remotes also refreshes npm cache |

Failed remote checks are errors or stale warnings. They are not a green board.

## What it is

- A fleet file (`localhelm.fleet.json`) you chose. Nothing auto-enrolls from a disk walk
- `localhelm status` for local version, npm latest, git, and pins
- Writes print a plan. `--apply` is the confirm. Never `--force`
- A dashboard on **4321** (`localhelm serve`) that calls the same library

It does not claim ports. Start and stop on the board ask [LocalSlip](https://localslip.dev). Sites jobs need a FilePress plugin. Those tabs stay empty without those tools.

## Two surfaces

| Surface | What it is |
| --- | --- |
| [localhelm.dev](https://localhelm.dev) | This site: what it is and how to use it |
| npm `localhelm` | The CLI and dashboard, on your machine |

The domain never serves your apps or sites.

## Next

- [Install](/docs/install): npm or a checkout
- [Quick start](/docs/quick-start): scan, enroll, status, serve
- [Commands](/docs/commands): full reference
