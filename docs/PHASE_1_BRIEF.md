<!-- forgetrail-template-mode: shell — filled from docs/GENESIS.md at kickoff. -->

# LocalHelm — Phase 1 architecture brief

_Structured capture of planning and architecture **before** code scaffolding. Goal: Phase 2 (or a new agent/session) can start from this file + `.forgetrail/workflow_tracking.json` without re-reading the whole Phase 1 chat._

**Status:** `draft`  
**Last updated:** 2026-08-20 (D9: no product-specific shelf)  
**Phase 1 exit:** Do not mark Phase 1 complete in `.forgetrail/workflow_tracking.json` until this brief is **locked** and major commitments are in `decisions[]`.

Source spec: [`docs/GENESIS.md`](GENESIS.md).

---

## 1. Problem and outcome

**What we are building (2–4 sentences):**

On a machine with dozens of sibling repos, `git status` in one folder answers one repo. The scarce resource is knowing which **products** are dirty, unpublished, or still pinned to last week's package. **LocalHelm** is a local operator tool: enroll a named fleet, read every ship surface (local version, npm, git), show the dependency graph, and run bulk actions that you confirm. It exports a generic JSON inventory any site can consume. Pairing: **LocalBerth** is the slip; **LocalHelm** is the wheel. It is not a Catalyst Forge shelf tool.

**Project archetype:** `product`

**What “done” looks like for v1 (measurable where possible):**

Given a named fleet of sibling packages, `localhelm status` (and `--json`) shows local vs npm, pin/link edges, and git dirt. After a human publishes package A, a confirmed cascade retargets dependents' pins and lockfiles to published V — or skips a dirty row with a reason. A documented JSON export is the contract for any public shelf (including, later, Catalyst Forge). The tool never publishes and never force-pushes.

---

## 2. Users and hero flow

**Primary user(s):**

Any operator who ships several public npm packages from a workspace of sibling repos. Catalyst Forge is a first consumer of the export, not part of the product identity.

**The single most important workflow (hero flow) end-to-end:**

Enroll a named fleet → `status` shows who is dirty / unpublished-ahead / cascade-behind → after a human publishes A@V, confirm `cascade A` → each consumer gets a pin + lockfile update or a skipped row with a reason.

**Secondary workflows (if any) for v1:**

- JSON export of the same inventory (schema owned by LocalHelm; sites consume it)
- `bump` one project's root version (no publish, no tag)
- `fetch` / `pull` (clean + behind only)
- `ready` list (eligible to publish)
- `serve` loopback dashboard with the same inventory

---

## 3. Constraints

_Hard requirements the stack and design must respect._

- **Technical:** Windows / macOS / Linux; kickoff machine is Windows (`Z:\` and Git-Bash). TypeScript, ESM, pnpm, Node 22+. Bind dashboard to `127.0.0.1` by default. Status without `--fetch` is a local walk plus one npm request per distinct package name. Comfortable at ~80 enrolled rows.
- **Business / timeline:** Public CLI `localhelm` (`0.0.0` on npm; operator publishes). Public site **`localhelm.dev`** (secured 2026-08-20); FilePress explainer later, same split as LocalBerth.
- **Explicit non-goals for v1:** see §10.

---

## 4. Stack and tooling

_Confirmed choices only after user sign-off. Mirror the same choices into `CONTEXT_PROMPT.md` → Tech Stack in Phase 2._

| Area | Choice | Status | Notes / WHY |
| --- | --- | --- | --- |
| App shape | CLI-first + small loopback dashboard | proposed | Genesis §9.11. Do not stand up a second SvelteKit product app if a LocalBerth-style page will do. |
| Language | TypeScript ESM | proposed | House default. |
| State persistence | Local files only (manifest + gitignored job state) | proposed | A-local. No PocketBase, no accounts. |
| Auth / storage | None / on-disk | proposed | Loopback dashboard; no telemetry. |
| Styling | Deferred until dashboard | proposed | CLI is the spine. |
| Deploy / CI | npm package; optional FilePress site later | confirmed | Operator always publishes. Tool and agents never run publish. |
| Package manager | pnpm | proposed | House default. |
| License | Apache-2.0 | proposed | Matches LocalBerth / IngotVault; MIT still listed in genesis §9. |

---

## 5. Data model (sketch)

_Entities and relationships — not full schemas. Enough for Phase 2 scaffolding._

**Core entities:**

- **Workspace** — one root of sibling checkouts (kickoff default: parent of this repo).
- **Fleet** — enrolled subset. Named. Source of truth is the manifest.
- **Project** — one enrolled row (usually one git repo). May have root + `site/package.json`.
- **Ship surface** — local version, npm latest, git; optional tag, `ship` script, LocalBerth lease, IngotVault backup remote.
- **Pin / dependent / consumer / publisher** — graph edges from dependency specifiers.
- **Cascade** — plan then job to move dependents to published V.
- **Export** — documented JSON inventory (status digest). Any site may consume it. Not a product-specific shelf file.
- **Plan / Job** — dry-run then one confirmed mutating run.

**Relationships:**

Workspace 1—* Project. Project 1—* Pin. Pin → Package name (enrolled `npm` field). Publisher 1—* Dependent. Job 1—* sequential project results.

**Existing data / migration:** Discover proposes from a workspace root. A first-machine seed list may live in operator docs (genesis §4.10), not in package code. Manifest is source of truth after day one. No built-in catalog adapter.

Proposed manifest path: `<workspaceRoot>/localhelm.fleet.json` (committed if the fleet is the shop; no machine-only paths). User-global `~/.localhelm/fleet.json` is fallback.

---

## 6. Integrations and external systems

| Integration | Purpose | Auth / secrets | Risk notes |
| --- | --- | --- | --- |
| npm registry | Latest version per package name | None (public GET) | 404 = unpublished. Other non-OK = error cell, not "none." |
| git | Porcelain, remotes, ahead/behind | Operator's existing remotes | Read-only unless confirmed. Never force-push. Never rewrite `origin`. Never touch IngotVault `backup`. |
| Inventory export | JSON contract for any consumer (sites, agents) | None | LocalHelm owns the schema. No `projects.js` path. CF may consume later. |
| LocalBerth (optional) | Dashboard lease; optional column | Local binary | Missing binary is "no lease tool." |
| IngotVault (optional) | Backup-remote column | Local | Do not push mirrors. |
| FilePress siblings | Headers / engine-only site sync | Existing tool | Compose; do not reimplement. |
| Cloudflare Pages | v1 does not call the API | Operator Wrangler login | `pnpm ship` is the deploy action if invoked. |
| LLM | None | — | Skip §6a. |

---

## 6a. Content-generation pattern (only if LLM-produced content)

Skipped. Inventory and plans are read from disk, git, and npm. No LLM chooses versions, commit messages, or skip lists.

---

## 7. Hardest problems and risks

1. **Folder ≠ npm name ≠ display name.** Guessy matching will attach dependents to the wrong row. Manifest fields are explicit.
2. **Local ahead of npm.** Cascade must target published V and say local is unpublished (FilePress already hit this class of bug).
3. **Export schema drift.** LocalHelm owns the JSON shape; consumers adapt. Do not special-case a shop's marketing file.
4. **`link:` / `file:` vs registry.** A cascade that silently keeps `link:` and calls it current is a lie.
5. **Windows paths** (`Z:\` vs `Z:/`, spaces, worktrees). Normalize; do not store a path form that fails on the same machine.
6. **One mutating job at a time.** Concurrent dashboards or overlapping writes.

---

## 8. Architectural decisions (numbered)

**D1.** Product archetype. WHY: public installable CLI. Rejected: internal-tool / one-shot.

**D2.** TypeScript + ESM + pnpm + Node 22+; no accounts; no telemetry. WHY: house defaults and local-only product.

**D3.** Apache-2.0 (proposed). WHY: sibling pairing with LocalBerth / IngotVault. Still confirm vs MIT.

**D4.** The operator always publishes to npm. LocalHelm never has a publish button (eligible badge only). Agents never run `npm publish` / `pnpm publish`. Never force-push; no git push in v1. WHY: confirmed 2026-08-20 — house rule.

**D5.** CLI `localhelm`, never `helm`. `package.json` is `0.0.0` so the name can be reserved.

**D6.** Compose, don't clone: IngotVault, LocalBerth, FilePress siblings stay owners of their jobs.

**D7.** Local file state only. No PocketBase. Dashboard loopback.

**D8.** No LLM-produced content.

**D9.** No product-specific shelf. LocalHelm does not read or write Catalyst Forge `projects.js` (or any other shop catalog). It exports generic JSON; a site may consume that later. WHY: this is a public package, not a CF internal. Rejected: baked-in catalog adapter.

**D10.** Public site is `localhelm.dev`. WHY: secured 2026-08-20. Rejected: `.com`, or holding the name until the CLI ships. The explainer site itself still waits until the CLI is real.

---

## 9. Open questions (before or during Phase 2)

| # | Question | Owner / resolve by |
| - | --- | --- |
| 1 | Domain: **`localhelm.dev`** (secured). FilePress explainer later; not a v1 blocker | Closed 2026-08-20 |
| 2 | License: Apache-2.0 (proposal) vs MIT | User — before 0.1.0 |
| 3 | Commit on apply: optional commit, default on for cascade / export write | User — before M2 writes |
| 4 | Git push from LocalHelm: not in v1 (proposal) | User — confirm |
| 5 | Publish button in LocalHelm: **never**. Operator always publishes. | Closed 2026-08-20 |
| 6 | FilePress siblings stay separate until after M3 (proposal) | User — confirm |
| 7 | Cascade range: `^V` (proposal) | User — confirm |
| 8 | Manifest: committed workspace `localhelm.fleet.json`; `workspaceRoot` is `"."` or omitted | User — confirm |
| 9 | Optional `group` on a fleet row (generic). Shop-specific grouping (e.g. xFacts) lives in the consumer | Closed with D9 — not a LocalHelm shelf card |
| 10 | MCP in M4; JSON in M1 | User — confirm |
| 11 | Dashboard stack: CLI-first; small static/Svelte page vs SvelteKit | User — before M2 dashboard |
| 12 | Name reservation: `package.json` is `localhelm@0.0.0`. Operator publishes. | Operator |

---

## 10. Explicitly out of scope (v1)

- Not a monorepo merger. Not a scan-everything git TUI.
- Not IngotVault, LocalBerth, FilePress siblings, Lerna, or Dependabot.
- Not a remote fleet manager. No SSH, no hosted accounts, no telemetry.
- No auto-publish, no force-push, no rewriting unrelated dirty files.
- No starting/stopping other apps' dev servers.
- No Catalyst Forge (or other shop) shelf file in this package — no `projects.js` adapter, no baked-in catalog names.
- No "create a new sibling product" scaffolder.
- No LLM choosing versions or skip lists.

---

## 11. First feature batch (post-scaffold)

1. **M1 — Read-only fleet:** manifest, discover (print-only), enroll/unenroll, `status` + `deps` (local / npm / git), JSON export (documented schema). No shop-specific seed in code.
2. **M2 — Safe writes:** optional write of the export file, `bump`, `fetch` / `pull`, `serve` with the same inventory.
3. **M3 — Cascade:** plan/apply pin + lockfile, `link:` vs registry explicit, `ready`, dashboard plan/confirm/log.
4. **M4 — Compose + agents:** optional LocalBerth lease, IngotVault column, FilePress siblings deep-link, MCP for status/deps/plans.
5. **M5 — Polish if wanted:** selected `origin` push with harsh confirm, tag on bump, outside-package watch list.

---

## 12. Handoff checklist (before leaving Phase 1)

- [ ] User has confirmed stack, folder shape, data sketch, hero flow, and v1 boundaries
- [ ] This brief is **locked** (no `[draft]` ambiguity) or remaining items are only in §9 Open questions
- [ ] `.forgetrail/workflow_tracking.json` updated: `decisions[]` for each major D#; `phases["1-architecture"]` notes summarize sign-off
- [ ] Phase 2 opener will read **this file** + `.forgetrail/workflow_tracking.json` first
