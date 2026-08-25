# LocalHelm — Feature Backlog

Flat list until Phase 6. Seeded from `docs/PHASE_1_BRIEF.md` §11.

## M1 — Read-only fleet

- [x] Manifest `workspaceRoot: "."` + scan folder(s)
- [x] Enroll / unenroll plan then `--apply`
- [x] `status` and `deps` (local / npm / git) + JSON export
- [x] Seed a real workspace fleet by hand (operator) _(localhelm, localberth, ollanet, filepress)_

## M2 — Safe writes + dashboard

- [x] `bump`
- [x] `fetch` / `pull` (clean + behind only)
- [x] Optional write of the JSON export file
- [x] SvelteKit `app/` dashboard (`localhelm serve`) with scan/enroll checkboxes

## M3 — Cascade

- [x] Plan/apply pin + lockfile at `^V`
- [x] `link:` vs registry explicit
- [x] Commit on apply (default on)
- [x] `ready` list

## M4 — Compose + agents

- [x] Plugin host: enrolled `localhelm.plugin.mjs` (FilePress sites board)
- [ ] Optional LocalBerth lease / IngotVault column
- [ ] MCP for status / deps / plans

## Later

- [x] Selected `origin` push with harsh confirm _(named ids + confirm copy; never `--force`)_
- [x] Optional publish action _(plan then named-id apply: bump+commit+push only if needed, then npm publish; never `--force`)_
- [ ] FilePress `site/` + `/docs` on localhelm.dev
- [ ] Tag on bump

## Cheap surfaces (draft spec)

See [`docs/specs/cheap-surfaces.md`](docs/specs/cheap-surfaces.md).

- [x] Family + look cards on Today; `PORT`/`HOST` on Ports confirm _(H1, 2026-08-25)_
- [x] `localhelm brief` + Copy brief _(H2, 2026-08-25)_
- [x] Soft archive (hide, not unenroll, not delete) _(H3, 2026-08-25)_
- [x] Family start/stop (plugin ids only) _(H4, 2026-08-25)_
- [x] Save guess without start _(H5, 2026-08-25)_
