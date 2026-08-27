# Cheap surfaces — LocalHelm

**Spec kind:** Delivery  
**Status:** Draft (2026-08-25) — H1–H5 landed  
**Related:** `docs/PHASE_1_BRIEF.md` §10–11, `TODO.md` M4, `.forgetrail/IDEAS.md`, sibling [`localberth/docs/specs/cheap-surfaces.md`](../../../localberth/docs/specs/cheap-surfaces.md)  
**Surfaces:** Today / Fleet / Ports host, CLI `status` / export, activity log

Pairing: **LocalBerth is the slip. LocalHelm is the wheel.** This spec is what the wheel can show or host. Port lifecycle, logs, and park stay on LocalBerth.

---

## 1. Problem

The board already walks git, npm, pins, FilePress, and LocalBerth. Most of the next value is **already on disk** and not on the glass. The operator still opens a folder, a log, or a second CLI to answer questions the dashboard just computed.

This week proved the pattern: a missing recipe, a hyphenated folder, and a leaked `PORT` were all **facts we had or could have shown**. The expensive part was not knowing.

**Friction today:** Today is “needs a write.” It is not “needs a look.” Quiet stacks, parked products, and “what should I tell the next agent” are still tribal.

---

## 2. Goals

1. Surface facts we already read (git, npm, plugins, activity) before adding new daemons.
2. Soft-archive a product so it leaves the morning board without deleting a folder or releasing a port.
3. Give the next session a one-screen brief it can paste.
4. Keep every write plan-then-confirm. LocalHelm still does not spawn process trees.

### Non-goals

- Reverse proxy, `*.localhost`, remote fleets, telemetry, LLM skip-lists.
- Reimplementing leases, firewall, or FilePress ship.
- Moving checkouts on disk in v1 of archive (see §5.2).
- Killing observed-only processes.
- Auto-starting the whole shop on login.

---

## 3. In flight (do not redo)

| Item | Where | Note |
| ---- | ----- | ---- |
| MCP for status / deps / plans | `TODO.md` M4 | Still the agent API. A **brief** (below) is the cheap preview; MCP can wrap it later. |
| FilePress `site/` + `/docs` | Later | Public explainer; not a dashboard feature. |
| IngotVault column | M4 | Compose; do not reimplement remotes. |
| Tag on bump | Later | Fine after cheap Today work. |
| Watch list (packages outside the fleet) | `IDEAS.md` | Keep. Cheap if it is names + `npm view`, not a second fleet. |
| npm lookup progress line | `IDEAS.md` | Keep. Status already fans out one request per name. |
| Ports start/stop + recipe guess | Shipped | Hyphen fold + `-api` strip shipped 2026-08-25. |

---

## 4. Core concepts

| Term | Meaning |
| ---- | ------- |
| **Family** | Lease / fleet ids that share a stem (`dictawhisper`, `dictawhisper-api`, `dictawhisper-site`). Hyphens fold. |
| **Park** | LocalBerth: stop + hide + **keep the port**. See the sibling spec. |
| **Archive** | LocalHelm: hide from Today (and optionally Fleet) **without** unenroll-delete. Path stays. Restore is one confirm. |
| **Brief** | Markdown of Today + listening Ports, for a human or an agent session start. |
| **Look** | A Today card that is not a gold write — recipe missing, park candidate, family split (UI up, API down). |

---

## 5. Proposed surfaces

Cost: **Free** = format or filter existing JSON. **Cheap** = one extra local command or a small JSON file. **Dear** = new daemon, network, or disk moves.

### 5.1 Free — show what we already know

**F1. Family on Today and Ports host.** Group `dictawhisper*` as one stack. One line: UI listening / API down / site down. Jump to Ports with `?tab=ports&leases=…`. No new persist.

**F2. Cross-walk.** Same id on Fleet, Sites, and Ports is one product. Cheap chips: “Ports” / “Site” / “Package” that only appear when the plugin board has that id. Click sets the URL we already own (`tab`, `leases`, `fleet`).

**F3. Look cards (not writes).** Today already hides “all quiet” until status is ready. Add non-write looks:

- Lease with no recipe (from Ports plugin rows).
- Recipe `cwd` missing (plugin cell or reason).
- Family split: one sibling listening, another not.
- Fleet id with no lease (and the reverse: lease with no fleet row) — **diff enroll vs slips**.

**F4. Publish confirm: commits since last npm.** We already have local version + `git`. `git log --oneline` from the tag or `v$local`..HEAD (skip if no tag). Stops “what am I shipping?” The confirm modal already lists rows. **Cut version** uses the same count on origin (status `commitsSinceNpm`); hide the button and skip the plan when the count is 0.

**F5. Last commit age.** One `git log -1 --format=%cs` per enrolled path (or parse from existing `git status` porcelain if we add `-z` later). Badge: “90 days since a commit” is a look, not a write.

**F6. Session brief.** `localhelm brief` (and a Today button that copies). Markdown: needs-you, dirty, unpublished, Ports down-with-recipe, last 5 activity titles. This is the free MCP. Agents already start by reading CONTEXT; a live brief is better.

**F7. Copy path / copy listen URL.** Fleet row and Ports Open already have the path and the URL. A copy control is UI only.

**F8. Env the start will inject.** Ports confirm already shows the recipe. Add `PORT=<lease> HOST=<bind>` on the same line. That is how the 7777→8008 leak becomes visible **before** confirm.

**F9. Activity → row.** Activity JSON already has titles like `localberth start dictawhisper`. Link the id if it matches a fleet or lease.

**F10. Site vs package already labeled.** Keep. Do not add a third name.

### 5.2 Cheap — thin persist or a thin write

**C1. Archive (operator-asked).**

- **Not** `unenroll` (that drops the row). **Not** delete. **Not** `release` (that frees the port).
- Persist `.localhelm/archive.json` (gitignored, next to activity): `{ ids: string[], archivedAt }`.
- Today and default Fleet omit archived ids. A small “Archived (N)” toggle or Fleet filter shows them. Restore confirms and removes the id.
- Optional confirm extra: “Also park LocalBerth leases in this family” — **plan only**; apply calls the LocalBerth plugin `park` (sibling spec). LocalHelm does not stop processes itself.
- **Not in this slice:** moving the folder to workspace `__ARCHIVE/`. The machine already has that folder as a human habit. A later plan can propose `git` + move with a harsh confirm. v1 archive is visibility.

**C2. Save recipe without start.** Ports confirm today saves on Start. A “Save guess” that applies `recipe` only (`writes: true`, no spawn) is a LocalBerth plugin action. LocalHelm hosts the button.

**C3. Guess all missing recipes.** One plan: every lease with no cwd. Confirm writes recipes only. Start stays per row or family.

**C4. Watch list.** `localhelm.fleet.json` or a sibling `watch` array of npm names. Status already knows `npmLatest`. Today: “ollama is 0.x behind” without enrolling a repo.

**C5. npm progress.** Status fan-out already exists. A header “checking 8 / 15 names…” is a busy label, not a new API.

**C6. Family start/stop.** Toolbar on Ports: Start family / Stop family. Plan lists each lease LocalBerth would write. Same plugin apply, multiple ids. We already have bulk lease checks (`?leases=`).

**C7. Quiet sites.** Stop every `*-site` lease that is listening, minus `always` kinds if LocalBerth exposes `kind`. Confirm lists names. Night / meeting button.

### 5.3 Later / dear (parked here so we do not pretend they are cheap)

- MCP (M4) — do brief first.
- IngotVault column — compose when the plugin exists.
- Tag on bump.
- FilePress public site.
- Disk `node_modules` sizes, npm pack audits, trusted-publish migration.
- Hard archive (move to `__ARCHIVE/`).

---

## 6. Data

| Store | Role |
| ----- | ---- |
| `localhelm.fleet.json` | Enrollment. Unchanged by archive. |
| `.localhelm/archive.json` | Hidden ids. Gitignored. |
| `.localhelm/activity.json` | Brief + F9. Already shipped. |
| Plugin boards | Recipes, listen, family. Source of truth on LocalBerth / FilePress. |

No new cloud. No schema in a sibling database from this package.

---

## 7. UX rules (from this week)

- Status must finish before empty states claim “missing” or “all quiet.”
- Confirm dismisses on yes; header keeps Working.
- Confirm lines show the **command**, not `start start …`.
- Skip lines are not recipes. Do not wrap mid-token.
- LocalHelm never `git push --force`. Never spawn the tree.
- A need that can write is a button on that row (`Push 15`, `Publish 0.0.1`). Do not make the operator select the row and hunt a toolbar.
- Long plugin notes live in a ? tip, not the section head. Section heads stay one line so toolbar buttons do not wrap under a wall of text.
- Ports **Stacks** is a table: one row per family with its own Start/Stop. Cross-walk chips jump to the other board for the same id.

---

## 8. Edge cases

| Risk | Mitigation |
| ---- | ---------- |
| Archive mistaken for delete | Copy: “Hides on Today. Folder and port stay.” |
| Park + archive double-hide | Archive is Helm visibility; park is Berth. Restoring archive does not unpark unless the confirm said so. |
| Family stem collision (`file` vs `filepress`) | Stem = id minus `-site`/`-api`, hyphen-folded, longest prefix among enrolled/leased names — not a substring of an unrelated id. |
| Brief goes stale | Brief is a point-in-time read, like status. No cache across days. |
| `__ARCHIVE` move later | Separate spec. Never implied by C1. |

---

## 9. Milestones

| Milestone | Outcome |
| --------- | ------- |
| H1 | F1 family + F3 look cards + F8 PORT/HOST on confirm |
| H2 | F6 `localhelm brief` + copy |
| H3 | C1 archive hide/restore |
| H4 | C6 family start/stop (plugin ids only) |
| H5 | C2/C3 save-guess without start |

---

## 10. Acceptance (when a slice is built)

1. Given three `dictawhisper*` rows, Today shows one family with listen bits, not three unrelated needs.
2. Given archive of `temperpass`, Today omits it; the folder is untouched; Restore puts it back.
3. Given `localhelm brief`, the markdown lists current dirty / unpublished / down-with-recipe without writing disk except optional copy.
4. Given Ports Start confirm, the list includes `PORT` and `HOST` for that lease.
5. Given family Stop, the plan names each lease; Cancel leaves processes up.

---

## 11. Open questions

| # | Question | Blocking? |
| - | -------- | --------- |
| 1 | Default Fleet: hide archived, or only Today? | no — Today-only is enough for H3 |
| 2 | Is `group` on the manifest enough instead of inferred family? | no — infer first; `group` can override later |
| 3 | Should brief include FilePress ship-behind? | no — add when H1 is boring |

---

## 12. Decisions (draft, not logged until you pick)

**D-draft-1.** Archive is hide, not unenroll, not folder move.  
**D-draft-2.** Family is inferred from ids; LocalHelm does not invent new lease names.  
**D-draft-3.** Brief is a read. MCP can wait.

---

## Progress

- `2026-08-25:` Draft after Ports start/stop, recipe guess (`-site`/`-api`, hyphen fold), and the dictawhisper `PORT` leak.
- `2026-08-25:` H1 landed — family cards, look cards, `PORT`/`HOST` on Ports confirm. H2–H5 still unscheduled.
- `2026-08-25:` H2–H5 landed — `brief`, archive hide/restore, family start/stop, save-guess. Today Ports is one column with titled Stacks / Down lists.
- `2026-08-25:` C7 quiet, F2/F7/F9 cross-walk + copy + activity links, C3 guess-all. Tippy for labels and recipe/family facts.
- `2026-08-25:` Attention UX — Ports actions on one line; stack chips labeled; Sites/Ports notes in ? tip; Fleet needs you is the row write.
- `2026-08-27:` Stacks subtab is a table with per-row Start/Stop. Chip-then-toolbar select is gone.
