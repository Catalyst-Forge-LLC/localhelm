# LocalHelm — Feature Backlog

Flat list until Phase 6. Seeded from `docs/PHASE_1_BRIEF.md` §11.

## M1 — Read-only fleet

- [x] Manifest `workspaceRoot: "."` + scan folder(s)
- [x] Enroll / unenroll plan then `--apply`
- [x] `status` and `deps` (local / npm / git) + JSON export
- [x] Seed a real workspace fleet by hand (operator) _(localhelm, localberth, ollanet, filepress)_

## M2 — Safe writes + dashboard

- [x] `bump` _(apply writes package.json and commits that file; no tag, no push)_
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
- [x] FilePress `site/` + `/docs` on localhelm.dev _(modeled on LocalBerth, 2026-08-27)_
- [ ] Tag on bump

## Cheap surfaces (draft spec)

See [`docs/specs/cheap-surfaces.md`](docs/specs/cheap-surfaces.md).

- [x] Family + look cards on Today; `PORT`/`HOST` on Ports confirm _(H1, 2026-08-25)_
- [x] `localhelm brief` + Copy brief _(H2, 2026-08-25)_
- [x] Soft archive (hide, not unenroll, not delete) _(H3, 2026-08-25)_
- [x] Family start/stop (plugin ids only) _(H4, 2026-08-25)_
- [x] Save guess without start _(H5, 2026-08-25)_
- [x] Quiet sites, cross-walk chips, copy, activity links, recipe health + guess-all, Tippy _(2026-08-25)_
- [x] Attention UX: row writes on Fleet needs you; Sites/Ports notes in ? tip; Ports actions one line; labeled stacks _(2026-08-25)_
- [x] Scoped status refresh (row / checked / `status [id…]`) so bump/push do not wait on the whole fleet _(2026-08-26)_
- [x] Hide publish auth setup copy when `npm whoami` already works _(2026-08-26)_
- [x] Bulk apply progress `N of M · id` on header and confirm _(2026-08-26)_
- [x] Sites: engine version + Sync engine only when behind; one-line site cell _(2026-08-26)_
- [x] Table cleanup: Fleet one version column; Ports drop listening/log/firewall noise; Sites hide headers/ship columns _(2026-08-26)_
- [x] Cut version only when origin has commits since the last npm version _(2026-08-26)_
- [x] Today pane board: section scroll, Looks on the glass, refresh pinned to the id _(2026-08-26)_
- [x] Phone tile grid is the Deck (`/deck`); `/visitor` redirects _(2026-08-31)_
- [x] Confirm roster + current pane for multi-id writes _(2026-08-31)_
- [x] Named Push confirm lists skipped checked rows; toolbar count is eligible _(2026-09-02)_
- [x] Land/ship banner keeps the FilePress reason, not the Vite dump _(2026-09-02)_
- [x] Land is site-only: sync engine + push + ship; no filepress/companion publish _(2026-09-03)_
- [x] Land plan is one request for all named sites _(2026-09-03)_
- [x] Land confirm spins only the current step _(2026-09-03)_
- [x] Table zebra stripe + row hover _(2026-09-03)_
- [x] Land confirm shows the real plugin fail line, not only exit 1 _(2026-09-03)_
- [x] Tables paint before full status/plugin reads; cells show a loader until facts exist _(2026-09-04)_
- [x] Commit dirty repos from the dashboard: file list + Ollama/fallback message, confirm to git commit _(2026-09-04)_
- [x] Commit drafts find Ollama through ollanet (local first, network if needed) _(2026-09-04)_
- [x] Add projects list is A–Z by folder path, case-insensitive _(2026-09-04)_
- [x] Needs you filter: All / Publish / Cut / Push _(2026-08-26)_
