# LocalHelm — Project Context Prompt

_Locked brief: `docs/PHASE_1_BRIEF.md`. Tracking: `.forgetrail/workflow_tracking.json`._

## Tech Stack

- **App:** TypeScript ESM CLI (`src/`) + later SvelteKit dashboard (`app/`) + later FilePress site (`site/` + `/docs`)
- **Language:** TypeScript strict, Node 22+
- **Package manager:** pnpm
- **Storage:** `localhelm.fleet.json` (`workspaceRoot: "."`) + `.localhelmignore` (scan) + gitignored job state later. No PocketBase, no accounts, no telemetry.
- **AI/LLM:** none
- **Deploy:** npm `localhelm` (operator publishes). Site later at localhelm.dev
- **Key dependencies:** Node built-ins + TypeScript. No catalog adapter.

## Project Structure

```
src/lib/     fleet, scan, git, npm, pins, status, deps
src/cli/     localhelm commands
bin/         localhelm.mjs → dist
app/         (M2) SvelteKit dashboard
site/        (later) FilePress + /docs
```

## Data Model

| Entity | Purpose | Key fields |
| --- | --- | --- |
| FleetManifest | Enrollment source of truth | workspaceRoot `.`, projects[] |
| FleetProject | One enrolled row | id, path, npm?, group? |
| ScanCandidate | Proposed, not enrolled | path, id, git, npmName, version |
| ProjectStatus | One status row | localVersion, npm, git, pins |
| PinEdge | Fleet graph edge | kind link/file/registry, onLatest |
| EnrollPlan | Dry-run write | rows add/skip, writes flag |

Hero: scan folder(s) → check/confirm enroll (`--apply`) → status / deps / JSON.

## Key Architectural Decisions

- DECIDED Phase 1: Public product CLI `localhelm`, never `helm`. WHY: name collisions; name reserved at 0.0.0.
- DECIDED Phase 1: No shop shelf. Export generic JSON. WHY: public package; CF may consume later.
- DECIDED Phase 1: Enroll is scan then confirm. WHY: fleet is chosen, not auto-enrolled.
- DECIDED Phase 2: `.localhelmignore` (gitignore syntax) plus `~/.localhelm/ignore`. WHY: operator asked; scan must skip sandbox/noise folders. Hard skips still: `node_modules`, dot-dirs, `__*`.
- DECIDED Phase 1: Apache-2.0. WHY: operator 2026-08-20.
- DECIDED Phase 1: No publish and no git push in v1. Publish is a future option. WHY: operator publishes.
- DECIDED Phase 1: Cascade `^V`; commit on apply default on. WHY: house pins; operator said yes commit.
- DECIDED Phase 1: CLI + SvelteKit in `app/`; FilePress `site/` + `/docs`. WHY: operator 2026-08-20.
- DECIDED Phase 1: JSON in M1; MCP in M4.

## Critical Patterns

- Writes go through a printed plan; `--apply` is the confirm. No interactive prompts.
- Per-row errors (npm HTTP, unreadable package.json, missing path). Never fail the whole fleet for one cell.
- One npm request per distinct package name per run; cache in-process.
- `link:` / `file:` are never "on npm latest."
- Windows paths: store posix-ish relatives; resolve with `path`.
- Agents never run `npm publish` / `pnpm publish`.

## Design Philosophy

- Safety over speed. Propose; confirm; then write.
- The CLI and JSON are the product. Dashboard calls the same library.

## Anti-Patterns to Avoid

- Baking `projects.js` or Catalyst Forge names into this package.
- Auto-enrolling a disk walk.
- Count-only failures with no stderr/reason.
- Publishing or force-pushing from the tool.

## Current Feature State

### Complete

- M1 CLI: `scan`, `enroll`, `unenroll`, `status`, `deps` (+ `--json`)

### In Progress

- Phase 2 spine just landed; operator should try scan/enroll on a real workspace

### Not Started

- M2 dashboard / bump / fetch-pull
- M3 cascade
- M4 MCP

## Recent Changes

### Session 1 — 2026-08-20

- Genesis → locked brief. D9 no CF shelf. D10 localhelm.dev. Operator publishes.
- Phase 2: M1 CLI scaffolded.
