# LocalHelm — Feature Backlog

Flat list until Phase 6. Seeded from `docs/PHASE_1_BRIEF.md` §11.

## M1 — Read-only fleet

- [x] Manifest `workspaceRoot: "."` + scan folder(s)
- [x] Enroll / unenroll plan then `--apply`
- [x] `status` and `deps` (local / npm / git) + JSON export
- [ ] Seed a real workspace fleet by hand (operator)

## M2 — Safe writes + dashboard

- [ ] `bump`
- [ ] `fetch` / `pull` (clean + behind only)
- [ ] Optional write of the JSON export file
- [ ] SvelteKit `app/` dashboard (`localhelm serve`) with scan/enroll checkboxes

## M3 — Cascade

- [ ] Plan/apply pin + lockfile at `^V`
- [ ] `link:` vs registry explicit
- [ ] Commit on apply (default on)
- [ ] `ready` list

## M4 — Compose + agents

- [ ] Optional LocalBerth lease / IngotVault column
- [ ] FilePress siblings deep-link (still separate)
- [ ] MCP for status / deps / plans

## Later

- [ ] Selected `origin` push with harsh confirm
- [ ] Optional publish action (never the first ship)
- [ ] FilePress `site/` + `/docs` on localhelm.dev
- [ ] Tag on bump
