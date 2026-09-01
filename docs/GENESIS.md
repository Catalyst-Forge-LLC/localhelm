# LocalHelm: Genesis

A fleet board for **products you ship**. Pairing: **LocalBerth** is the slip; **LocalHelm** is the wheel.

On a machine with dozens of sibling repos, the scarce resource is not a git status line. It is knowing which products are dirty, unpublished, lying on a public shelf, or still pinned to last week's package. `git status` in one folder answers one repo. The job is the set.

**LocalHelm** is a local operator tool: enroll a named fleet, read every ship surface, show the dependency graph, and run bulk actions that you confirm. It does not scan every folder on disk and call that a product list. It does not publish to npm. It does not push unless you ask.

Public name **LocalHelm**. CLI and npm package **`localhelm`**. Repo folder `localhelm`. Site **`localhelm.dev`** (secured 2026-08-20). The app runs on your machine. The site, when it exists, is a FilePress explainer, same split as LocalBerth.

---

## 0. Summary

The Catalyst Forge workspace (`Z:\workspace` on the kickoff machine) held **52 git repos** and **47 `package.json` trees** on 2026-08-20. About fifteen of those are public products on [catalystforge.com/open-source](https://www.catalystforge.com/open-source). More landed in the last two weeks (EmberDossier is already on npm as `get-ember-dossier@0.1.4` and is not on the shelf). They depend on each other: sites pin `getfilepress`, packages pin `ollanet` and `smellcheck`, some use `link:` for local work.

The current workaround is walking the folders: bump, `prepublishOnly`, publish, then remember every consumer, then remember the shelf card in `catalyst-forge/src/lib/projects.js`. That last file is already stale. Local vs shelf on 2026-08-20:

| Product | Shelf (`projects.js`) | Local `package.json` |
|---|---|---|
| FilePress (`getfilepress`) | v0.1.2 | 0.1.8 |
| ollanet | v0.4.1 | 0.6.6 |
| LocalBerth | v0.2.0 | 0.2.6 |
| Smell Check | v0.1.1 | 0.1.6 |
| Finetuna | v1.1.1 | 1.1.3 |
| ForgeTrail | v0.3.0 | 0.3.0 |

FilePress already has an in-engine **sibling dashboard** (`pnpm siblings`) that retargets `getfilepress` pins on content sites, merges headers, commits, and optionally ships Pages. That tool is FilePress-specific, unpublished, and does not own package version bumps, npm publish status, catalog drift, or a general dependent cascade. LocalHelm is the fleet-level board. It composes with that dashboard. It does not absorb it in v1.

This spec is what the tool does, not how to implement it. House defaults that a builder may treat as locked unless an open question says otherwise: TypeScript, ESM, pnpm, Node 22+, Apache-2.0, no accounts, no telemetry.

---

## 1. Prior art

Search done 2026-08-20. The gap is real. Pieces exist.

### 1.1 Multi-repo git

[gita](https://github.com/nosarthur/gita), [myrepos](https://myrepos.branchable.com/), [meta](https://github.com/mateodelnorte/meta), [gitforest](https://www.npmjs.com/package/gitforest), [monogit](https://github.com/Frozen-Crow/monogit): branch, dirty, ahead/behind, then `pull` / `push` / `exec` across a set. They do not know npm, catalogs, or "A published, bump B and C."

### 1.2 Local dashboards

[HexOps](https://github.com/Hexaxia-Labs/hexops): start/stop servers, vulns, some git, Vercel. [iamgp/helm](https://github.com/iamgp/helm): scan a folder of git repos, dashboard on localhost. Closest **name** collision. [TaskHelm](https://www.npmjs.com/package/taskhelm): worktrees, ports, pooled dev servers. Different job, similar name. Kubernetes **Helm** is the big SEO collision. The CLI must never be `helm`.

### 1.3 Monorepo publish

Lerna, Changesets, Nx, Rush. Wrong shape. This fleet is separate repos with separate versions, not one versioned workspace.

### 1.4 Cross-repo config drift

[reposync](https://github.com/sulthonzh/reposync) asks whether twelve services share ESLint. Not the job.

### 1.5 Agent polyrepo maps

[repoly](https://github.com/bryntje/repoly): a machine-readable map of repos plus context packs. Useful cousin. It does not compare local version to npm or walk dependents after a publish.

### 1.6 In-house tools (do not reinvent)

| Tool | Job | LocalHelm relationship |
|---|---|---|
| **IngotVault** | Spare remotes for a workspace of git repos. Never touches `origin`. | Compose. Optional column: backup remote present. Do not push mirrors. |
| **LocalBerth** | Named TCP port leases. Dashboard `:54321`. | Compose. Optional column: lease/port. `localhelm serve` should claim its own lease. Do not start/stop other apps in v1. |
| **FilePress sibling dashboard** | Discover content sites that pin `getfilepress`, retarget to published npm, merge `_headers`, commit, optional `pnpm ship`. | Compose. A FilePress-site row may show "open FilePress siblings" or, later, call that library. Do not reimplement header merge or engine pin rewrite. |
| **publish-gate scripts** | Several packages (`ingotvault`, `ollanet`, `getfilepress`) bump local version when it is not ahead of npm, then refuse a confused publish. | Read the same facts (local vs registry). Do not replace `prepublishOnly`. The human still publishes. |

### 1.7 What is missing

No existing tool, in-house or public, gives a named product fleet:

1. local version vs npm vs public catalog
2. git dirty / unpushed / no origin
3. who depends on whom, including `site/package.json`
4. a confirmable plan to bump dependents after a package hits the registry
5. a confirmable plan to rewrite catalog version strings

That is LocalHelm.

---

## 2. Required background: the surfaces a builder must read

Naive implementations fail by treating "a project" as one `package.json` and one `git status`. A shipped sibling has several clocks. They do not move together.

### 2.1 `package.json` (root and nested)

Read `package.json` at the repo root. Also read `site/package.json` when present. Many public tools are a CLI/package at root and a FilePress site under `site/` that pins `getfilepress`.

Fields that matter:

| Field | Why |
|---|---|
| `name` | Registry identity. Often **not** the folder name (`filepress` folder → `getfilepress`; `ember-dossier` → `get-ember-dossier`; `temper-pass` → `temperpass`). |
| `version` | Local clock. Semver string. Missing on some private trees. |
| `private` | `true` means do not compare to npm as a publish target. Still enrollable. |
| `dependencies` / `devDependencies` / `peerDependencies` / `optionalDependencies` | Edges in the fleet graph. |
| `scripts.ship` | Pages/FilePress deploy exists. |
| `scripts.prepublishOnly` | Publish gate exists. Status may note it. Do not run publish. |
| `bin` | CLI name, for display. |
| `publishConfig.access` | Public vs restricted. |
| `repository.url` | GitHub slug when remotes are messy. |

Pin kinds a builder must classify, not squash into one string:

- registry range: `^0.1.8`, `~0.1.8`, exact `0.1.8`
- `link:../smellcheck` (pnpm workspace-style local)
- `file:…`
- `workspace:`
- git URL (`github:org/repo#ref`)

`link:` / `file:` means "this machine is coupled." The row must say so. A cascade that retargets to npm must not silently keep `link:` and call it current.

### 2.2 npm registry

`GET https://registry.npmjs.org/<name>/latest` (scoped names are encoded). `404` means unpublished, not an error. Other non-OK statuses are errors and must be shown, not treated as "no package."

Compare **semver**, not strings. `0.1.10` is greater than `0.1.9`. Local `>` published is "ready to publish" only if git is otherwise eligible. Local `===` published and a dirty tree is "unpublished work." Local `<` published is "local behind registry" (someone published from another clone, or this tree was reset).

The FilePress sibling rule applies to **any** cascade that installs a pin: if local package version is ahead of npm, the install target is the **published** version, and the UI says so. Never install a version that is not on the registry unless the pin is explicitly `link:` / `file:` and the operator chose "use local link."

### 2.3 Git

Per enrolled path:

- Is it a repo? (`.git` directory. Linked worktrees have a `.git` **file**; treat them as the parent repo, same as IngotVault.)
- Porcelain: staged, unstaged, untracked (not ignored).
- Branch name. Detached HEAD. Merge/rebase/cherry-pick in progress.
- Remotes: `origin` URL, optional `backup` (IngotVault).
- Ahead/behind vs upstream after a fetch, or "no upstream."
- Last tag vs `HEAD` (optional column; useful for packages that tag releases).

Read-only unless the operator confirmed a named action (`fetch`, `pull`, `commit` of specified paths). **Never** `push --force`. **Never** prune. **Never** rewrite `origin`.

### 2.4 Public shelf (not baked into LocalHelm)

**Amendment 2026-08-20:** LocalHelm does **not** read or write `catalyst-forge/src/lib/projects.js` or any other product-specific shelf. The first shop may still *use* LocalHelm that way, but the package exports a generic inventory (JSON). A site such as Catalyst Forge can consume that export later. Kickoff numbers below are workspace context only.

Historical note — canonical CF catalog today: `catalyst-forge/src/lib/projects.js`. It exports `projectGroups`. Each project has `name`, `version` (a display string like `v0.1.2` or `suite` or `pre-1.0`), `status`, `links[]`, optional `members[]`. That adapter is **out of this package.**

This file is hand-edited JavaScript, not JSON. A v1 catalog adapter:

- **Reads** `version` for each named project.
- **Writes** only that display version for projects it can uniquely identify.
- **Fails the row** if the name is missing, duplicated, or the version field cannot be isolated without rewriting surrounding copy.
- Does not rewrite taglines, descriptions, or links.

`suite` and `pre-1.0` are catalog values, not semver. Do not "fix" them to `0.1.8`.

EmberDossier (and any enrolled public package not in the file) is a **catalog gap**, not a version mismatch.

### 2.5 Lockfiles

pnpm lockfiles record the resolved importer version. After a pin rewrite, the **importer** line for that package must match the intended target. Nested leftover `site/pnpm-lock.yaml` next to a workspace lock is a known FilePress footgun. When a `pnpm-workspace.yaml` exists, prefer the workspace lock. Do not invent a second lock parser if you can reuse FilePress's `parseLockedGetfilepress` pattern generalized to any package name.

### 2.6 Optional compose surfaces (v1 read-only)

- **LocalBerth:** `localberth get <name>` when the binary exists. Missing binary is "no lease tool," not a hard fail.
- **IngotVault:** `backup` remote URL present or `ingotvault list` if you already have a safe read path. Missing tool is fine.
- **FilePress:** `filepress.config.ts` `url` field, `scripts.ship`. Do not eval untrusted config if a small parse will do.
- **Cloudflare Pages:** v1 does not call the API. `pnpm ship` in a repo is the deploy action, same as FilePress siblings, and it uses the operator's existing Wrangler login.

### 2.7 LocalHelm's own files

Two files, both local, neither a hosted account:

1. **Fleet manifest** (source of enrollment). Proposed path: `./localhelm.fleet.json` in a workspace, or `~/.localhelm/fleet.json` for a user-global fleet. A repo-local file next to the workspace root wins.
2. **Job state** (last inventory, last log). Gitignored directory, e.g. `~/.localhelm/state/` or `.localhelm/` under the workspace. Enrolled repos stay the source of their own git history.

Proposed manifest shape (what, not the final schema library):

```json
{
  "$schema": "https://localhelm.dev/schema/fleet.schema.json",
  "workspaceRoot": "Z:/workspace",
  "catalogs": [
    {
      "id": "catalyst-forge-shelf",
      "kind": "projects.js",
      "path": "catalyst-forge/src/lib/projects.js"
    }
  ],
  "projects": [
    {
      "id": "filepress",
      "path": "filepress",
      "npm": "getfilepress",
      "catalogName": "FilePress",
      "group": "forge-tools"
    }
  ]
}
```

`id` is stable. `path` is relative to `workspaceRoot`. `npm` may be omitted for private or non-package repos. `catalogName` maps to the shelf card. Extra fields later: `siteUrl`, `github`, `filepress`, `ignoreCascade`.

`discover` walks `workspaceRoot` (IngotVault-like: skip `node_modules`, dot-dirs, `__*`, max depth) and **proposes** rows. It does not silently enroll `foo`, `sandbox`, or `SDR`.

---

## 3. Core domain concepts

- **Workspace:** one root folder of sibling checkouts. Kickoff default: parent of this repo (`Z:\workspace`).
- **Fleet:** the enrolled set. A subset of the workspace. Named. The product operates on the fleet, not on "every git repo we found."
- **Project:** one enrolled row. Usually one git repo. May have a root package and a nested site package.
- **Package name:** npm `name`. Distinct from folder name and from marketing name.
- **Ship surface:** one clock on a project. v1 surfaces: local version, npm latest, git, catalog version. Optional: last tag, `ship` script present, LocalBerth lease, IngotVault backup remote.
- **Pin:** a dependency specifier on a project (root or site) that names another package.
- **Dependent:** a fleet project whose pin names an enrolled (or known npm) package.
- **Consumer:** a dependent that does not itself need a registry publish after a pin bump (typical FilePress content site, or a private app).
- **Publisher:** a dependent that is also a public package. Pin bump may imply a later version bump and a human publish. LocalHelm never does that publish.
- **Cascade:** after package A is on npm at version V, the plan that moves dependents' pins (and lockfiles) to a specifier that installs V.
- **Catalog:** an external list of public versions (the CF shelf). Drift is local-or-npm vs catalog display version.
- **Plan:** a dry-run of a mutating job. Structured rows, no writes.
- **Job:** one confirmed mutating run. One at a time. Sequential projects. Live log with real stdout/stderr.
- **Eligibility (publish):** local > npm, `private` is not true, git clean (or only allowed paths dirty, if a later rule says so), not in rebase, tests/gate optional. Eligibility is a **status**, not a button that publishes.

---

## 4. Functional requirements

### 4.1 Fleet enrollment

1.1. The operator can declare a workspace root and a list of projects in a manifest.
1.2. `localhelm discover` (and enroll) can **scan one or more folders** and print candidate rows (folder, git?, `package.json` name/version, `private`, looks-like-FilePress-site). It does not write the manifest until the operator **checks/confirms** which rows to enroll.
1.3. `localhelm enroll` applies the confirmed set (paths and optional `--npm`). `unenroll <id>` removes a row. Single-path enroll remains valid.
1.4. A project with no `package.json` is still enrollable (docs-only, xFacts spec repo). Surfaces that do not apply show as "n/a," not errors.
1.5. Duplicate `id` or two projects with the same absolute path: refuse to load the manifest.
1.6. Missing path: row status `missing`, not a crash of the whole fleet.

### 4.2 Status

2.1. `localhelm status` prints one row per enrolled project.
2.2. Columns (v1): id/name, local version, npm latest (or `private` / `none`), catalog version (or `gap` / `n/a`), pin summary (linked / behind / current), git (clean / dirty / ahead N / behind N / no origin / missing), cascade debt (dependents still behind this project's npm, or this project behind a dependency's npm).
2.3. The same inventory is available as JSON for the dashboard and for agents.
2.4. Registry and network failures are per-cell errors. Other rows still render.
2.5. `status` is read-only. It may fetch git remotes only if the operator passed `--fetch` (default off, so a status pass is local-fast plus npm).
2.6. A **fleet digest** line: counts of dirty, unpublished-ahead, catalog-stale, cascade-behind, missing, fetch-errors.

### 4.3 Dependency graph

3.1. Build a directed graph from all pins in enrolled root and `site/package.json` files whose target is an enrolled package name **or** a name the operator listed as `npm` on some project.
3.2. `localhelm deps` shows, for each publisher, its direct dependents and whether their resolved/locked version equals that publisher's npm latest.
3.3. Detect cycles. Display them. Refuse cascade apply on a cycle until the operator names a break (`ignoreCascade` on an edge, or apply one node at a time).
3.4. `link:` edges are first-class: "local link to `<path>`." They are never reported as "on npm latest."
3.5. Pins to packages outside the fleet (React, Svelte) are ignored unless the operator later adds a watch list. v1 is the house graph, not the whole npm universe.

### 4.4 Plans and jobs (shared rules)

4.1. Every write goes through a plan, then an explicit confirm (CLI flag `--apply` after a printed plan, or a dashboard Confirm).
4.2. One mutating job at a time.
4.3. Sequential projects. A failed project records exit code + stderr and continues unless the operator set stop-on-first-error.
4.4. The log shows the real command lines and the real output. A count-only failure is not acceptable.
4.5. Jobs write only listed paths. Default allowlist for pin work: that project's `package.json` (the one that held the pin), the resolved lockfile, nothing else. Catalog work: only the catalog file's version fields. Git commit of those paths is opt-in per action (FilePress siblings commit on apply; LocalHelm default is **show the diff and commit if the operator asked**). Open question, see §9.
4.6. Never push unless the action is named `push` and the confirm copy says which remotes and which projects. Default `origin` only. Never the IngotVault spare remote.
4.7. Never `npm publish` / `pnpm publish` / `yarn npm publish`. The house rule is the human publishes. Status may say "eligible."
4.8. Never force-push, never `--force` on git, never delete branches.

### 4.5 Bulk git

5.1. `fetch` all enrolled remotes (`origin`).
5.2. `pull` only projects that are clean and behind (fast-forward). Refuse dirty or diverged rows.
5.3. Dirty / diverged / rebase-in-progress rows are skipped with a reason, not merged "to be helpful."

### 4.6 Version and cascade

6.1. `localhelm bump <id> patch|minor|major` updates that project's root `package.json` version only, after a plan. It does not publish, does not tag, does not bump dependents.
6.2. After package A exists on npm at V, `localhelm cascade A` (or `cascade A --to V`) plans pin updates for every enrolled dependent whose specifier would not install V.
6.3. Cascade retargets registry pins to a caret (or the fleet's configured range policy) on V. It rewrites `link:` / `file:` to that registry pin only when the plan says so and the operator confirmed "leave local link" vs "switch to npm."
6.4. Cascade installs/updates the lockfile so the importer resolves to V. If the resolved version is not V, that dependent fails.
6.5. Cascade does **not** bump the dependent's own `version` field. A publisher that now carries a newer dependency is marked `pin-updated, own-version unchanged` so the operator can `bump` and publish later.
6.6. Topological order: update dependents of A, not A itself. If B depends on A and C depends on B's package, a single `cascade A` updates B's pin on A. It does not publish B or cascade B→C. A later `cascade B` does that after B is on npm. The UI must say this in one sentence so waves are obvious.
6.7. `ready` (or status filter) lists projects that look eligible to publish: local > npm, not private, git clean, no rebase. Optional `--with-tests` runs `pnpm test` / the project's test script and keeps the row only on success.

### 4.7 Catalog

7.1. `localhelm catalog` shows shelf name, catalog version, local version, npm version, gap (not on shelf).
7.2. `localhelm catalog sync` plans rewrites of catalog version display fields to a chosen source (default: npm latest when published, else local). Confirm writes.
7.3. Projects whose catalog value is not semver-like (`suite`, `pre-1.0`) are skipped unless the operator passes an explicit override map.
7.4. Catalog sync does not add new shelf cards in v1. Gaps are listed. Adding EmberDossier to `projects.js` stays a human edit (copy, members, links).

### 4.8 Dashboard

8.1. `localhelm serve` opens a loopback dashboard (LocalBerth lease when available; otherwise a documented default port). Same inventory as `status`.
8.2. Bind `127.0.0.1` by default. LAN bind is opt-in and warned. No auth in v1 because it is loopback.
8.3. Buttons call the same library as the CLI. The UI does not reimplement cascade, catalog rewrite, or git.
8.4. Plan → confirm → job log. Same as FilePress siblings in spirit.

### 4.9 CLI surface (v1)

```text
localhelm discover [--write]
localhelm enroll <path> [--npm name] [--catalog-name Name]
localhelm unenroll <id>
localhelm status [--json] [--fetch]
localhelm deps [<id>]
localhelm fetch
localhelm pull
localhelm bump <id> patch|minor|major
localhelm cascade <id> [--to <version>]
localhelm catalog [--sync]
localhelm ready
localhelm serve
```

Every mutating command prints a plan unless the operator already passed a confirm flag after seeing one.

### 4.10 House seed (documentation, not hardcoded forever)

The first fleet on the kickoff machine should be easy to enroll. Discover + a documented seed list, not magic:

**On the CF shelf today:** ForgeTrail (`forgetrail`), Smell Check (`smellcheck`), TemperPass (`temperpass`), xFacts family (hub + five label folders), FilePress (`getfilepress`), IngotVault, Finetuna, ollanet, Docupuncture, DictaWhisper, LocalBerth.

**Published, not on the shelf (2026-08-20):** EmberDossier (`get-ember-dossier`).

**Measured house edges (root or `site/package.json`):**

- Many `site/` packages → `getfilepress` `^0.1.8`
- `dictawhisper` → `ollanet` `^0.6.5`, `smellcheck` `^0.2.0`
- `filepress` (engine) → `ollanet` `^0.4.0` (behind local 0.6.6)
- `anticonfab` → `ollanet` `^0.4.1`
- `ingotvault`, `localslip` → `smellcheck` `^0.2.0`
- `catalyst-forge`, `ember-dossier`, `what-over-how` → `smellcheck` `link:../smellcheck`
- Several content repos → `getfilepress` as a site engine

The seed list will rot. The manifest is the source of truth after day one.

---

## 5. Non-functional requirements

- **Local-only.** No accounts, no telemetry, no hosted fleet. The public site is static FilePress, not the app.
- **Safety over speed.** A wrong pin across fifteen sites is worse than a slow status pass. Prefer failing a row to writing the wrong version.
- **Performance.** Status without `--fetch` should feel like a local disk walk plus one npm request per distinct package name (cache npm for a short TTL, show age). Do not `npm view` in a serial loop that takes minutes without a progress line.
- **Platform.** Windows, macOS, Linux. Kickoff machine is Windows. Paths, spawn, and git must work with `Z:\` and Git-Bash.
- **Privacy.** Fleet paths stay on disk. Job logs stay on disk. Do not upload inventory.
- **Compose, don't clone.** IngotVault, LocalBerth, and FilePress siblings keep their guarantees. LocalHelm reads and may invoke; it does not reimplement spare remotes, port leases, or `_headers` merge.
- **Agent-readable.** JSON inventory and plans are a v1 requirement. An MCP server can wait (see milestones). Do not make the only output a TUI that a script cannot parse.
- **Scale.** Comfortable at ~80 enrolled rows. Not a 5,000-repo enterprise fleet manager.

---

## 6. Edge cases the builder must handle

1. **Folder name ≠ npm name ≠ catalog name.** `filepress` / `getfilepress` / `FilePress`. Matching must use explicit manifest fields, not guessy lowercase equality alone.
2. **Local ahead of npm.** Cascade and site-pin installs must target published V, and say that local is unpublished. Same class of bug FilePress already hit.
3. **Local behind npm.** Status flags it. Cascade to "latest" would move dependents forward while this clone is old. Do not "helpfully" reset the local tree.
4. **`private: true` with a public-looking name.** No npm column as a publish target. Pins *to* it still count if someone listed an `npm` name by mistake; prefer the manifest.
5. **Missing `version`.** Allowed. Version cells are `n/a`. `bump` refuses.
6. **Unparseable `package.json` or catalog JS.** Fail that row, name the file, continue.
7. **Dirty tree on cascade.** Skip or refuse that dependent. Do not merge pin edits into unrelated dirty files.
8. **Partial dirty:** only the pin file is dirty from a previous failed job. Plan must show it. Apply may continue if the operator confirms.
9. **No git repo.** Status works. Commit actions skip with a reason.
10. **No `origin`.** Fetch/pull/push skip. Still a valid local project (IngotVault's reason for existing).
11. **Linked worktree.** Do not treat the worktree as a second project unless enrolled. Git writes go to the common repo.
12. **Submodules.** Skip as scan roots (`.git` file). Enroll only if the operator adds the path.
13. **Cycle A↔B.** Display. No automatic cascade apply.
14. **Diamond:** C depends on A and B; B depends on A. `cascade A` updates B and C's pins on A. C is not updated twice into a conflict. One write per file per job.
15. **`site/package.json` pin vs root pin.** Two files, two edges. Cascade updates each that names A.
16. **Workspace lock vs nested lock.** Prefer workspace lock. Fail if you cannot tell which importer would install.
17. **npm 5xx / offline.** Cached last-good with age, or cells show `npm unreachable`. Do not apply a cascade that needs a version you could not confirm.
18. **404 on a name you thought was public.** `unpublished`. Eligible for first publish. Cascade to that name is impossible until it exists.
19. **Catalog `v0.1.2` vs npm `0.1.2`.** Compare by stripping a leading `v`. Display can keep the `v` if the file already used it.
20. **Catalog non-semver.** Skip on sync.
21. **Two catalogs** (later). v1 may support one `projects.js`. A second catalog kind is out of v1 unless cheap.
22. **Operator runs cascade before publish.** Plan must refuse or warn: dependents cannot install V if V is not on the registry, unless they confirm `link:` to the local path.
23. **`prepublishOnly` already bumped version** (IngotVault-style gate). Status should not double-bump. `bump` is explicit.
24. **Concurrent dashboards.** One lock file for mutating jobs. Second `serve` can be read-only or can refuse.
25. **Path with spaces / Windows drive letters / mixed slashes.** Normalize. Do not store `Z:\` in a manifest that then fails on the same machine with `Z:/`.
26. **Discover noise.** `__ARCHIVE`, `__tmp`, `foo`, `test-project`, zip files, `desktop.ini`. Skip lists: `__*`, dot-dirs, `node_modules`, obvious non-dirs. Still do not auto-enroll.
27. **xFacts family.** Several folders, one shelf card (`suite`). Group them. Do not invent five catalog versions.
28. **Exec Foundry / other private commercial.** Enrollable. Never appear in a catalog sync that writes the public shelf.
29. **Ship script fails.** Job fails that row with Wrangler/stderr. Do not retry forever.
30. **Human publishes mid-job.** Re-read npm before each dependent install in a cascade, or at least before the job starts and if a row fails oddly.

---

## 7. Suggested milestones

**M1: Read-only fleet (smallest useful)**

- Manifest + enroll / unenroll / discover (print-only).
- `status` and `deps` with local version, npm latest, git porcelain.
- JSON export (generic schema; no catalog adapter). See §2.4 amendment: no `projects.js` in this package.
- An operator may seed a first fleet by hand from §4.10. That list is shop context, not product code.

**M2: Safe writes that pay for themselves**

- `catalog sync` for semver-like shelf versions.
- `bump` one project.
- `fetch` / `pull` (clean + behind only).
- Dashboard `serve` with the same inventory (no mutate yet, or mutate via CLI only if the UI is not ready).

**M3: Cascade**

- Plan/apply pin + lockfile updates for dependents of one published package.
- `link:` vs registry handled explicitly.
- `ready` list.
- Dashboard buttons for plan/apply/cascade/catalog, one job at a time, real logs.

**M4: Compose and agents**

- Optional LocalBerth lease for the dashboard; optional IngotVault backup column.
- Deep-link or subprocess to FilePress `sync-siblings` for getfilepress-only site work, or a documented "use that tool for headers."
- MCP server that exposes `status`, `deps`, and plans (no apply unless the operator enabled writes).

**M5: Polish (only if wanted)**

- Push selected `origin`s with a harsh confirm.
- Tag on bump.
- Watch list for a few outside packages.
- Add-a-shelf-card helper (still a human copy problem; easy to do badly).

---

## 8. Acceptance criteria

- Given a fleet manifest with FilePress, ollanet, and Smell Check, when `localhelm status` runs, then the table shows local versions matching each root `package.json`, npm latest for those names (or a named fetch error), and the CF shelf versions from `projects.js`.
- Given the 2026-08-20 numbers, when status runs against that tree, then FilePress, ollanet, LocalBerth, Smell Check, and Finetuna report catalog-stale.
- Given EmberDossier enrolled with `catalogName` set, when it is absent from `projects.js`, then status reports a catalog gap, not a version compare.
- Given `filepress` folder and npm name `getfilepress`, when status and deps run, then dependents of `getfilepress` (including `site/package.json` pins) attach to FilePress, not to a missing package called `filepress`.
- Given `catalyst-forge` pins `smellcheck` via `link:../smellcheck`, when `deps` runs, then that edge is `link`, not "on ^latest."
- Given ollanet local `0.6.6` and `filepress` pinning `ollanet` `^0.4.0`, when `deps ollanet` runs, then FilePress is behind if the lock/resolved version is not 0.6.x current.
- Given a cascade plan for package A at npm V, when a dependent is dirty with unrelated files, then apply skips or refuses that dependent and writes nothing there.
- Given a cascade plan when A@V is not on npm, when the operator did not confirm local `link:`, then apply refuses.
- Given `catalog sync` and a card `version: 'v0.1.2'` while npm is `0.1.8`, when apply runs, then only that version string changes (to the documented display form) and tagline/body are byte-identical.
- Given a catalog value `suite`, when `catalog sync` runs, then that card is skipped.
- Given `pull` on a dirty repo, when the job runs, then that repo is skipped and its working tree is unchanged.
- Given `bump filepress patch` at `0.1.8`, when apply runs, then only FilePress root `package.json` version becomes `0.1.9` and no publish occurs.
- Given two overlapping `localhelm` mutate commands, when the second starts, then it waits or exits with a lock error and does not interleave writes.
- Given `status --json`, when an agent reads the file, then every project has a stable `id`, path, and typed cells (no HTML-only view).
- Given `discover` on `Z:\workspace`, when it finishes, then `__ARCHIVE`, `node_modules`, and zip files are not proposed, and no manifest write happens without `--write`.

---

## 9. Open questions

1. **Domain.** **`localhelm.dev`** — secured. FilePress explainer **plus `/docs`**. Closed 2026-08-20.
2. **License.** **Apache-2.0**. Closed 2026-08-20.
3. **Commit on apply.** **Yes**, default on for cascade / export write. Message `Helm: retarget <pkg> to <version>.` No attribution trailers. Closed 2026-08-20.
4. **Push.** **Not in v1.** Fetch and pull only. Later milestone, harsh confirm. Closed 2026-08-20.
5. **Publish.** **Not in v1** (eligible badge). Future option; never the first ship. Operator publishes. Closed 2026-08-20.
6. **FilePress siblings.** Stay separate. Revisit absorb only after M3. Closed 2026-08-20.
7. **Default range policy.** Cascade writes **`^V`**. Closed 2026-08-20.
8. **Manifest.** `<workspaceRoot>/localhelm.fleet.json`, **`workspaceRoot` is `"."`**. User-global file is a fallback. Closed 2026-08-20.
9. **Groups.** Optional `group` on a fleet row. Shop-specific shelf grouping lives in the consumer. Closed 2026-08-20.
10. **MCP.** JSON in M1; MCP in M4. Closed 2026-08-20.
11. **Dashboard.** CLI + **SvelteKit**. FilePress `site/` + `/docs` for the public explainer. Closed 2026-08-20.
12. **Name.** **`localhelm`** reserved on npm as `0.0.0`. Closed 2026-08-20.

---

## 10. Explicit non-goals (v1)

- Not a monorepo. No merging of sibling git histories.
- Not a scan-everything git TUI. That is gita. Discover proposes; the fleet is enrolled.
- Not IngotVault. No spare remotes, no WIP capture, no force-with-lease to a mirror.
- Not LocalBerth. No claiming ports for other apps, no firewall, no process supervision.
- Not the FilePress sibling dashboard. No `_headers` merge, no engine-only pin rewriter inside this package.
- Not Lerna. No unified version, no automated publish train.
- Not Dependabot. No PRs to strangers, no CVE theater as the homepage.
- Not a remote fleet manager. No SSH, no agents in other houses, no Cloudflare token vault.
- No LLM choosing versions, commit messages, or which dependents to skip.
- No auto-publish, no force-push, no rewriting unrelated dirty files.
- No starting/stopping dev servers in v1.
- No rewriting CF marketing copy. Catalog sync is version fields only.
- No "create a new sibling product" scaffolder in v1.

---

## 11. What success looks like

After you publish `getfilepress` or `smellcheck` or `ollanet`, you run `localhelm status` (or open the dashboard) and see who is still on last week's pin, which shelf cards are stale, and which clones are dirty. You confirm a cascade. Each consumer gets a pin and lockfile update, or a skipped row with a reason. You confirm a catalog sync. The public shelf matches npm. You still type `pnpm publish` yourself, in the package that earned it, one at a time.

The next dozen tools do not need a better memory. They need a helm.
