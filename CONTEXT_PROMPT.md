# LocalHelm — Project Context Prompt

_Locked brief: `docs/PHASE_1_BRIEF.md`. Tracking: `.forgetrail/workflow_tracking.json`._

## Tech Stack

- **App:** TypeScript ESM CLI (`src/`) + SvelteKit dashboard (`app/`) + later FilePress site (`site/` + `/docs`)
- **Language:** TypeScript strict, Node 22+
- **Package manager:** pnpm
- **Storage:** `localhelm.fleet.json` (`workspaceRoot: "."`) + `.localhelmignore` (scan) + `.localhelm/job.lock` + `.localhelm/activity.json` (dashboard log, gitignored). No PocketBase, no accounts, no telemetry.
- **AI/LLM:** none
- **Deploy:** npm `localhelm` (operator publishes). Site later at localhelm.dev
- **Key dependencies:** Node built-ins + TypeScript. No catalog adapter.

## Project Structure

```
src/lib/     fleet, scan, git, npm, pins, status, deps, bump, export, lock, cascade, ready, activity
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
- Plugin host: `localhelm.plugin.mjs` on an enrolled project. FilePress plugin lives in the filepress checkout (Sites). LocalBerth plugin lives in the localberth checkout (Ports tab) and calls the sibling board. Do not reimplement leases, observe, or firewall. Site push is `git push origin <branch>` only — never `--force`. Plugin actions may set `icon` (Lucide); LocalHelm falls back by action id (`sync` / `push` / `ship` / `start` / `stop`).
- `push`: plan then named-id `--apply` to `origin` only. Dashboard confirm lists each remote. Never `--force`. Ahead commits push even if the working tree is dirty; uncommitted files stay local. Pull, publish, and cascade still skip dirty trees.
- `publish`: plan then named-id `--apply`. Intended auth is `localhelm auth` + a granular automation token (Bypass 2FA) in the **user** `~/.npmrc`. That still publishes through ~Jan 2027; npm is moving to trusted/staged publish after that. Never store the token in this repo.
- Dashboard writes are one button: click Push / Publish / Sync / Bump / etc., the modal shows the plan, then Confirm applies or Close if nothing to do. CLI still prints a plan and needs `--apply`. Today shows one gold write per need (Push, Publish, or Write pins) only when the plan would actually write. Cut version is the extra when you want a new npm cut. Publish OTP lives in the confirm modal. Fleet publish/push are toolbar + checked rows; per-row Bump stays. Write pins is only offered when a clean consumer has a registry pin behind — not for `link:`/`file:` or dirty dependents.
- Dashboard IA: **Today** (default, needs-you + FilePress + Ports snapshots), **Fleet** (table + enroll), **Sites** (FilePress plugin), **Ports** (LocalBerth plugin). Header and tabs stay pinned; each tab pane scrolls in the remaining viewport. Activity is a right drawer (Escape / Close) persisted at `.localhelm/activity.json`. No second ship list. FilePress site names that match a fleet id are labeled as sites, not packages. Plugin apply only offers write ids when the plan marks `writes: true`. Fleet and Sites checkboxes drive bulk bump/push/remove and plugin jobs; each still plans, then confirms. Ports hosts LocalBerth Start/Stop on named leases (default `pnpm serve`, detached). A missing recipe can be guessed from a sibling folder and saved on confirm. Observed stays read-only. Claim/release stay on `localberth`.
- Dashboard URL state (Exec Foundry pattern): `replaceState` only — never push history for UI. Query params on `/`: `tab` (omit `today`), `ports` (omit `leases` for the subtab), `activity=1` when the drawer is open, `fleet` / `sites` / `leases` as CSV checked ids. Defaults omitted so URLs stay short. npm whoami stays in `sessionStorage` only. One-time migrate from old `sessionStorage` tab/pane/activity keys, then clear those keys.

### In Progress

- Operator can try cascade on a published package (e.g. ollanet) after reading the plan

### Not Started

- M4 MCP

## Recent Changes

### Session 1 — 2026-08-20

- Genesis → locked brief. D9 no CF shelf. D10 localhelm.dev. Operator publishes.
- Phase 2: M1 CLI scaffolded.

### Session 2 — 2026-08-20

- M2 safe writes + loopback dashboard. Default port 4321. No publish, no force-push.

### Session 3 — 2026-08-20

- M3 cascade + ready. Target is published npm V as `^V`. Dirty and local-link rows skip with a reason. Default commit `Helm: retarget <pkg> to <version>.`

### Session 4 — 2026-08-21

- Selected `origin` push. CLI: `localhelm push <id>... --apply`. Dashboard: Push opens a plan modal listing remotes. Never `--force`.

### Session 5 — 2026-08-23

- Plan/apply `publish`: bump and push only when needed, then `npm publish`. Named ids, confirm lists the registry version. Never `--force`.
- Dashboard: `<dialog>` confirm modal (exec-foundry style). Plan engine sync for all FilePress sites. Plan push all / Plan publish all.

### Session 6 — 2026-08-23

- Dashboard UX: Today / Fleet / Sites tabs, lighter panels, ship+cascade only on rows that need them.

### Session 7 — 2026-08-23

- Dashboard writes collapsed to one action button. The modal is the plan: confirm to apply, or Close when nothing to do. Same idea on the FilePress sibling toolbar (Apply/Ship plan first, then confirm).

### Session 8 — 2026-08-23

- After a successful publish, `/latest` can still show the old version. Status now checks whether the local version exists on the registry before calling it unpublished. A publish plan that bumps says it is cutting a new version.

### Session 9 — 2026-08-23

- Fleet and Sites checkboxes run the same write jobs as the row buttons (bump/push/remove; sync/push/ship). Select-all is in the table header. Publish stays on Today.

### Session 10 — 2026-08-23

- Activity is written to `.localhelm/activity.json` (gitignored, next to the job lock). Refresh reloads it. Clear deletes the file.

### Session 11 — 2026-08-23

- Ports tab hosts the LocalBerth plugin (leases + observed + Open + Start/Stop). Same board as `localberth serve`, not under Sites. Claim/release stay on the LocalBerth CLI.

### Session 12 — 2026-08-23

- Today: one gold write per need. Cut version is the extra. Publish OTP moved into the confirm modal. Fleet row Push/Publish dropped (toolbar + checks). Header reads are Refresh and Fetch remotes.
- Status must finish before Today says the fleet is quiet or the header says there is no fleet. Sites and Ports wait too — they say “Reading…” instead of “plugin not loaded” while status is in flight. npm whoami rides with `/api/status` and is remembered if a later check flakes.
- Activity is a header icon (Lucide `scroll-text`), not a tab. Same Iconify + Lucide offline set as Exec Foundry. Tabs and write buttons carry icons too.

### Session 13 — 2026-08-23

- Push of commits that are already ahead no longer waits for a clean tree. Dirty files stay local. Pull / publish / cascade still skip dirty.
- Today / Fleet write buttons share the same skip reasons as the plan (`whyNotPush` / `whyNotPublish`). Gold Publish is hidden when dirty, diverged, or missing origin/upstream. Write pins is hidden when the only dependents are local links or dirty.
- Today does not repeat the ahead count in the subtitle and badge when a Push button already has it. A failed push puts a short reason on the banner (SSH publickey → "origin rejected the SSH key"). Operator 2026-08-23: set fleet `origin` remotes to HTTPS (`github.com` and `github-acmegeek` aliases). Backup/archive remotes unchanged. anticonfab still has no origin.
- **Land** (Sites + Today site cards, CLI `localhelm land <site-id>`): one confirm for needed engine package writes (`filepress`), matching fleet package (`aibreze-site` → `aibreze`), then FilePress Sync → Push → Ship. Only already-needed writes. Stop on first failure. Publish OTP when a publish step is included. Never `--force`. Ship is skipped when the site tree fingerprint matches `.localhelm/land-ships.json` (recorded after a successful Land or Sites Ship). Land plan uses a one-pass FilePress `land` plan and status only for the engine/companion ids.

### Session 14 — 2026-08-24

- Dashboard tab / Ports pane / Activity / Fleet and Sites checks live in the URL (`replaceState`, defaults omitted).

### Session 15 — 2026-08-24

- Ports Start/Stop: LocalBerth starts/stops a stored recipe (`pnpm serve` by default) detached. LocalHelm only hosts the plan/confirm buttons. Observed stays read-only. Claim/release stay on `localberth`. Checked leases persist as `?leases=`. Confirm lines show the recipe command, not `start start …`. A `-api` lease with no folder of that name guesses the package folder and `pnpm start` (dictawhisper-api → dictawhisper). Hyphenless lease names match hyphenated folders (`temperpass-site` → `temper-pass`). `start` sets `PORT` to that lease — dictawhisper `serve` must not let the UI port (7777) become the API (8008).
- Cheap surfaces (draft): `docs/specs/cheap-surfaces.md`. H1 landed: family stacks on Today/Ports, look cards (no recipe, missing cwd, family split, enroll vs slip), `PORT`/`HOST` on Start confirm. Brief / archive / family start still unscheduled.
- Confirm dismisses as soon as you say yes. The header keeps “Working…” while start/stop finishes. The dialog must not pin itself open just because a write is still in flight.

### Session 16 — 2026-08-25

- H1: Today groups lease/fleet stacks (UI / API / site listen bits). Look cards are facts, not gold writes. Ports Start confirm prints `PORT` and `HOST`.
