# LocalHelm — Project Context Prompt

_Locked brief: `docs/PHASE_1_BRIEF.md`. Tracking: `.forgetrail/workflow_tracking.json`._

## Tech Stack

- **App:** TypeScript ESM CLI (`src/`) + SvelteKit dashboard (`app/`) + later FilePress site (`site/` + `/docs`)
- **Language:** TypeScript strict, Node 22+
- **Package manager:** pnpm
- **Storage:** `localhelm.fleet.json` (`workspaceRoot: "."`) + `.localhelmignore` (scan) + `.localhelm/job.lock`. No PocketBase, no accounts, no telemetry.
- **AI/LLM:** none
- **Deploy:** npm `localhelm` (operator publishes). Site later at localhelm.dev
- **Key dependencies:** Node built-ins + TypeScript. No catalog adapter.

## Project Structure

```
src/lib/     fleet, scan, git, npm, pins, status, deps, bump, export, lock, cascade, ready
src/cli/     localhelm commands
bin/         localhelm.mjs → dist
app/         SvelteKit dashboard (checkout only; localhelm serve)
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
- DECIDED Phase 2: `push` is origin only, named ids on apply, dashboard confirm lists remotes. Never `--force`, never the backup remote. WHY: operator asked 2026-08-21; D13 later-milestone lifted.
- DECIDED Phase 2: `publish` is a named plan. Bump+commit if local is already on npm; push if origin is behind; then `npm publish --access public`. Named ids on apply. Never `--force`. WHY: operator asked 2026-08-23; publishing by hand had become a chore.
- DECIDED Phase 1: Cascade `^V`; commit on apply default on. WHY: house pins; operator said yes commit.
- DECIDED Phase 1: CLI + SvelteKit in `app/`; FilePress `site/` + `/docs`. WHY: operator 2026-08-20.
- DECIDED Phase 1: JSON in M1; MCP in M4.

## Critical Patterns

- Writes go through a printed plan; `--apply` is the confirm. No interactive prompts.
- Per-row errors (npm HTTP, unreadable package.json, missing path). Never fail the whole fleet for one cell.
- One npm request per distinct package name per run; cache in-process.
- `link:` / `file:` are never "on npm latest."
- Windows paths: store posix-ish relatives; resolve with `path`.
- Agents never run `npm publish` / `pnpm publish` / `localhelm publish --apply` unless the operator asked to apply a named package.

## Design Philosophy

- Safety over speed. Propose; confirm; then write.
- The CLI and JSON are the product. Dashboard calls the same library.

## Anti-Patterns to Avoid

- Baking `projects.js` or Catalyst Forge names into this package.
- Auto-enrolling a disk walk.
- Count-only failures with no stderr/reason.
- Force-pushing from the tool. Named `push` / `publish` are allowed after a plan.

## Current Feature State

### Complete

- M1 CLI: `scan`, `enroll`, `unenroll`, `status`, `deps` (+ `--json`)
- M2: `bump`, `fetch`, `pull`, `export`, job lock, SvelteKit `app/` + `localhelm serve`
- M3: `ready`, `cascade` (plan/apply `^V`, skip `link:`/`file:`, commit on apply)
- Plugin host: `localhelm.plugin.mjs` on an enrolled project. FilePress plugin lives in the filepress checkout and calls the sibling library (headers, link→npm, ship). You can run those jobs from LocalHelm instead of `pnpm siblings`.
- `push`: plan then named-id `--apply` to `origin` only. Dashboard confirm lists each remote. Never `--force`.
- `publish`: plan then named-id `--apply`. Detects npm’s `auth/cli` URL, opens the browser, and sends Enter. LastPass / passkey stay a human click. An npm automation token in the user `.npmrc` skips the browser. OTP is only for a numeric authenticator if npm asks.
- Dashboard confirms use a `<dialog>` modal (not `window.confirm`). FilePress board has Plan engine sync / Sync N for all sites. Header Plan push all plans every enrolled origin.

### In Progress

- Operator can try cascade on a published package (e.g. ollanet) after reading the plan

### Not Started

- M4 MCP

## Recent Changes

### Session 1 — 2026-08-20

- Genesis → locked brief. D9 no CF shelf. D10 localhelm.dev. Operator publishes.
- Phase 2: M1 CLI scaffolded.

### Session 2 — 2026-08-20

- M2 safe writes + loopback dashboard. Default port 54322. No publish, no force-push.

### Session 3 — 2026-08-20

- M3 cascade + ready. Target is published npm V as `^V`. Dirty and local-link rows skip with a reason. Default commit `Helm: retarget <pkg> to <version>.`

### Session 4 — 2026-08-21

- Selected `origin` push. CLI: `localhelm push <id>... --apply`. Dashboard: Plan push, then confirm listing remotes. Never `--force`.

### Session 5 — 2026-08-23

- Plan/apply `publish`: bump and push only when needed, then `npm publish`. Named ids, confirm lists the registry version. Never `--force`.
- Dashboard: `<dialog>` confirm modal (exec-foundry style). Plan engine sync for all FilePress sites. Plan push all / Plan publish all.
