<!-- forgetrail-template-mode: shell — filled from docs/GENESIS.md at kickoff. -->

# LocalHelm — Phase 1 architecture brief

_Structured capture of planning and architecture **before** code scaffolding. Goal: Phase 2 (or a new agent/session) can start from this file + `.forgetrail/workflow_tracking.json` without re-reading the whole Phase 1 chat._

**Status:** `locked`  
**Last updated:** 2026-08-20  
**Phase 1 exit:** This brief is **locked**. Do not advance `currentPhase` to scaffolding until the operator says to start the spine.

Source spec: [`docs/GENESIS.md`](GENESIS.md). Amendments in this brief win where they differ (no shop shelf; enroll is scan-then-confirm).

---

## 1. Problem and outcome

**What we are building (2–4 sentences):**

On a machine with dozens of sibling repos, `git status` in one folder answers one repo. The scarce resource is knowing which **products** are dirty, unpublished, or still pinned to last week's package. **LocalHelm** is a local operator tool: scan folder(s), confirm a named fleet, read every ship surface (local version, npm, git), show the dependency graph, and run bulk actions that you confirm. It exports a generic JSON inventory any site can consume. Pairing: **LocalBerth** is the slip; **LocalHelm** is the wheel. It is not a Catalyst Forge shelf tool.

**Project archetype:** `product`

**What “done” looks like for v1 (measurable where possible):**

The operator points LocalHelm at one or more folders, sees proposed rows, and checks which to enroll. `localhelm status` (and `--json`) shows local vs npm, pin/link edges, and git dirt. After a human publishes package A, a confirmed cascade retargets dependents' pins and lockfiles to `^V` — or skips a dirty row with a reason. v1 does not publish and does not git-push. A FilePress site at `localhelm.dev` (with `/docs`) can wait until the CLI is real.

---

## 2. Users and hero flow

**Primary user(s):**

Any operator who ships several public npm packages from a workspace of sibling repos. Catalyst Forge is a first consumer of the export, not part of the product identity.

**The single most important workflow (hero flow) end-to-end:**

Scan folder(s) → check/confirm which projects to enroll → `status` shows who is dirty / unpublished-ahead / cascade-behind → after a human publishes A@V, confirm `cascade A` → each consumer gets a pin + lockfile update (and a commit if still on) or a skipped row with a reason.

**Secondary workflows (if any) for v1:**

- JSON export of the same inventory (schema owned by LocalHelm; sites consume it)
- `bump` one project's root version (no publish, no tag)
- `fetch` / `pull` (clean + behind only)
- `ready` list (eligible to publish)
- `serve` SvelteKit loopback dashboard with the same inventory (scan/enroll checkboxes, status)

---

## 3. Constraints

_Hard requirements the stack and design must respect._

- **Technical:** Windows / macOS / Linux; kickoff machine is Windows (`Z:\` and Git-Bash). TypeScript, ESM, pnpm, Node 22+. SvelteKit dashboard binds `127.0.0.1` by default. Status without `--fetch` is a local walk plus one npm request per distinct package name. Comfortable at ~80 enrolled rows.
- **Business / timeline:** Public CLI `localhelm` (`0.0.0` on npm; operator publishes). Public site **`localhelm.dev`** (secured); FilePress explainer plus `/docs`. License **Apache-2.0**.
- **Explicit non-goals for v1:** see §10.

---

## 4. Stack and tooling

| Area | Choice | Status | Notes / WHY |
| --- | --- | --- | --- |
| App shape | CLI + SvelteKit dashboard + FilePress `site/` | confirmed | CLI is the spine. Dashboard is SvelteKit (`localhelm serve`). Site is FilePress at `localhelm.dev` including `/docs`. |
| Language | TypeScript ESM | confirmed | House default. |
| State persistence | Local files only (manifest + gitignored job state) | confirmed | A-local. No PocketBase, no accounts. |
| Auth / storage | None / on-disk | confirmed | Loopback dashboard; no telemetry. |
| Styling | Tailwind via SvelteKit (dashboard); FilePress for the public site | confirmed | Dashboard ships with the app; site is separate. |
| Deploy / CI | npm package; FilePress site on Pages later | confirmed | Operator publishes. Tool has no publish action in v1 (future option). |
| Package manager | pnpm | confirmed | House default. |
| License | Apache-2.0 | confirmed | Matches LocalBerth / IngotVault / ForgeTrail. |
| State persistence | Local files | confirmed | Manifest `workspaceRoot: "."`. |

**Folder shape (locked):**

- `src/` — shared library + CLI (what npm ships after build)
- `app/` — SvelteKit loopback dashboard
- `site/` — FilePress explainer + `/docs` (not in the npm tarball)

---

## 5. Data model (sketch)

_Entities and relationships — not full schemas. Enough for Phase 2 scaffolding._

**Core entities:**

- **Workspace** — one root of sibling checkouts. Manifest `workspaceRoot` is `"."` (the folder that holds `localhelm.fleet.json`).
- **Fleet** — enrolled subset. Named. Source of truth is the manifest.
- **Project** — one enrolled row (usually one git repo). May have root + `site/package.json`. Optional `group`.
- **Ship surface** — local version, npm latest, git; optional tag, `ship` script, LocalBerth lease, IngotVault backup remote.
- **Pin / dependent / consumer / publisher** — graph edges from dependency specifiers.
- **Cascade** — plan then job to move dependents to published V with range `^V`.
- **Export** — documented JSON inventory (status digest). Any site may consume it. Not a product-specific shelf file.
- **Plan / Job** — dry-run then one confirmed mutating run. Default **commit on apply** for cascade / export write.
- **Scan** — walk one or more folders; propose rows; write nothing until the operator checks/confirms enrollment.

**Relationships:**

Workspace 1—* Project. Project 1—* Pin. Pin → Package name (enrolled `npm` field). Publisher 1—* Dependent. Project optional `group`. Job 1—* sequential project results.

**Existing data / migration:** Scan proposes from given folder(s). No shop-specific seed in package code. Manifest is source of truth after confirm. No built-in catalog adapter.

Manifest path: `<workspaceRoot>/localhelm.fleet.json` (committed if the fleet is the shop; no machine-only paths; `workspaceRoot` is `"."`). User-global `~/.localhelm/fleet.json` is fallback.

---

## 6. Integrations and external systems

| Integration | Purpose | Auth / secrets | Risk notes |
| --- | --- | --- | --- |
| npm registry | Latest version per package name | None (public GET) | 404 = unpublished. Other non-OK = error cell, not "none." |
| git | Porcelain, remotes, ahead/behind; commit on apply | Operator's remotes | Read-only unless confirmed. No push in v1. Never force-push. Never rewrite `origin`. Never touch IngotVault `backup`. |
| Inventory export | JSON contract for any consumer (sites, agents, MCP in M4) | None | LocalHelm owns the schema. No `projects.js` path. |
| LocalBerth (optional) | Dashboard lease; optional column | Local binary | Missing binary is "no lease tool." |
| IngotVault (optional) | Backup-remote column | Local | Do not push mirrors. |
| FilePress siblings | Headers / engine-only site sync | Existing tool | Stay separate (compose later). Do not reimplement. |
| FilePress `site/` | Public explainer + `/docs` on `localhelm.dev` | Operator Wrangler when shipping | Not in the npm tarball. |
| Cloudflare Pages | v1 does not call the API | Operator Wrangler login | `pnpm ship` in `site/` when the explainer exists. |
| LLM | None | — | Skip §6a. |

---

## 6a. Content-generation pattern (only if LLM-produced content)

Skipped. Inventory and plans are read from disk, git, and npm. No LLM chooses versions, commit messages, or skip lists.

---

## 7. Hardest problems and risks

1. **Folder ≠ npm name ≠ display name.** Guessy matching will attach dependents to the wrong row. Manifest fields are explicit.
2. **Local ahead of npm.** Cascade must target published V and say local is unpublished.
3. **Export schema drift.** LocalHelm owns the JSON shape; consumers adapt.
4. **`link:` / `file:` vs registry.** A cascade that silently keeps `link:` and calls it current is a lie.
5. **Windows paths** (`Z:\` vs `Z:/`, spaces, worktrees). Normalize.
6. **One mutating job at a time.** Concurrent dashboards or overlapping writes.
7. **Scan noise.** Propose; never auto-enroll. Skip `__*`, dot-dirs, `node_modules`, obvious non-dirs. Operator checks the list.

---

## 8. Architectural decisions (numbered)

**D1.** Product archetype. WHY: public installable CLI.

**D2.** TypeScript + ESM + pnpm + Node 22+; no accounts; no telemetry.

**D3.** License **Apache-2.0**. WHY: confirmed 2026-08-20. Rejected: MIT.

**D4.** No publish action in v1 (eligible badge only). Operator publishes. Agents never run `npm publish` / `pnpm publish`. A publish action is a **future option**, never the first ship. WHY: confirmed 2026-08-20.

**D5.** CLI `localhelm`, never `helm`. Name reserved on npm as `0.0.0`.

**D6.** FilePress siblings stay separate. Compose later (after M3); do not reimplement `_headers` / engine pin rewrite.

**D7.** Local file state only. No PocketBase. Dashboard loopback.

**D8.** No LLM-produced content.

**D9.** No product-specific shelf. Generic JSON export only.

**D10.** Public site is `localhelm.dev`, FilePress explainer **plus `/docs`**. Site is not a v1 CLI blocker.

**D11.** Enroll is **scan folder(s) → operator checks/confirms**. Discover proposes; nothing is written until confirm. Multiple roots allowed. Scan honors `.localhelmignore` (gitignore syntax) and `~/.localhelm/ignore`.

**D12.** Commit on apply: **yes**, default on for cascade / export write. Message like `Helm: retarget <pkg> to <version>.` No attribution trailers.

**D13.** No git **push** in v1 (fetch/pull only). Push is a later milestone, with a harsh confirm.

**D14.** Cascade writes `^V`.

**D15.** Manifest at `<workspaceRoot>/localhelm.fleet.json` with `workspaceRoot: "."`. Optional `group` on rows. JSON inventory in M1; MCP in M4.

**D16.** Dashboard is **SvelteKit** in `app/`. CLI library in `src/`. FilePress in `site/`.

---

## 9. Open questions (before or during Phase 2)

| # | Question | Owner / resolve by |
| - | --- | --- |
| 1 | Domain `localhelm.dev` + FilePress `/docs` | Closed 2026-08-20 |
| 2 | License Apache-2.0 | Closed 2026-08-20 |
| 3 | Commit on apply, default on | Closed 2026-08-20 |
| 4 | No git push in v1; later yes | Closed 2026-08-20 |
| 5 | No publish in v1; future option | Closed 2026-08-20 |
| 6 | FilePress siblings stay separate | Closed 2026-08-20 |
| 7 | Cascade range `^V` | Closed 2026-08-20 |
| 8 | Manifest `workspaceRoot: "."` | Closed 2026-08-20 |
| 9 | Optional `group` on rows | Closed 2026-08-20 |
| 10 | JSON in M1; MCP in M4 | Closed 2026-08-20 |
| 11 | CLI + SvelteKit dashboard | Closed 2026-08-20 |
| 12 | npm name `localhelm` reserved | Closed 2026-08-20 |

No open product questions block scaffolding.

---

## 10. Explicitly out of scope (v1)

- Not a monorepo merger. Not a scan-everything git TUI that auto-enrolls.
- Not IngotVault, LocalBerth, or the FilePress sibling dashboard.
- Not a remote fleet manager. No SSH, no hosted accounts, no telemetry.
- No publish action, no git push, no force-push, no rewriting unrelated dirty files.
- No starting/stopping other apps' dev servers.
- No Catalyst Forge (or other shop) shelf file in this package.
- No "create a new sibling product" scaffolder.
- No LLM choosing versions, commit messages, or skip lists.

---

## 11. First feature batch (post-scaffold)

1. **M1 — Read-only fleet:** scan folder(s) → confirm enroll / unenroll, `status` + `deps` (local / npm / git), JSON export. Manifest `workspaceRoot: "."`. No shop-specific seed in code.
2. **M2 — Safe writes + dashboard:** `bump`, `fetch` / `pull`, export file write, SvelteKit `serve` with scan/enroll checkboxes and the same inventory.
3. **M3 — Cascade:** plan/apply pin + lockfile at `^V`, `link:` vs registry explicit, default commit on apply, `ready`.
4. **M4 — Compose + agents:** optional LocalBerth lease, IngotVault column, FilePress siblings deep-link (still separate), MCP for status/deps/plans.
5. **M5+ — Later:** selected `origin` push with harsh confirm; optional publish action (never the first ship); FilePress `site/` + `/docs` on `localhelm.dev` if not already started; tag on bump.

---

## 12. Handoff checklist (before leaving Phase 1)

- [x] User has confirmed stack, folder shape, data sketch, hero flow, and v1 boundaries
- [x] This brief is **locked**
- [x] `.forgetrail/workflow_tracking.json` updated: `decisions[]` for each major D#; phase 1 notes summarize sign-off
- [x] Phase 2 opener will read **this file** + `.forgetrail/workflow_tracking.json` first
