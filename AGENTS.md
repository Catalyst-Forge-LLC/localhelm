<!--
  Agent protocol based on ForgeTrail Lite v2.0.0.
  © Catalyst Forge, LLC — www.catalystforge.com
  Licensed under Apache License 2.0 (upstream forge-kit repo).
-->

# Agent instructions for this repo

This repository uses **ForgeTrail**. The record is `appledger/`: the phase in `profiles/forgetrail.yaml`, and decisions and the session in `records/`.

## Non-negotiables

- **Phase gates:** wait for explicit user approval before advancing `currentPhase`.
- **Phase 1 before code:** do not write project code until `docs/PHASE_1_BRIEF.md` is **locked** and the operator says to start the spine.
- **Phase 2 = full runnable spine** in one pass (M1: scan folders → confirm enroll, status, deps, JSON).
- **Log decisions** as decision records in `appledger/records/`.
- **Git commits:** Always commit changes after each completed batch of work or specific change, without waiting for a separate request. Use clear, descriptive commit messages that explain the change. Stage only files belonging to that work. Use plain `-m` or `-F` only.
- **Lists:** numbered = order; bullets = parallel; letters = pick-one.
- **No interactive CLIs** without every flag.
- **Git pushes:** The operator handles pushes by default. Agents push only when the operator explicitly requests it; named pushes to `origin` require a plan. **Never** `git push --force`.
- **Agents** do not run `npm publish` / `pnpm publish` / `localhelm publish --apply` unless the operator explicitly asked to apply a named package. LocalHelm the tool may publish enrolled projects after a printed plan and `--apply`.

## Conventions

- Package manager: **pnpm**. Language: **TypeScript ESM**. Node **22+**. License **Apache-2.0**.
- Public name **LocalHelm**. CLI and npm package **`localhelm`**. Never ship a binary named `helm`.
- Pairing: **LocalSlip** is the slip (local DNS for ports); **LocalHelm** is the wheel / control panel. Helm’s **Deck** (`/deck`) is the phone tile grid of listening leases; `/visitor` redirects there. Claim/firewall stay on LocalSlip.
- Compose with IngotVault, LocalSlip (née LocalSlip), and FilePress siblings. Do not reimplement them.
- **No shop-specific shelf.** Do not read or write `catalyst-forge/src/lib/projects.js` or bake Catalyst Forge (or any other catalog) into this package. Export generic JSON; consumers adapt.

## Session start

1. Read `appledger/profiles/forgetrail.yaml`, the latest session record, `CONTEXT_PROMPT.md`, and `docs/PHASE_1_BRIEF.md`.
2. If Phase 1 is not locked, do not scaffold.
