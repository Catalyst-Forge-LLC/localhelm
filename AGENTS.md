<!--
  Agent protocol based on ForgeTrail Lite v2.0.0.
  © Catalyst Forge, LLC — www.catalystforge.com
  Licensed under Apache License 2.0 (upstream forge-kit repo).
-->

# Agent instructions for this repo

This repository uses **ForgeTrail Lite**. Full protocol: `.forgetrail/FORGETRAIL_LITE.md`. Current phase: `.forgetrail/workflow_tracking.json → currentPhase`.

## Non-negotiables

- **Phase gates:** wait for explicit user approval before advancing `currentPhase`.
- **Phase 1 before code:** do not write project code until `docs/PHASE_1_BRIEF.md` is **locked** and stack is agreed.
- **Phase 2 = full runnable spine** in one pass (M1 read-only fleet: manifest, discover/enroll, status, deps, JSON).
- **Log decisions** in `.forgetrail/workflow_tracking.json → decisions[]`.
- **Git commits:** plain `-m` or `-F` only; no unrequested attribution trailers.
- **Lists:** numbered = order; bullets = parallel; letters = pick-one.
- **No interactive CLIs** without every flag.
- **Never** `npm publish` / `pnpm publish` from LocalHelm itself. **Never** `git push --force`.
- **The operator always publishes to npm.** Agents do not run `npm publish` / `pnpm publish` in this repo (including the 0.0.0 name reservation). Prepare `package.json` and say when it is ready.

## Conventions

- Package manager: **pnpm**. Language: **TypeScript ESM**. Node **22+**. License **Apache-2.0**.
- Public name **LocalHelm**. CLI and npm package **`localhelm`**. Never ship a binary named `helm`.
- Pairing: **LocalBerth** is the slip; **LocalHelm** is the wheel.
- Compose with IngotVault, LocalBerth, and FilePress siblings. Do not reimplement them.

## Session start

1. Read `.forgetrail/workflow_tracking.json` and `docs/PHASE_1_BRIEF.md`.
2. If Phase 1 is not locked, do not scaffold.
