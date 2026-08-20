ForgeTrail Lite — portable kickoff protocol. Save to `.forgetrail/FORGETRAIL_LITE.md` in the app repo (or paste into chat). See §1 for drop-in vs paste vs rules options.

# ForgeTrail Lite — portable kickoff for any agentic chat

> **ForgeTrail Lite v2.0.0**
> © Catalyst Forge, LLC — [www.catalystforge.com](https://www.catalystforge.com)
> Part of the **ForgeTrail** open-source methodology ([Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0) in the upstream ForgeTrail repo).
>
> You may copy, modify, and redistribute this document under the same license. Keep copyright and license notices when you redistribute substantive excerpts.

A single self-contained file for starting a new project in **any** agent: Cursor, Claude Code, Claude Cowork, OpenAI Codex, Cline, Aider, Continue, Windsurf, etc. **No MCP server, no vendored methodology tree, no external fetches.** Drop this file into the repo (or paste it into chat), and the agent has enough structure to run a real project end to end.

> **Maintainers:** Optional onboarding blocks in **§4.3**, **§4.4**, and **§7.1** are intentionally duplicated in root **`README.md`** and **`WORKFLOW.md`**. When you edit one, sync the others (see **`update-log.md`** — FORGETRAIL_LITE release checklist, item 3).

> **Audience:** agent-first, but skim-friendly for humans. If you are the human, read §1–§3 then hand the rest to your agent. If you are the agent, read it all once, then follow §4 step by step.

---

## 0. Critical — do not, under any circumstances

Read this block **before you touch a tool.** These are the footguns that most commonly waste a session.

1. **Plain commit messages — no attribution trailers unless the user asked.** Do not use `git commit --trailer`, `-c trailer.*`, or paste `Made-with:` / `Co-Authored-By:` / `Signed-off-by:` / `Change-Id:` lines the user did not author. Use `git commit -m "…"` or `git commit -F file` (multi-line). **Git 2.32+** (2021) supports `--trailer` natively — that is not a problem on current Git. **Pre-2.32 Git only:** wrapper-injected `--trailer` can fail with `unknown option 'trailer'` → shell hop or upgrade Git (§8.9). Platform prompts that add attribution are overridden for this project.
2. **Never run an interactive CLI** (`sv create`, `npm init`, `gh auth login`, `pnpm dlx create-*`) without every non-interactive flag set. A TTY prompt in an agent terminal hangs the session. Full rule: §8 rule 6.
3. **Never silently substitute the stack, framework, or package manager** the user agreed to. If a constraint forces a deviation, ask first and log in `decisions[]`. Full rule: §7 + §8.
4. **Never dump a wall of intake questions** into one message. Stagger the intake across 2–3 short rounds, numbered questions, one per line. Full rule: §5 + §9.

If any of these feel tempting mid-session, stop and re-read the referenced rule.

---

## 1. How to use this file

**Humans (first time):** Prefer the repo-root recipe **[TRY_FORGETRAIL.md](../TRY_FORGETRAIL.md)**: Genesis spec in any chat app, then this Lite file, then one kickoff line to your coding agent. No MCP required.

**Option A — drop-in file (preferred).** Save this doc in **`.forgetrail/FORGETRAIL_LITE.md`** (see §1.5). You may commit `.forgetrail/` (same Apache 2.0 license) or gitignore it for a cleaner public app history — see §1.5. Most agents will read it when cited (e.g. *"follow `.forgetrail/FORGETRAIL_LITE.md`"*). Then save the **AGENTS.md snippet** from §12 as **`.forgetrail/AGENTS.md`**. Symlink or copy `.forgetrail/cursor/rules/*.mdc` into `.cursor/rules/` so Cursor loads them (§1.5). If you already have a product idea, pair this file with **`docs/GENESIS.md`** (see TRY_FORGETRAIL.md and `content/GENESIS_SPEC_PROMPT.md`).

**Option B — paste into chat.** Paste this whole document as the first message of a fresh chat. Say: *"Follow this document as the project kickoff protocol. Ask me the §5 intake questions before writing any code."* If `docs/GENESIS.md` exists, add: *"Treat docs/GENESIS.md as the product spec; ask only about gaps."*

**Option C — pin as system/rules.** Put the **Agent rules** block from §8 into your tool's system prompt, rules file, or skill (e.g. Cursor `.cursor/rules/forgetrail.mdc`, Claude Code `CLAUDE.md`, Codex `AGENTS.md`).

Any of the three works. A + C together is best. For a written pre-Phase-1 spec, A + **`docs/GENESIS.md`** is the Try path.

---

## 1.5 ForgeTrail workspace — `.forgetrail/` (Lite and MCP)

ForgeTrail agent artifacts (protocol, tracking, platform rules) live in **`.forgetrail/`** at the repo root — **whether you bootstrap via ForgeTrail Lite file copy or MCP greenfield.**

**Upstream ForgeTrail is open source** (Apache 2.0). In your app repo, **`.forgetrail/`** holds agent artifacts — tracking, optional Lite copy, platform rules. **MCP greenfield** projects often need only **`.forgetrail/workflow_tracking.json`** (methodology via MCP tools; no vendored Lite file). **Lite file bootstrap** may copy `FORGETRAIL_LITE.md` here; you may **commit** `.forgetrail/` under the same license or **gitignore** it to keep the public repo focused on app code and to avoid duplicating a large protocol when MCP already serves updates. Never commit **secrets** (`.env`, API keys) inside tracking or rules.

```
.forgetrail/
  FORGETRAIL_LITE.md          ← this document (copy from upstream)
  FORGETRAIL_LITE_UPDATES.md  ← feedback log (optional)
  AGENTS.md                 ← §12 snippet
  CLAUDE.md                 ← §12.5 snippet (Claude Code)
  IDEAS.md                  ← backlog parking lot
  workflow_tracking.json    ← §11 starter / live tracking
  cursor/rules/             ← §12.5 Cursor rule snippets
    forgetrail-no-trailer.mdc
    forgetrail-updates-log.mdc
  README.md                 ← local setup notes (optional; upstream: forgetrail-workspace-README.md)
```

**`.forgetrail/` in git — decide once (§4.2 steps 2–5):**

| Choice | When | `.gitignore` | Bootstrap commit includes |
|--------|------|--------------|---------------------------|
| **A — Commit `.forgetrail/`** (Lite default) | Self-contained history; tracking and rules travel with the repo | Do **not** list `.forgetrail/` | `.forgetrail/` artifacts from steps 3–4 (tracking, `AGENTS.md`, rules, optional Lite copy) |
| **B — Gitignore `.forgetrail/`** | Cleaner public app repo; MCP serves methodology; avoid vendoring a large Lite file on GitHub | Add `.forgetrail/` | `.gitignore` only (+ any `.cursor/rules/` copies you symlinked for IDE load) — agent workspace stays local |

Log the choice in **`decisions[]`** (e.g. *"ForgeTrail workspace: commit .forgetrail/"* or *"… gitignore .forgetrail/"*). Never commit **secrets** (`.env`, API keys) inside tracking or rules regardless of branch.

**Cursor / IDE wiring (local only):** tools read `.cursor/rules/` and repo-root `AGENTS.md` by default — not `.forgetrail/`. After creating `.forgetrail/`, either:

- **Symlink** (recommended): copy or link the two `.mdc` files into `.cursor/rules/`; or
- **Cite explicitly** each session: *"follow `.forgetrail/FORGETRAIL_LITE.md`"* and *"read `.forgetrail/AGENTS.md`"*.

Product docs (`README.md`, `CONTEXT_PROMPT.md`, `docs/PHASE_1_BRIEF.md`) stay **outside** `.forgetrail/` and **are** committed.

---

## 1.6 Protocol feedback log (optional, local)

When a boot surfaces a gap in **ForgeTrail Lite itself** (not a one-off app bug), capture it in **`.forgetrail/FORGETRAIL_LITE_UPDATES.md`** so it can be merged back into upstream `FORGETRAIL_LITE.md` without losing context.

- **Upstream template:** `forgetrail/content/FORGETRAIL_LITE_UPDATES.md` (empty starter — copy into `.forgetrail/`).
- **Cursor rule:** `.forgetrail/cursor/rules/forgetrail-updates-log.mdc` (§12.6) — symlink into `.cursor/rules/` with the no-trailer rule (§1.5).
- **Log session-local incidents** in `.forgetrail/workflow_tracking.json → `gotchas[]` instead — routine bugs and product-only notes do not belong in the updates file.
- **Write for maintainers:** what went wrong, which Lite § should change, optional pointer to this repo. Tighten or cross-link if the topic is already covered.

---

## 2. What this is (and what it is not)

**ForgeTrail Lite is** a minimal, stack-agnostic project kickoff protocol: a 7-phase lifecycle, a Phase 1 product brief, a single tracking file, a few baseline docs, and a set of guardrails that keep agents from shipping a half-built spine or silently swapping your stack.

**It is not** the full ForgeTrail methodology — no audit prompts, no deep per-phase playbooks, no lessons database, no template library. For those, use the ForgeTrail MCP server (see §13). Lite gets you ~80% of the value in one file.

### Who creates what

The **human** only needs to do two things: copy ForgeTrail Lite into **`.forgetrail/`** (or paste this doc into chat), and tell the agent to follow it. **Everything else is created by the agent** as it works through the phases. You should never be asked to hand-write `.forgetrail/workflow_tracking.json`, `.forgetrail/AGENTS.md`, the brief, `CONTEXT_PROMPT.md`, or the Phase 2 baseline files — the agent writes them and shows them to you for review.

| File / folder | Who creates it | When |
|---|---|---|
| `.forgetrail/` + git policy (commit or gitignore — §1.5) | **Human or agent** (first session) | Before first commit on a published repo |
| `.forgetrail/FORGETRAIL_LITE.md` | **Human** (once, from upstream) | Before the first agent session |
| Git repo (`.git/`) + initial commit | **Agent** (runs `git init` if missing) | First session, before Phase 1 intake |
| `.forgetrail/AGENTS.md` | **Agent** (from §12 snippet) | First session, right after reading this file |
| `.forgetrail/cursor/rules/forgetrail-no-trailer.mdc` | **Agent** (from §12.5 snippet) | First session — symlink/copy to `.cursor/rules/` for Cursor |
| `.forgetrail/cursor/rules/forgetrail-updates-log.mdc` | **Agent** (from §12.6 snippet) | First session — symlink/copy to `.cursor/rules/` for Cursor |
| `.forgetrail/FORGETRAIL_LITE_UPDATES.md` | **Agent** (from upstream template) | Optional — when logging Lite protocol gaps (§1.6) |
| `.forgetrail/workflow_tracking.json` | **Agent** (from §11 starter) | First session |
| `docs/FORGETRAIL_PROGRESS.md` | **Agent** (template + refreshed on phase changes / status script) | Phase 2+ (§4.6) |
| `setup.bat` / `setup.sh`, `run.bat` / `run.sh`, `status.bat` / `status.sh` | **Agent** | Phase 2 when local dev needs repeatability (§4.5) |
| `test-pocketbase.bat`, `test-ollama.bat`, `setup-ollama.bat` (+ `.sh`) | **Agent** | Phase 2 per stack (§4.7–§4.8) |
| `scripts/forgetrail-dev-launcher.mjs`, `scripts/setup-pocketbase.mjs`, `scripts/test-*.mjs`, `scripts/setup-ollama.mjs` | **Agent** (from upstream `content/scripts/`) | Phase 2 |
| `.forgetrail/IDEAS.md` | **Agent** | Phase 2 (see §14) |
| `docs/` folder | **Agent** | Phase 1, when creating the brief |
| `docs/PHASE_1_BRIEF.md` | **Agent** (from §6 template) | Phase 1, based on user answers to §5 intake |
| `CONTEXT_PROMPT.md` at repo root | **Agent** (from §10 template) | Start of Phase 2, by merging the locked brief |
| `package.json` + `pnpm-lock.yaml` + `tsconfig.json` | **Agent** (runs `pnpm init` / stack scaffolder + `pnpm install`) | Start of Phase 2 — for the **default SvelteKit web app**, these live under **`app/`** (see §4.2 step 10), not the repo root, because Lite already added files at the root first |
| `README.md`, `TODO.md` | **Agent** | Phase 2, once the spine runs (see §14) |
| `.env.example`, `.gitignore` | **Agent** | Phase 2, when first code needs them (see §14) |
| Phase 3–7 docs (test plan, runbook, etc.) | **Agent** | As each phase needs them |
| `data/seed-*.json`, `fixtures/*.json` (optional) | **User** (often via another LLM + §4.3 prompt) → **Agent** validates & imports | Phase 2+ when dev/demo/seed data is needed; repeat per dataset |

If an agent ever asks *you* to create one of these files by hand, or to run `git init` / `pnpm install` yourself, point it back to this section. **Exception:** optional JSON seed files are often **user-originated** (copy-paste from a chat) — still expect the **agent** to place them, validate, and wire imports.

---

## 3. The lifecycle (7 phases, deep on 1 & 2)

Every project flows through these phases. The agent **pauses at every phase transition for explicit user approval** before advancing — no silent progression.

| # | Phase | Entry | Exit |
|---|-------|-------|------|
| **1** | **Plan** | user has a rough idea | `docs/PHASE_1_BRIEF.md` is complete and **locked**; stack, hero flow, v1 scope, and major decisions are in `.forgetrail/workflow_tracking.json → decisions[]` |
| **2** | **Build (spine)** | Phase 1 brief is locked | a **runnable end-to-end hero flow** exists in one pass: project init, deps installed, data path working, routes + components + hero journey wired, `CONTEXT_PROMPT.md` written by merging the brief |
| 3 | Stabilize | spine runs | critical bugs fixed, error paths handled, the happy path + 1–2 known sad paths are reliable |
| 4 | Iterate | hero flow is solid | secondary features land one at a time; each complex feature has a short **delivery spec** (§3.1) before multi-file work; each ships with tests or at least a manual test note |
| 5 | Refine | feature set feels complete | refactor for clarity, split modules, remove dead code, tighten types/validation |
| 6 | Align | code is clean | brand, naming, copy, and UX are coherent; `README.md` matches reality |
| 7 | Harden | product is coherent | security review, performance pass, deploy pipeline, docs for the next operator |

**Deep focus in Lite:** Phases **1** and **2**. Most projects die because the brief was skipped and the spine was half-built. Phases 3–7 are real but mostly need the user to say "let's move on" — the agent's job after Phase 2 is to keep `.forgetrail/workflow_tracking.json` current and not regress.

**Project archetype (scale the lifecycle to the project):** During Phase 1 intake, classify the project and record it in the brief, `decisions[]`, and `project.archetype` in the tracking file:

- **`product`** (default) — others will use it, maybe pay for it. Full 7-phase lifecycle.
- **`internal-tool`** — real recurring users, no market. Phase 6 (Align) optional; Phase 7 keeps security/deploy/docs but drops payments, business plan, and marketing criteria.
- **`one-shot`** — keepsake, gift, event, or demo built for one occasion. Phases 1–4 scaled down; phases 5–7 collapse into one **polish + ship** gate: works on the target device (usually a phone), no dead ends, `prefers-reduced-motion` respected, personal/placeholder content filled, deployed or handed off. Emotional polish outranks hardening depth here.

When archetype ≠ `product`, **prune** the non-applicable exit criteria in the tracking file once (and log the pruning in `decisions[]`) instead of annotating them "N/A" forever. If the project outgrows its archetype (a one-shot grows accounts), flag it and propose re-promoting to `product`.

**Wrap (when the project ends):** Finishing a project includes **harvesting** it. When the app ships, is delivered, or is intentionally shelved: sweep `gotchas[]` + `decisions[]` for lessons that generalize beyond this app (framework traps, CLI changes, integration surprises), record them in `FORGETRAIL_LITE_UPDATES.md` (§1.6) or propagate to the upstream ForgeTrail repo if you have one, set `project.status` to `"wrapped"`, and add a final `sessions[]` entry with the end state (deploy URL, handoff notes). Small projects often surface the freshest tooling gotchas — do not let them die in the repo.

### 3.1 Feature specs (Phase 4+)

**When to write one:** before any change that touches **more than ~3 files**, changes data shape, or will span sessions. Skip for typos and one-file tweaks.

**Where:** `specs/[feature-name].md` (kebab-case). Link it from `TODO.md` as an open checklist item pointing at that path.

**Lifecycle (when you have more than a handful of specs, or from the first multi-file feature):**

- `specs/` — not started
- `specs/partial/` — work started; move here when implementation begins
- `specs/completed/` — acceptance criteria met + **Implementation summary** at the end
- `specs/canonical/` — living references only (no delivery lifecycle)

**Skeleton (Lite cut).** Copy into `specs/[feature-name].md`. For the full skeleton (data/API/UI subsections, milestones, decisions), use ForgeTrail **`docs/SPEC_FEATURE_TEMPLATE.md`** or MCP `getTemplate({ name: "SPEC_FEATURE_TEMPLATE" })`.

```markdown
# [Feature name]

**Spec kind:** Delivery
**Status:** Draft
**Related:** TODO.md — [short title]

## 1. Problem

## 2. Goals

### Non-goals

## 3. Proposed behavior

## 4. Edge cases

## 5. Acceptance criteria

1. Given …, when …, then …

## 6. Open questions

## Implementation summary

(Filled when moving to specs/completed/)
```

Do **not** scaffold or refactor from a vague chat request when a spec is warranted. Draft the skeleton, get a quick user nod on goals/non-goals/AC, then build. On finish: mark TODO `[x]`, fill Implementation summary, move to `specs/completed/`.

---

## 4. First actions for the agent (in order)

The agent **creates every file below itself** and **runs every setup command itself** — do not ask the user to hand-author files or run `git init`, `pnpm init`, or `pnpm install` manually. If a path does not exist, create the parent directory first.

**§4 map (reading order):** **4.1** universal preflight → **4.1.1** GitHub push identity → **4.1.2** stack-conditional checks (Phase 2 entry) → **4.2** ordered bootstrap steps → **4.2.1** env vars → **4.2.2** PocketBase install → **4.3** optional JSON seed → **4.4** optional web search → **4.5** one-click launchers → **4.6** phase progress → **4.7** health checks → **4.8** local Ollama.

### 4.1 Preflight: check required tools (git, Node.js, npm, pnpm)

Before touching files or running setup, verify the tools this protocol depends on are available. **Order matters:** **Node.js** and **npm** must exist before **pnpm** (corepack and `npm install -g pnpm` both need them). If something is missing, **offer a concrete install path or a documented fallback** — do not silently skip or guess.

**Git** (needed from step 2 onward):

1. Run `git --version`. If it prints a version, continue.
2. If it errors or returns "command not found," stop and ask the user. Detect OS and offer **one concrete install path** plus the choice to proceed without git:
   - **Windows:** `winget install --id Git.Git -e --source winget` (winget is built into Windows 11 and recent Windows 10). Fallback: download from <https://git-scm.com/download/win>.
   - **macOS:** `xcode-select --install` installs the Command Line Tools (includes git). Alternative: `brew install git` if Homebrew is present.
   - **Linux:** `sudo apt install git` (Debian/Ubuntu), `sudo dnf install git` (Fedora/RHEL), `sudo pacman -S git` (Arch), or the distro equivalent.
   - **Ask the user:** *"Git isn't installed. I can wait while you install it with `<OS-specific command>`, or we can proceed without source control for now and you can add git later. Which would you prefer?"*
3. If the user proceeds **without git**, enter **no-git mode**: skip step 2, step 5, and the commits in step 12. Set `.forgetrail/workflow_tracking.json → project.sourceControl = "deferred"` and append a `gotchas[]` entry noting git is not yet installed. Treat "install git + run the missed commits" as a Phase 7 hardening task. Never pretend commits happened.
4. The agent **must not install git itself** — always run the install command by asking the user to execute it, or instruct them to run it in their own terminal. System-wide installs require user consent.
5. **Note the git version.** **`git commit --trailer`** exists from **Git 2.32.0** (2021). Assume **2.32+** on normal dev machines. **Pre-2.32 only:** injected `--trailer` can error with `unknown option 'trailer'`; upgrade Git or use the legacy shell-hop in §8.9. ForgeTrail still bans **unrequested attribution** in messages on every version (§8.9).

**Node.js** (needed before pnpm and from step 10 onward):

1. Run `node --version`. If it prints a version, continue.
2. If it errors or returns "command not found," stop and ask the user to install **Node.js LTS** before Phase 2 scaffold:
   - **Windows:** `winget install OpenJS.NodeJS.LTS` or download from <https://nodejs.org/>.
   - **macOS:** `brew install node` or the LTS installer from <https://nodejs.org/>.
   - **Linux:** distro packages (`nodejs` / `nodejs-lts`) or NodeSource / nvm — prefer **20+** to match Lite defaults (§7).
3. **Minimum versions:** **Node 20+** recommended (Default A/B stack). **Node 16.13+** is the floor for **corepack**-based pnpm bootstrap only — if the machine is older, ask the user to upgrade Node before continuing.
4. The agent **must not install Node system-wide** without user consent — same as git: give one concrete command, wait, then re-check.

**npm** (bundled with the official Node.js installer; needed to install pnpm when corepack is unavailable):

1. After Node is present, run `npm --version`. If it prints a version, continue.
2. If `node` works but `npm` is missing, the install is incomplete or PATH is wrong — ask the user to **reinstall Node.js LTS** from <https://nodejs.org/> (the official installer includes **npm** and **corepack**). Do not proceed to pnpm until `npm` resolves.
3. **npm is not the package manager for Lite projects** — it is only a **bootstrap tool** to reach pnpm (`npm install -g pnpm`) when corepack does not activate pnpm. Never substitute `npm install` for `pnpm install` in the app repo without an explicit user decision logged in `decisions[]`.

**pnpm** (needed from step 10 onward — install **after** Node and npm):

1. Run `pnpm --version`. If it prints a version, continue.
2. If it errors, try **corepack** first (ships with Node 16.13+):
   - Run `corepack enable`, then `corepack prepare pnpm@latest --activate` (or the version in `packageManager` once `package.json` exists), then re-check `pnpm --version`.
3. If corepack is unavailable or still doesn't resolve pnpm:
   - Confirm **`npm --version`** works, then ask the user to run **`npm install -g pnpm`** (may need admin / sudo). Re-check `pnpm --version`.
4. **Do not silently fall back to `npm` or `yarn` for project installs.** Lite's defaults are pnpm-anchored (lockfile, workspace semantics, script conventions). If the user truly cannot install pnpm (rare — locked-down machine), stop and discuss before picking an alternative, and log the deviation in `decisions[]`.
5. **Native addons (pnpm v9+).** If install logs say **"Ignored build scripts"** for packages like **`better-sqlite3`**, add at the **workspace root** `package.json`:
   ```json
   "pnpm": { "onlyBuiltDependencies": ["better-sqlite3"] }
   ```
   (List every native module that needs a postinstall build. A child-package field may be ignored — **root is authoritative.**) Re-run `pnpm install` before debugging runtime "module not found" errors.

**Install/bootstrap scripts (Node):** If you add or maintain scripts that download, extract, or transform files via the shell, **branch on `process.platform === 'win32'`** (or equivalent) before invoking **`tar`**, **`unzip`**, **`curl`**, **`sed`**, **`awk`**, or **`openssl`**. On Windows those command names are ambiguous — multiple implementations share the name and **PATH order** decides which runs (see §13). Prefer **PowerShell** built-ins (`Expand-Archive`, `Invoke-WebRequest`) or **`C:\Windows\System32\tar.exe`** by absolute path on Windows; keep `tar`/`unzip`/`curl` as the macOS/Linux branch. See §8 rule 10.

Only after **§4.1** universal preflight passes (or the user has opted into no-git mode) should the agent proceed to step 1 below. **§4.1.2** runs later — at **Phase 2 entry** after the brief is locked.

### 4.1.1 GitHub push identity (when the repo has a remote)

If the project will push to GitHub:

1. Use GitHub's **noreply** commit email (`<id>+<username>@users.noreply.github.com`) when the account has **Keep my email addresses private** enabled — otherwise push fails with **`GH007: Your push would publish a private email address`**.
2. Check **`git config --local user.email`** as well as global config — repo-local settings override global and are easy to miss after IDE commits.
3. After amend or history rewrite, verify **both author and committer** on `git log -1 --format=fuller` before pushing.
4. IDE "Sync" errors like *"Try Pull first"* are sometimes misleading — read the terminal output for `GH007` before assuming a merge conflict.

### 4.1.2 Stack-conditional checks (Phase 2 entry — after brief is locked)

**When:** Start of **Phase 2** (§4.2 step 10 onward), once **`docs/PHASE_1_BRIEF.md`** is locked and stack choices are in **`decisions[]`**. Do **not** block Phase 1 on these — they depend on what the project actually uses.

**Agent:** Walk the rows that apply; skip the rest. Prefer **isolated test scripts** (§4.7–§4.8) over “start the whole app and guess.”

| If the brief / stack includes… | Check or action | Guide |
|--------------------------------|-----------------|-------|
| **Default A — PocketBase** | After `setup:pocketbase` / **setup.bat**, run **`test-pocketbase`** (health + optional admin auth from `.env`) | §4.2.2, **`SYSTEM_HEALTH_CHECKS.md`**, **`POCKETBASE_SCHEMA_SCRIPT.md`** |
| **Runtime or build-time local LLM (Ollama)** | **`setup-ollama`** then **`test-ollama`**; pin **`OLLAMA_MODEL`** in `.env` after success | §4.8, **`SYSTEM_HEALTH_CHECKS.md`** |
| **Runtime / build-time cloud LLM** | `.env.example` + **`pnpm run env:check`** (or equivalent) lists provider keys; no binary install | §7.1, brief §12 |
| **Live web search (Tavily, Brave, …)** | User supplies API key in `.env`; wire server-side only | §4.4 |
| **E2E / Playwright in v1** | `pnpm run test:e2e:install` (or project script) once before first `test:e2e` | **`DEV_AUTOMATION_SCRIPTS.md`** |
| **Native Node addons** (`better-sqlite3`, `sharp`, `bcrypt`, …) | First `pnpm install`: if compile fails, install OS build tools; set **`pnpm.onlyBuiltDependencies`** at workspace root (§4.1 pnpm step 5) | §13 |
| **Monorepo `backend/` + `frontend/`** | Merge **root + package** `.env` in Vite/Node entry (§4.2.1); run **`env:check`** after both `.env.example` files exist | §4.2.1 |
| **Docker / Postgres / Redis / custom DB** (stack override) | Follow brief §6 / **`decisions[]`** — document install in **`README.md`**, not Lite defaults | Phase 1 override only |
| **A-local (no PocketBase)** | Skip PocketBase/Ollama rows unless brief still uses local LLM without PB | §7 A-local |

**Port and disk (runtime):** If PocketBase or Ollama fails mysteriously, check **port** in `.env` (not default **8090** on busy machines) and **disk/RAM** for Ollama models — use **`test-pocketbase.bat`** / **`test-ollama.bat`**, not universal preflight.

**Linux minimal images:** If `setup-pocketbase` fails on extract, confirm **`unzip`** (Mac/Linux scripts) or use Windows PowerShell path — see §4.1 install-script note.

Log anything non-obvious in **`gotchas[]`** (e.g. *"Playwright browsers installed on second machine"*, *"node-gyp needed VS Build Tools on Windows"*).

### 4.2 Ordered first actions

1. **Read** `.forgetrail/FORGETRAIL_LITE.md` top to bottom. Also read `.forgetrail/workflow_tracking.json`, `.forgetrail/AGENTS.md`, and `CONTEXT_PROMPT.md` if they already exist.
2. **Ensure the folder is a git repo.** *(Skip this step if the user opted into no-git mode in §4.1.)* Check with `git rev-parse --is-inside-work-tree`. If it returns false or errors, run `git init -b main` (or `git init` + `git branch -m main` on older git) at the repo root. Never re-init an existing repo. **Apply §1.5 git policy** (default: **commit `.forgetrail/`** for Lite). Write a minimal `.gitignore` containing at least:
   ```
   node_modules/
   .env
   .DS_Store
   ```
   Add `.forgetrail/` **only** if you chose §1.5 branch **B** (gitignore). Do **not** add it when committing `.forgetrail/`. Log the choice in `decisions[]`. (The full `.gitignore` lands in Phase 2 per §14.)
3. **Create `.forgetrail/`** if missing. **Create all platform rule files unconditionally** inside it (see §1.5), even if the current session is only one tool. Users switch between tools between sessions — someone who starts in Cursor today may resume in Claude Code tomorrow, or vice versa. Creating them upfront costs nothing and prevents the same `--trailer` injection bug from recurring under a different tool next week.
   1. **`.forgetrail/AGENTS.md`** — use the §12 snippet verbatim. Covers Codex CLI and any other `AGENTS.md`-native tool (cite explicitly or symlink to repo root locally if your tool requires root `AGENTS.md`).
   2. **`.forgetrail/cursor/rules/forgetrail-no-trailer.mdc`** — use the §12.5 snippet verbatim. **Symlink or copy** into `.cursor/rules/` so Cursor loads it.
   3. **`.forgetrail/CLAUDE.md`** — use the §12.5 snippet (the same Markdown body; the file name is what Claude Code auto-loads). Overrides Claude Code's `Co-Authored-By: Claude` trailer injection. Harmless in non-Claude tools.
   4. **`.forgetrail/cursor/rules/forgetrail-updates-log.mdc`** — use the §12.6 snippet verbatim. **Symlink or copy** into `.cursor/rules/` so Cursor reminds agents when to update `FORGETRAIL_LITE_UPDATES.md` (§1.6). Optional: copy the upstream **`FORGETRAIL_LITE_UPDATES.md`** starter into `.forgetrail/` when you expect protocol feedback during the project.
   If any of these already exists and its content conflicts with the Lite defaults, **do not overwrite** — flag the conflict to the user and ask how to reconcile. Log the reconciliation decision in `decisions[]`. On **pre-2.32 Git**, rule files cannot stop argv-level `--trailer` injection (§8.9) — use the shell hop or upgrade Git.
4. **Create `.forgetrail/workflow_tracking.json`** if it does not exist, using the starter block in §11. Fill `project.name`, `project.created` (today's date), and a one-line `project.description` from whatever the user has already said.
5. **If git was initialized in step 2**, make the first commit now so the user has a clean baseline. **What lands in the commit depends on §1.5:** if **committing `.forgetrail/`**, steps 3–4 artifacts are included; if **gitignoring `.forgetrail/`**, only `.gitignore` (and any `.cursor/rules/` copies) — the workspace stays local-only and that is expected, not a mistake. Example: `git add -A && git commit -m "chore: ForgeTrail Lite bootstrap"`. Use a **plain `-m` message only** — do **not** use `--trailer`, `-c trailer.*`, or `git interpret-trailers` (see §8 rule 9). Skip this step if the repo already had history — do not squash or amend what's there. Skip entirely if the user is in no-git mode (§4.1).
6. **Ask the §5 intake questions.** Do not write any project code yet. For the first user-facing reply, follow §9 (plain product language, one clear "reply with," no methodology jargon).
7. **Create `docs/`** (if missing) and **draft `docs/PHASE_1_BRIEF.md`** from the §6 template using the user's answers. Show it to the user, iterate, then **lock it**: set `phases.1.exitCriteria.phase1BriefLocked = true` (and the related exit criteria) in `.forgetrail/workflow_tracking.json`, and record major commitments in `decisions[]`.
8. **Pause for explicit approval** before moving to Phase 2. Do not advance `currentPhase` silently. **Explicit approval** means the user has reviewed the locked brief and given a clear, unambiguous affirmative — examples: *"locked,"* *"approved,"* *"go to phase 2,"* *"ship it,"* *"start building."* Silence, ambiguous nods (*"cool,"* *"interesting,"* *"ok"*), follow-up questions, or a "we'll see" do **not** count — if in doubt, ask: *"Ready to lock the brief and start Phase 2?"* and wait for a yes/no. An eager agent advancing on a "hmm" is a bigger cost than asking once more.
9. **On approval, create `CONTEXT_PROMPT.md`** at the repo root from the §10 template by merging the locked brief's key sections. Update `currentPhase` to `2`.
10. **Initialize the app and install dependencies** (the agent runs all of these — do not ask the user). **First:** run the **§4.1.2** stack-conditional checklist for this project (PocketBase test, Ollama, env keys, Playwright, native addons — only what applies).

    **Default A (web app — SvelteKit + PocketBase) — prefer the manual scaffold.** By the time we reach this step, the Lite bootstrap has already written **`.forgetrail/`** (protocol + tracking + agent rules), **`docs/PHASE_1_BRIEF.md`**, **`CONTEXT_PROMPT.md`**, **`.gitignore`**, and **`.git/`** at the repo root. That means the root is **never empty** when we scaffold, and `pnpm dlx sv create .` will hit `Directory not empty. Continue?` — an **interactive** prompt with no reliable non-interactive bypass in most versions (§13 anti-pattern). Rather than fight that, scaffold manually. It is deterministic and is **the primary path** for Lite.

    **A.1 — Manual scaffold at the repo root (default, deterministic):**
    ```bash
    pnpm init   # then clean up its defaults — see A.3
    pnpm add -D @sveltejs/kit @sveltejs/adapter-auto @sveltejs/vite-plugin-svelte \
      svelte svelte-check typescript vite tailwindcss @tailwindcss/vite tsx @types/node
    pnpm add zod   # plus whatever runtime deps the brief calls for
    # Write svelte.config.js, vite.config.ts, tsconfig.json, src/app.html, src/app.d.ts, src/app.css.
    # (If the brief calls for PocketBase as the data layer: pnpm add pocketbase)
    pnpm exec svelte-kit sync
    ```
    All project files live at the repo root — `src/`, `static/`, `package.json`, `pnpm-lock.yaml`, `tsconfig.json`. Follow-on `pnpm dev` / `pnpm build` run from the repo root. This matches what a hand-written SvelteKit project looks like and avoids any prompt that could hang the agent terminal.

    **A.2 — `sv create` shortcut (only when the target directory does not exist yet):**
    `sv create` is fine as a convenience **if and only if** you can point it at a path that does not exist or is empty — so that `Directory not empty. Continue?` never appears. Create a new subfolder and scaffold into it:
    ```bash
    pnpm dlx sv create app --template minimal --types ts --no-add-ons --install pnpm
    ```
    - **Folder name:** `app/` or `web/` are conventional. **Do not** name it `src` — SvelteKit creates its own `src/` *inside* the project, and a parent called `src` produces confusing `src/src/...` paths.
    - **Recent `sv` versions may emit no `svelte.config.js`.** From `sv` CLI ~v0.16, adapter and compiler options can live inside the `sveltekit()` plugin call in **`vite.config.ts`** instead of a separate config file. Do not hunt for (or blindly create) `svelte.config.js` to configure the adapter — read `vite.config.ts` first. For `adapter-static` prerendering, set `export const prerender = true` in **`src/routes/+layout.ts`** — that works under either config layout.
    - **Never** use `sv create .` against a populated repo root — there is no stable flag to skip the interactive "non-empty" prompt, and the agent terminal will hang (§8 rule 6, §13).
    - If a prior run left a partially created `app/`, **remove it** (or scaffold into a different new name) before retrying — do **not** re-run against the partial tree and try to answer the prompt.
    - If you use this shortcut, note that **dev commands run from `app/`**: `cd app && pnpm dev`, or `pnpm -C app dev` from the repo root. Record the layout in `decisions[]` and call it out at the top of `README.md` (§14).

    **A.3 — `pnpm init` cleanup (applies to both A.1 and Default B).** `pnpm init` writes some defaults that are wrong for a Lite project and need to be corrected before anything else:
    - Set `"type": "module"` (ESM — see §8).
    - Set `"name"` to match `docs/PHASE_1_BRIEF.md` (not the directory default).
    - Remove `"main": "index.js"` unless you are publishing a library.
    - Replace the default `"scripts": { "test": "echo \"Error: no test specified\" && exit 1" }` with real scripts (`dev`, `build`, `check`, `test`).
    - Set `"license"` to the user's choice or remove it if unclear; do not leave the default `"ISC"` by accident.

    **Default B (API / service / script — Node + TS):** run `pnpm init` at the **repo root**, apply the A.3 cleanup, then `pnpm add -D typescript tsx vitest @types/node` and write a strict `tsconfig.json` (`"module": "ESNext"`, `"moduleResolution": "Bundler"`, `"strict": true`, `"target": "ES2022"`). Add runtime deps (e.g. `hono`, `zod`) with `pnpm add` as the spine requires them.

    **Default B + separate UI (web app + API, not PocketBase):** when the brief is **UI + backend** but not Default A, use a **pnpm workspace** with committed packages — e.g. `backend/` (or `packages/api`) + `frontend/` (or `packages/web`) — instead of fighting `sv create .` at the repo root. The **`sv create app`** shortcut (A.2) into an **empty** subfolder is the first-class path for the frontend; init the API package with `pnpm init` + A.3 in its folder. Record the layout in `decisions[]` and `README.md` (§14). Load env per §4.2.1.

    **Both paths:** always use **`pnpm`**, never `npm` or `yarn`. Never hand-edit `package.json` to add deps — use `pnpm add` / `pnpm add -D` so `pnpm-lock.yaml` stays in sync. If `pnpm` is suddenly missing here (it was verified at §4.1 preflight but the machine changed), re-run the preflight rather than silently falling back to `npm`.
11. **Build the full runnable spine in one pass** (Phase 2 exit criteria in §3). As files are needed, also create the **Phase 2 baseline docs** from §14: `README.md`, `TODO.md` (seeded from brief §11), `.forgetrail/IDEAS.md`, `.env.example`, the full `.gitignore`, **one-click launchers** (§4.5), **`docs/FORGETRAIL_PROGRESS.md`** (§4.6), and PocketBase install scripts per §4.2.2 when Default A uses PocketBase.
12. **At every subsequent phase transition**, pause for the user's explicit "go" before updating `currentPhase`. Append to `sessions[]` at the end of each substantive session. *(If git is enabled)* commit (`git add -A && git commit -m "<phase>: <summary>"`) at natural stopping points so history mirrors the phase log. In no-git mode, skip the commit and note progress in `sessions[]` only — and remind the user each session that git is still deferred.

### 4.2.1 Environment variables (monorepos and split UI/API)

**Node does not load `.env` automatically.** If the protocol says "put `PORT` in `.env`" but nothing calls a loader at process entry, backends and CLIs will ignore user configuration.

1. **Backend / CLI / workers:** Use **`dotenv`** (or `import "dotenv/config"` **once** at the process entry file). Load in order:
   - `<repo>/.env` first
   - then `<package>/.env` with **`override: true`** so package-local values win.
   Document that **shell `export` still wins** if you rely on `dotenv` defaults (`override: false` on the first file). Prefer **`dotenv`** over hand-rolled line parsers — quoting and BOM edge cases match ecosystem expectations.

2. **Vite / SvelteKit frontend:** In `vite.config.*`, resolve **`envDir`** from **`fileURLToPath(import.meta.url)`** and merge **`loadEnv`** from:
   - monorepo root, then
   - the frontend package directory (later overrides).
   `loadEnv(mode, '.', …)` alone follows **`process.cwd()`** — in a pnpm workspace that is usually the package dir, so a **repo-root** `.env` may be invisible unless you merge both dirs with stable paths.
   Optionally: if **`PUBLIC_API_URL`** / **`*_API_URL`** is unset, derive **`http://127.0.0.1:${PORT}`** from merged env when **`PORT`** is the shared API port.

3. **Avoid drift:** Users often create **`<repo>/.env`** and **`<frontend>/.env`**. Document **which file applies to which process** in `README.md` (§14) and keep API port + proxy URL in sync. Tell users to **restart dev** after `.env` edits — Vite reads config at startup.

### 4.2.2 PocketBase install — never hardcode versions

**Problem:** A fixed PocketBase semver baked into ForgeTrail docs, `SCAFFOLD_INSTALL.json`, or install scripts goes stale quickly. Agents then download an **old** binary while the JS SDK or docs assume newer APIs — painful, opaque failures.

**Policy:**

1. **Do not** embed a single PocketBase version in `FORGETRAIL_LITE.md`, bootstrap snippets, or app scripts as the only source of truth.
2. **Default:** resolve **latest stable** at **install time** (GitHub `pocketbase/pocketbase` releases API). Copy upstream **`content/scripts/setup-pocketbase.mjs`** into the app repo (or equivalent in `scripts/setup-pocketbase.ts`).
3. **Pin only after success:** when a boot works, set **`POCKETBASE_VERSION=0.xx.yy`** in **`.env`** and write **`pocketbase/.pocketbase-version`** via the install script. Record the pin in **`decisions[]`**.
4. **Env override:** `POCKETBASE_VERSION=latest` (or unset) → re-resolve on next `setup:pocketbase` / **setup.bat**. `POCKETBASE_VERSION=<semver>` → download that release only.
5. **Align SDK:** `pnpm add pocketbase` should use a **current** SDK compatible with the resolved server; log **both** versions in `gotchas[]` if wire errors appear (§13 — curl first).

**Port / duplicate instances:** Keep **`PUBLIC_POCKETBASE_URL`** (or your convention) in **`.env`**. Install and **run** scripts must **detect** if something already listens on that port (health check) and print a clear message — not silently attach to another project's PocketBase.

See **`getScaffoldInstallParams`** / **`SCAFFOLD_INSTALL.json`** (`versionPolicy`) and **`POCKETBASE_SCHEMA_SCRIPT.md`**.

### 4.3 Optional — seed, fixture, or import data as JSON (any LLM chat)

**For humans:** If you need **initial or supplementary structured data** (seed rows, test fixtures, migrated content, a first catalog, sample users) and typing it by hand is tedious, you can use **any** LLM product you already use (ChatGPT, Claude, Gemini, Copilot, **local Ollama chat**, etc.) — *outside* or *inside* the same project chat — to **generate JSON** you save into the repo. Your coding agent then validates, imports, or wires that file into the app. **Repeat** this whenever you need a *new* dataset: one prompt run per file or batch is fine.

**For agents:** If the user drops a `*.json` (or pastes JSON) and says it came from another LLM, **do not** trust it without **schema or shape validation** at the boundary (e.g. Zod, JSON Schema, or your ORM’s validators). Idempotent seed/import rules still apply (§13).

**Copy-paste prompt** (edit the bracketed parts, then run in any LLM; save the model’s output to a file such as `data/seed-<name>.json` or `fixtures/<name>.json`):

```text
You are helping me prepare structured data for a software project. Reply with ONLY valid JSON — no markdown code fences, no explanation before or after the JSON. I will save your reply as a file in my repo.

Context
- App or domain: [ONE SENTENCE]
- What this data is for: [e.g. dev seed, test fixtures, UI demo content, first import]
- Target structure: [Describe: array of objects vs single object; required field names; types; nesting. Paste a TypeScript type, JSON Schema, or example object if you have one.]
- How many records: [NUMBER or "roughly N"]
- Rules: [e.g. obvious fake emails only, no real PII, locale/currency, enum values must be: ...]

Output requirements
- Valid JSON: double-quoted keys, UTF-8, no comments, no trailing commas.
- Consistent shape across all records; omit optional fields if unknown rather than null-stuffing unless I asked for nulls.
- If a field is a date, use ISO 8601 strings unless I specified otherwise.
- If I asked for unique IDs, use stable string IDs (e.g. slug-like or uuid-like), not sequential guessing that might collide.
```

**Why this works well:** The chat model does **content generation** in a familiar UI; the project agent does **file layout, validation, and wiring** — same division of labor as other “human brings asset, agent integrates” flows.

### 4.4 Optional — web search APIs (live internet data)

**For humans:** If v1 needs **current web information** (research helpers, RAG over fresh pages, “latest news on …”, competitive snapshots), you will almost always want a **search API** instead of ad-hoc scraping. Two **common ways to get started** with a developer key and a **free or entry-level allowance** (always confirm the latest terms on the vendor site — quotas change):

1. **[Tavily](https://tavily.com/)** — search/extract endpoints aimed at **AI and agent** workflows. Sign up, create an API key, add e.g. `TAVILY_API_KEY` to **`.env`** and document a placeholder in **`.env.example`**. [Pricing / credits](https://tavily.com/pricing) · [Docs](https://docs.tavily.com/).
2. **[Brave Search API](https://api-dashboard.search.brave.com/)** — **web, news, images, video**, and related endpoints. Create a key in the developer dashboard, add e.g. `BRAVE_API_KEY` (or the env name the official SDK/docs specify) to **`.env`**. [Pricing](https://api-dashboard.search.brave.com/documentation/pricing) — new accounts typically get **renewable monthly credits**; set **usage/budget limits** in the dashboard so you stay within the free-credit range while prototyping.

**For agents:** Call search APIs **from the server** only; never send secret keys to the client. If the product needs search, nudge the user in Phase 1–2: *"If you don’t have a key yet, sign up for Tavily and/or Brave, add the key to `.env`, and tell me which provider we’re using for v1."* Log the provider in **`decisions[]`** and wire **`CONTEXT_PROMPT.md`**. Pick **one** provider for the spine unless the brief explicitly needs two; avoid shipping both without a product reason (cost and complexity add up). **Cache, rate-limit, and respect robots/ToS** for any URLs you then fetch.

### 4.5 One-click local dev (non-technical operators)

**Problem:** Pasting ten terminal commands into chat loses non-technical users. They need **double-click** (or one familiar script), safe to run twice.

**Agent — Phase 2 (Default A with PocketBase or any local stack):**

1. Copy upstream **`forgetrail-dev-launcher.mjs`** and **`setup-pocketbase.mjs`** from `content/scripts/` into the app **`scripts/`** folder (adapt paths if the app uses `app/`).
2. Create at **repo root** (see **`ONE_CLICK_DEV_SETUP.md`** for full copy blocks):
   - **`setup.bat`** / **`setup.sh`** — `pnpm install`, PocketBase download (latest unless pinned), optional schema pass
   - **`run.bat`** / **`run.sh`** — start PocketBase if not already healthy on the configured port, then **`pnpm dev`**
   - **`status.bat`** / **`status.sh`** — print current ForgeTrail phase + refresh **`docs/FORGETRAIL_PROGRESS.md`**
3. Add **`package.json`** scripts: `"setup:pocketbase": "node scripts/setup-pocketbase.mjs"`, `"forgetrail:status": "node scripts/forgetrail-dev-launcher.mjs status"`.
4. **`README.md` — "Quick start (no terminal)"** section at the top: three bullets (setup → run → status). **Do not** make the README a wall of shell commands without launchers.
5. **You** run the first **setup** yourself when possible; tell the user *"Next time, double-click setup.bat then run.bat."*

**Safety rules for launchers:**

- **Idempotent** — second run skips download / reinstall when version stamp matches.
- **Platform branches** — Windows: PowerShell `Expand-Archive`, `.bat` with `pause` on error; Mac/Linux: `unzip`, `chmod +x` on `.sh`.
- **Prerequisites** — check for **Node.js** and **pnpm**; print one-line install links, not stack traces.
- **No admin surprises** — do not kill arbitrary processes; only report port conflicts and suggest changing **`.env`** port.

### 4.6 ForgeTrail phase progress (human-readable)

**Source of truth:** **`.forgetrail/workflow_tracking.json`** (agents update every session).

**For humans who are not in Cursor:**

| Mechanism | Who it's for |
|-----------|----------------|
| **`status.bat`** / **`status.sh`** / **`pnpm run forgetrail:status`** | Anyone — prints phase name, open exit criteria, last session; refreshes **`docs/FORGETRAIL_PROGRESS.md`** |
| **`docs/FORGETRAIL_PROGRESS.md`** | Plain-language snapshot (template: upstream **`FORGETRAIL_PROGRESS.md`**) |
| **`.cursor/rules/forgetrail-phase-status.mdc`** | Cursor agent footers from tracking JSON |
| **Ask the agent** | *"What's our ForgeTrail phase and what's next?"* — it should read tracking first |

**Agent:** After locking a phase or completing exit criteria, update tracking **and** either refresh **`docs/FORGETRAIL_PROGRESS.md`** or remind the user to run **status.bat**. On phase transitions, pause for explicit approval (§8 rule 1) — **status** output should not replace that conversation.

### 4.7 Isolated system health checks (PocketBase, Ollama, …)

**Problem:** Debugging the full app when only PocketBase or Ollama is broken wastes time. Non-technical users cannot interpret nested stack traces.

**Policy:** For each **key local dependency**, ship a **single-purpose** test script + double-click launcher. See **`SYSTEM_HEALTH_CHECKS.md`**.

| System | Test (isolated) | Typical launcher |
|--------|-----------------|------------------|
| **PocketBase** | `scripts/test-pocketbase.mjs` | **`test-pocketbase.bat`** / **`test-pocketbase.sh`** |
| **Ollama** (if used) | `scripts/test-ollama.mjs` | **`test-ollama.bat`** / **`test-ollama.sh`** |

**Agent — Phase 2:**

1. Copy **`test-pocketbase.mjs`** + **`forgetrail-env.mjs`** when PocketBase is in the stack.
2. Add **`pnpm run test:pocketbase`** and README line: *"PocketBase not working? Double-click test-pocketbase.bat."*
3. Exit **0** = pass, **non-zero** = fail with one clear next step (run setup, fix `.env` port, start PB).

### 4.8 Local Ollama (optional — runtime LLM)

**When:** Phase 1 brief §12 chooses **runtime LLM API** with a **local** provider, or the user asks for offline inference.

**Install policy:**

1. **Try to install** Ollama when missing (winget / brew / official install script) — see **`setup-ollama.mjs`**.
2. **Detect GPU VRAM** (`nvidia-smi` when available) and pull a model that fits with headroom.
3. **Default models (non-thinking):** **`ibm/granite4.1:8b`** or **`ibm/granite4.1:3b`** on smaller VRAM; **`gemma3:4b`** / **`gemma3:12b`** when **`OLLAMA_PREFER_GEMMA=1`**. Prefer **instruction** Granite 4.x / Gemma 3 — not DeepSeek-R1, QwQ, or other **reasoning-only** families unless **`OLLAMA_USE_THINKING=1`** and the brief explicitly requires chain-of-thought models.
4. **Pin after success:** set **`OLLAMA_MODEL`** in **`.env`** and record in **`decisions[]`** after **`test-ollama`** passes.
5. **Setup vs test:** **`setup-ollama.bat`** (install + pull); **`test-ollama.bat`** (version + one completion). Do not fold Ollama into **run.bat** unless the app always needs it running.

**Env:** `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, optional `OLLAMA_PREFER_GEMMA=1`, `SKIP_OLLAMA_INSTALL=1`.

---

## 5. Intake topics (ask across a short conversation, not all at once)

These are the **topics the agent needs to cover in Phase 1**, not a checklist to paste. Do **not** dump all of them into a single message — that produces thin, rushed answers. Walk through them across **2–3 short rounds**, each round building on the previous answer and covering **no more than ~3 topics at a time**. Confirm understanding in your own words between rounds.

**Coverage (across the full intake):**

- **Project name** — what to call the project (directory, repo, README title). If the user hasn't said one, ask in Round 1.
- **Problem & audience** — what they're building and why, who the primary user is, what pain v1 removes.
- **Hero workflow** — in one sentence, the *one* end-to-end journey that must work in v1 (e.g. "sign up → onboard → generate report → export PDF"). What proves the spine is alive?
- **Type of app** — **A. web app** (UI, auth, stored data) or **B. API / service / script** (no UI or minimal UI)? The matching default stack (§7) is used automatically — the user picks the **type**, not the stack. Only ask about language/framework/DB/deploy if the user volunteers a constraint or explicitly overrides the default.
- **Project archetype** — is this a **product** (others will use it), an **internal tool** (recurring users, no market), or a **one-shot** (gift, event, demo — one occasion, then done)? Often obvious from Round 1 — confirm rather than ask. Drives which later phases apply (§3) and which exit criteria get pruned from the tracking file.
- **v1 scope** — what *must* ship in v1, what is explicitly *out* of v1 (deferred, not deleted).
- **Constraints** — timeline, team size, budget, latency targets, offline support, compliance hints (even "none yet, but enterprise later").
- **Delivery shape** — exports (PDF / DOCX / PPTX / CSV / Markdown)? Multi-tenant (one org or many orgs × clients)? Auth model (public, invite-only, SSO)? Is the product read in-app or is export the main deliverable?
- **Existing assets** — repos, brand, content, APIs, schemas, or designs to reuse or integrate with.
- **Live web / search** — does v1 need **up-to-date results from the public internet** (not just the model’s training cutoff)? If yes, the user may need a **search API** account (§4.4) before the spine can call real data.

**Suggested rounds** (not a script — adapt to the user's energy):

- **Round 1 (anchor):** project name + problem/audience in plain English. *"What are you building, who is it for, and what do we call it? A couple of sentences is fine."* Nothing else. Let them tell the story.
- **Round 2 (shape):** type of app (A/B) + hero workflow + v1 scope. *"Great — a few quick ones so I can pick the right stack and scope: (1) web app or API/service? (2) in one sentence, the main thing a user does start-to-finish? (3) what has to be in v1 vs what can wait?"*
- **Round 3 (guardrails):** constraints + delivery shape + existing assets. Only ask the ones that didn't already come out in Rounds 1–2. If delivery shape and assets are obvious from the problem statement (e.g. "internal CLI tool, no auth, no exports"), skip them and confirm instead.

**Rules for the intake conversation:**

- **Ask questions as a numbered list, one question per line.** Never mash multiple questions into a single paragraph or compound sentence — *"what are you building, who is it for, and what should we call it?"* reads as one question and gets one compound answer. Instead:
  ```markdown
  1. **What are you building?** — a short description
  2. **Who is it for?** — primary users
  3. **What should we call it?** — project/codename
  ```
  The user can then reply `1. …` / `2. …` / `3. …` or prose — but they won't miss one. This **overrides the §8 rule 5 "bullets for parallel" convention**: for *questions*, numbered is always clearer because the user can answer by number.
- **Max ~3 numbered questions per message.** More than that and quality of answers drops hard.
- **Reflect before you ask (Round 2+).** Start each round after Round 1 with one sentence summarizing what you heard: *"Okay — so it's an internal tool for project managers to track client deliverables, export status reports as PDF."* Then ask the next round's numbered questions.
- **No jargon.** Say "the main thing a user does" instead of "hero workflow" in user-facing messages (the term is for internal/doc use). Never write "architecture" unless the user did first.
- **Skip what's already answered.** If the user has already said something in prior chat or an attached doc, restate what you captured and ask them to correct — do not re-ask.
- **Short questions invite short answers; that's fine.** If an answer is terse, confirm it and move on — do not re-interrogate. The brief can still lock on brief answers.

**If the agent's UI supports a native "ask user" / multi-question widget** (e.g. Cursor's structured question prompt, Claude Cowork form cards), **prefer that** over markdown numbered lists — same content, better ergonomics. The markdown numbered list is the fallback that works everywhere.

---

## 6. `docs/PHASE_1_BRIEF.md` template

Create this file during Phase 1. Fill every section. "Lock" it once the user confirms.

```markdown
# Phase 1 Brief — <project name>

_Status: DRAFT | LOCKED (<date>)_

## 1. Problem & audience
- Problem:
- Primary audience:
- Why now:
- Archetype: <!-- product | internal-tool | one-shot — see §3; drives which later phases apply -->


## 2. Hero workflow (v1)
- One-sentence journey:
- What proves the spine is alive:

## 3. v1 scope
- In scope:
- Explicitly out (v1.x or later):

## 4. Stack & architecture
- Language / runtime:
- Framework / app shape:
- Data layer:
- Auth:
- State persistence: <!-- §7 A-sub-question: "browser-only (localStorage/IndexedDB, no server DB)" OR "persistent (DB + auth, survives browser)". Only applies to Default-A web apps. -->
- Hosting / deploy target:
- Notable integrations:

## 5. Delivery shape
- Exports / outputs:
- Tenancy model:
- Roles (v1 vs later):

## 6. Constraints
- Timeline:
- Budget / team:
- Performance / latency:
- Compliance / data sensitivity (even "none yet"):

## 7. Existing assets / reuse
-

## 8. Risks & unknowns
-

## 9. Decision log (headline decisions only)

Mirror material entries in **`.forgetrail/workflow_tracking.json → decisions[]`** (`date`, `phase`, `decision`, `why`, `alternatives` — see §11).

- <date> — <decision> — <why> — <alternatives considered>

## 10. Open questions for the user
-

## 11. v1 TODO seed (will migrate to TODO.md in Phase 2)
- [ ]

## 12. Content-generation pattern (if applicable)

_In the full ForgeTrail **`docs/PHASE_1_BRIEF.md`** template this block is **§6a**; the Lite starter keeps it as **§12** here._

_Fill this section only if any user-facing content in v1 comes from an LLM. Skip entirely if content is hand-authored, imported from an existing source, or fetched from a non-LLM API. Corresponds to §7.1 of FORGETRAIL_LITE._

- Pattern: <!-- "runtime LLM API" | "build-time LLM generation" | "BYO-LLM paste" | "mixed (describe)" -->
- Provider / model: <!-- e.g. openai/gpt-4o-mini; anthropic/claude-sonnet; ollama ibm/granite4.1:8b or gemma3:4b (local); or "BYO — user's own chat, no project key" -->
- Env var names (runtime / build-time): <!-- cloud: OPENAI_API_KEY, ANTHROPIC_API_KEY; local: OLLAMA_BASE_URL=http://127.0.0.1:11434, OLLAMA_MODEL=ibm/granite4.1:8b; optional OLLAMA_PREFER_GEMMA=1, OLLAMA_USE_THINKING=1 only if reasoning models required -->
- Ollama setup (local runtime only): <!-- setup-ollama.bat + test-ollama.bat; pin model after test passes -->
- Seed file paths (build-time / BYO-LLM paths): <!-- e.g. data/seed-catalog.json, fixtures/demo-users.json -->
- Validation at boundary: <!-- e.g. Zod schema at src/lib/schemas/<name>.ts; where it runs (import, app start, per-request) -->
- Prompt (inline for BYO-LLM / build-time; optional for runtime):

  ```text
  <!-- Paste the full prompt the user runs in their LLM chat (BYO-LLM) or the prompt the build-time script sends. For runtime, skip or point at the file that holds it. -->
  ```
```

---

## 7. Default stack by app type (the user picks the type, not the stack)

**Design goal:** the user should **not have to research or decide a stack.** They pick the **type of app** (one letter, A or B) and the matching default stack is used automatically. Only if they raise a specific constraint ("we're a React shop," "must use Postgres," "Python-only team") do we deviate — and even then we deviate minimally, swapping only the pieces the constraint touches.

Both defaults share the same foundation — **TypeScript + pnpm + ESM** — so the user-facing choice collapses to one question: *"Does v1 have a UI, or not?"*

**A. Web app** — product with a UI, auth, persisted data, optional exports.
- **SvelteKit (Svelte 5) + TypeScript + TailwindCSS + PocketBase + pnpm**, ESM only.
- Why this default: single-binary DB/auth/files (PocketBase), fast cold start, no cloud lock-in for v1, ships to a cheap VPS. Gets from zero to a runnable hero flow fastest.
- Examples: internal tool, SaaS MVP, client portal, marketplace, dashboard, consulting deliverable builder.
- **A-sub-question: does state need to outlive the browser?** Before locking PocketBase + auth, ask: *"Does any state need to outlive the browser — accounts, cross-device sync, shared data, admin views? Or is every user's state private and fine to live in `localStorage`?"*
  - **A-local (per-user, browser-only):** drop PocketBase and auth. `adapter-static` becomes viable, no deploy-time secrets, no server-side DB. Persist via `localStorage` / `IndexedDB`. Many hobby/toy apps and single-session tools fit here — do not scaffold server infrastructure they will not use.
  - **A-persistent (the existing Default A):** keep PocketBase, auth, and the full SvelteKit + adapter-auto defaults.
  - Record the choice in `decisions[]` and in `docs/PHASE_1_BRIEF.md` §4 so future sessions do not re-introduce a DB the project chose to skip.

**B. API / service / script / CLI** — no UI, or minimal UI.
- **Node 20+ + TypeScript + pnpm**, ESM only (`"type": "module"`), `tsx` for dev, `tsc --noEmit` for type-check, `vitest` for tests. Grow into **Hono** (HTTP) or a plain worker as needed.
- Why this default: zero framework surface, the simplest thing that can be a service, a script, or a CLI — and cleanly grow into any of them.
- Examples: webhook handler, scheduled job, data pipeline, CLI tool, integration glue, MCP server.

### How the agent handles this in Phase 1

1. **Ask once:** *"Is this a **web app** (A) or an **API / service / script** (B)?"* — that's it. Do not enumerate frameworks, DBs, or deploy targets unless the user asks.
2. **Confirm the default in one line** after they pick: e.g. *"Got it — web app, so I'll use the SvelteKit + PocketBase default unless you want to change anything."* Give them an easy "or change X" opening without forcing them to use it.
3. **Lock the default in `docs/PHASE_1_BRIEF.md` §4** and record in `.forgetrail/workflow_tracking.json → decisions[]`:
   ```json
   { "date": "<YYYY-MM-DD>", "phase": 1, "decision": "Stack: default-A (SvelteKit+PB)", "why": "app type = web app; no overrides", "alternatives": [] }
   ```
4. **Honor explicit overrides minimally.** If the user says "React, not Svelte," swap the frontend layer only — keep TS/pnpm/ESM/PB/Tailwind. Record the override in `decisions[]` with the user's reason.

**Rules of the road**
- **Never silently substitute.** If the user picked A, do not ship React because the agent is more familiar with it.
- **Do not over-ask.** If the user just says "web app," do not follow up with seven questions about auth provider, ORM, CSS framework, and CI — the default covers all of that. Surface those choices only when a specific piece of Phase 2 work needs them.
- **If neither default fits** (rare: native mobile, game, embedded, ML research notebook), name that to the user, propose one concrete alternative stack in the same minimal spirit, and ask for a thumbs-up before proceeding.

### 7.1 Content-generation patterns (when the app needs LLM-produced content)

Orthogonal to the A/B picker: if the app needs content (text, structured data, descriptions, JSON blobs) produced by an LLM rather than hand-curated or pulled from an external API, pick the generation pattern up front — it drives deploy model, cost, and secret management. Three options, from most to least runtime cost:

- **Runtime LLM API** — a server route calls an LLM provider **per user request**. Live and personalized. **Cloud** (OpenAI, Anthropic, …): API keys in `.env`, pay-per-use, rate limits, streaming UX. **Local Ollama:** `OLLAMA_BASE_URL` + `OLLAMA_MODEL` — no cloud key; Phase 2 adds **`setup-ollama`** / **`test-ollama`** (§4.8); default **Granite 4.1** or **Gemma 3** from VRAM; avoid reasoning/thinking models unless the brief requires them. Not viable if the project wants a static/free deploy **and** needs per-request generation (unless Ollama runs on the same host as the app).
- **Build-time LLM generation** — an offline script (e.g. `pnpm run seed`) calls an LLM **once**, writes JSON under `data/`, and commits it. Zero **runtime** LLM cost. Provider can be **cloud** or **Ollama** (same `OLLAMA_*` env — only required when running the seed script). Pairs well with **A-local** + `adapter-static`.
- **BYO-LLM paste pattern** — ship a prompt in the repo (`prompts/seed.md` or brief §12); the **user** runs it in their own LLM chat account; the user pastes the JSON output into a repo file (e.g. `data/seed.json`); a schema (typically **Zod**) validates at app start. **Zero API keys in the project, zero runtime cost, the user keeps control of their own LLM account.** Ideal for hobby / OSS / free-hosted projects where API-key provisioning would kill the "download and run" experience. See §4.3 for the copy-paste prompt template and validator skeleton.

Record the chosen pattern in `decisions[]` and in `docs/PHASE_1_BRIEF.md` §12 (or §4 if §12 is omitted). Mixing is fine (e.g. build-time seed + optional runtime enrichment), but be explicit about which layer uses which pattern.

#### Minimal reference skeletons

These are illustrative shapes, not production code. Adapt the provider, types, and error handling to what the brief locks in; keep the **validate-at-boundary** and **keys-server-side-only** rules regardless of provider.

**Runtime LLM API — SvelteKit server route** (`src/routes/api/suggest/+server.ts`):

```ts
import { json, error } from "@sveltejs/kit";
import { OPENAI_API_KEY } from "$env/static/private";
import { z } from "zod";

const RequestSchema = z.object({ prompt: z.string().min(1).max(2000) });
const ResponseSchema = z.object({ text: z.string().min(1) });

export async function POST({ request }) {
  const parsed = RequestSchema.safeParse(await request.json());
  if (!parsed.success) throw error(400, "Invalid request");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: parsed.data.prompt }],
    }),
  });
  if (!res.ok) throw error(502, "Upstream LLM failed");

  const raw = await res.json();
  const text = raw?.choices?.[0]?.message?.content ?? "";
  return json(ResponseSchema.parse({ text }));
}
```

Client-side calls `fetch("/api/suggest", { method: "POST", body: JSON.stringify({ prompt }) })` — the browser never sees the key. For streaming UX, swap `json()` for a `ReadableStream` and `response.body` pass-through.

**Runtime LLM API — Ollama (local)** (`src/routes/api/suggest/+server.ts`):

```ts
import { json, error } from "@sveltejs/kit";
import { OLLAMA_BASE_URL, OLLAMA_MODEL } from "$env/static/private";
import { z } from "zod";

const RequestSchema = z.object({ prompt: z.string().min(1).max(8000) });
const ResponseSchema = z.object({ text: z.string().min(1) });

export async function POST({ request }) {
  const parsed = RequestSchema.safeParse(await request.json());
  if (!parsed.success) throw error(400, "Invalid request");

  const base = OLLAMA_BASE_URL.replace(/\/$/, "");
  const res = await fetch(`${base}/api/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: parsed.data.prompt,
      stream: false,
      options: { temperature: 0.3, num_predict: 1024 },
    }),
  });
  if (!res.ok) throw error(502, "Ollama request failed");

  const raw = await res.json();
  const text = String(raw?.response ?? "").trim();
  return json(ResponseSchema.parse({ text }));
}
```

Phase 2: copy **`setup-ollama.mjs`** / **`test-ollama.mjs`**, add **`setup-ollama.bat`** / **`test-ollama.bat`**, document in README. **`.env.example`:** `OLLAMA_BASE_URL=http://127.0.0.1:11434`, `OLLAMA_MODEL=ibm/granite4.1:8b`. Run **`test-ollama`** after setup before wiring hero flows.

**Build-time LLM generation — seed script** (`scripts/seed.ts`, invoked via `pnpm run seed`):

```ts
import { writeFileSync, mkdirSync } from "node:fs";
import { z } from "zod";

const Item = z.object({ id: z.string(), title: z.string(), summary: z.string() });
const Catalog = z.array(Item).min(1);

const prompt = `Return ONLY a JSON array of 20 items with fields id, title, summary.
Category: ${process.argv[2] ?? "starter catalog"}. No prose, no fences.`;

const res = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
  },
  body: JSON.stringify({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  }),
});
if (!res.ok) throw new Error(`LLM call failed: ${res.status}`);

const raw = await res.json();
const text = raw?.choices?.[0]?.message?.content ?? "[]";
const data = Catalog.parse(JSON.parse(text));

mkdirSync("data", { recursive: true });
writeFileSync("data/seed-catalog.json", JSON.stringify(data, null, 2) + "\n");
console.log(`Wrote ${data.length} items to data/seed-catalog.json`);
```

Wire as a script in `package.json`: `"seed": "tsx scripts/seed.ts"`. `data/seed-catalog.json` is **committed** — the script re-generates it on demand, but `pnpm dev` / `pnpm build` never call the LLM. Document in `README.md` that **`OPENAI_API_KEY`** (or a running **Ollama** instance matching **`OLLAMA_*`**) is only needed to run `pnpm run seed`, not to run the app itself.

**Build-time with Ollama** — same seed shape; swap the `fetch` target for Ollama `/api/generate` (mirror the runtime Ollama block above) and read `process.env.OLLAMA_BASE_URL` / `OLLAMA_MODEL`. Run **`pnpm run setup:ollama`** once per machine before first seed.

**BYO-LLM paste — validator that runs at app start** (`src/lib/data/catalog.ts`):

```ts
import { z } from "zod";
import raw from "./catalog.json";

const Catalog = z.array(
  z.object({ id: z.string(), title: z.string(), summary: z.string() }),
).min(1);

export const catalog = Catalog.parse(raw);
```

`catalog.json` is filled by pasting the JSON from the LLM chat (prompt lives in `prompts/seed-catalog.md` or brief §12, using the §4.3 template). If the paste is malformed, the app fails loudly at first import instead of shipping broken data — which is what you want.

### 7.2 External URL → structured record (scrape / import)

_Use only when v1 **creates records from pasted listing or article URLs** (jobs, gigs, grants — anything fetched server-side and parsed into fields). Skip if imports are manual paste of plain text only._

**Why Lite mentions this:** greenfield apps often ship **fetch → Cheerio** and assume selectors stay stable; **ATS and boards redesign DOM** without changing canonical URLs — users see “wrong link” errors when the link is fine.

**Layered pipeline (conceptual):** HTTP fetch first → **headless browser** when JS renders the body → optional **third-party or residential fetch** only for hosts that block datacenter IPs. Keep **per-domain parser stubs** when one layout repeats; add **minimum extracted length** checks before treating a scrape as success.

**Failure UX:** If the response is **large HTML** but **description/body** extracts **empty**, treat as **layout/extraction**, not user error — explain next steps (open in browser to confirm, paste description manually, retry later). Avoid copy that implies they pasted the wrong URL when diagnostics show **fetch OK + parse empty**.

**Optional last-resort LLM recover:** When every deterministic stage still yields **below-threshold body text** but you saved a **large HTML snapshot**, a **single** call to your **small/fast** structured-output model on **plain text** stripped from that HTML can recover fields — **verbatim extract only**, validated JSON, same minimum-length gate, **env flag to disable** (cost/policy). Log **which stage** succeeded/failed for support, not full HTML.

Full ForgeTrail expands this under **`docs/TECHNICAL_REFERENCE.md`** (*URL import: deterministic extractors vs markup drift*) and expects a **`specs/partial/`** note when you ship the behavior.

---

## 8. Agent rules (non-negotiable in Lite)

1. **Pause at phase transitions.** Declare exit criteria are met, **wait for user approval**, then update `currentPhase`.
2. **Phase 2 delivers a full runnable spine in one pass.** Init → deps → data path → routes → components → hero flow **end to end**. Do not defer "we'll wire the DB next session." If the spine would take longer than one session, shrink v1 scope with the user before starting.
   - **Output budget:** a real spine can be 20–30 files / a few thousand lines — that is fine in a modern large-context session. If the spine is clearly going to exceed **~30 tool calls** (a rough proxy for small-context risk), break it into **two commits within the same session** without pausing for user approval between them: **(a)** configs + directory scaffolding + empty route stubs + data model, then **(b)** route bodies + components + hero-flow glue. Both commits still land inside Phase 2; the spine is not "half-built" until the second commit verifies the hero flow end-to-end. Do not use this as an excuse to defer wiring to a later session.
3. **Log material decisions.** Anything a future teammate would ask "why did we do it that way?" goes in `.forgetrail/workflow_tracking.json → decisions[]` with a one-line "why."
4. **First user-facing reply is plain product language.** No methodology jargon, no tool-name dumps, no file inventories unless asked. Confirm what you did, say what happens next, give one concrete "reply with." (See §9.)
5. **List format conventions** when offering options (also applies to plans, next steps, checkpoints):
   - **Numbered** (1/2/3) = ordered pipeline, sequence matters.
   - **Bullets** (`-`) = parallel, independent options of equal weight.
   - **Letters** (A/B/C) = pick-one / "which first?" — avoids collision with numbered steps.
6. **No interactive CLIs** in scripted commands. Pass non-interactive flags. Examples: `npm create vite@latest -- --template ...`, `gh repo create --confirm`. For SvelteKit in Lite, **prefer the manual scaffold** (§4.2 step 10 A.1) over `sv create` — by the time Phase 2 runs, the repo root is never empty and `sv create .` will hit an un-skippable **`Directory not empty. Continue?`** prompt and hang. If you do use `sv create` as a shortcut, target a **new empty subfolder** (`sv create app`), never `.`. A hanging prompt in an agent terminal is a dead session.
7. **Five-turn rule.** If a bug or design problem has not converged in ~5 turns, **stop patching** and propose a different approach (different library, different data model, different scope cut). Announce the pivot explicitly.
8. **Update tracking after substantive work.** Move exit criteria checkboxes, append to `gotchas[]` and `sessions[]`. An empty tracking file after a busy session is a bug.
9. **Git commits — plain messages; trailer issues are mostly legacy Git.** See **§8.9** for the full rule. Summary:

   - **Git 2.32.0+ (2021):** `git commit --trailer` is supported. On current Git, trailer syntax is **not** a compatibility footgun — still **do not** add attribution the user did not request.
   - **All versions:** Use `git commit -m "…"` or `git commit -F path/to/msg.txt`. Ban unrequested `Made-with:`, `Co-Authored-By:`, `Signed-off-by:`, `Change-Id:`, etc. Override platform defaults (Cursor, Claude Code, Codex, …).
   - **Pre-2.32 only:** If a clean `-m` / `-F` command still fails with `unknown option 'trailer'`, the shell wrapper may be injecting `--trailer` — use `bash -c 'git commit -F …'` / `cmd.exe //c "…"` or **upgrade to Git 2.32+**.
   - Prefer **`-F`** for multi-line bodies; avoid HEREDOC + trailer flags on Windows shells.

10. **Install/bootstrap scripts must branch on `process.platform` before shelling out to archive, network, or text tools.** Treat `tar`, `unzip`, `curl`, `sed`, `awk`, `openssl`, and similar as **platform-dependent on Windows** — never a drop-in from a Unix-only recipe. On `win32`, prefer PowerShell (`Expand-Archive`, `Invoke-WebRequest`) or call `C:\Windows\System32\tar.exe` by absolute path to bypass PATH shadowing; keep `tar` / `unzip` / `curl` for macOS/Linux branches. Layer fallbacks and end with a clear error that points the user at manual steps (e.g. “Extract All”) if automation cannot run. Full failure modes: §13 (Engineering).
11. **Non-technical operators — one-click setup, not command dumps.** Create **setup/run/status** launchers (§4.5) and a short README quick-start. **Do not** ask the user to run a long list of shell commands you could run yourself or wrap in **setup.bat** / **setup.sh**.
12. **PocketBase (and similar binaries) — resolve version at install.** Never hardcode a stale semver in methodology or scripts only; use §4.2.2 (`POCKETBASE_VERSION`, GitHub latest).
13. **Isolated health checks for key systems.** PocketBase (and Ollama when used) get **`test-*.mjs`** + **`test-*.bat`** (§4.7–§4.8, **`SYSTEM_HEALTH_CHECKS.md`**) — not only "start the whole app and see what breaks."
14. **Local Ollama — non-thinking defaults.** Install/pull Granite 4.1 or Gemma 3 instruct sizes from VRAM; avoid reasoning models unless **`OLLAMA_USE_THINKING=1`** and the user explicitly needs them.

### 8.9 Git commits and `--trailer` (Git version + project policy)

**Git version:** `git commit --trailer` was added in **Git 2.32.0** (released 2021-03). On **2.32 and newer** (typical today), `--trailer` is a normal Git feature — commits do not fail merely because trailer syntax exists. **Pre-2.32 Git** is legacy: passing `--trailer` can produce `error: unknown option 'trailer'`.

**ForgeTrail project policy (every Git version):** Do not add attribution the user did not request (`Made-with:`, `Co-Authored-By:`, `Signed-off-by:`, `Change-Id:`, etc.). Use plain messages:

- `git commit -m "<phase>: <summary>"`
- `git commit -m "<subject>" -m "<body>"`
- `git commit -F path/to/msg.txt` (preferred for multi-line bodies on Windows / agent shells)

Override platform defaults (Cursor, Claude Code, Codex, …). If the user explicitly wants a trailer line, paste it into the `-m` body on its own line — do not use `--trailer` unless they ask.

| Platform | Common default attribution |
|----------|---------------------------|
| Cursor IDE | `Made-with: Cursor` |
| Claude Code | `Co-Authored-By: Claude` |
| Codex / misc | `Signed-off-by:`, `Change-Id:`, `Generated-by:` |

**Pre-2.32 Git only — wrapper injection:** If *your* command has no trailer flags but commit still fails with `unknown option 'trailer'`, the IDE shell wrapper may be injecting `--trailer` at argv level (below `.cursor/rules`, `AGENTS.md`, `CLAUDE.md`). Remedies:

```bash
bash -c 'git commit -F path/to/msg.txt'
cmd.exe //c "cd /d <repo> && git commit -F path\to\msg.txt"
```

Or install **Git 2.32+**. Log in `gotchas[]` if useful.

**Not a concern on Git 2.32+:** Treating `--trailer` as a broken Git feature, refusing to upgrade Git to avoid trailers, or assuming every commit must use a shell hop. On current Git, focus on **message policy** (no unrequested attribution), not trailer compatibility.

---

## 9. First user-facing reply after bootstrap

After you create `.forgetrail/AGENTS.md`, `.forgetrail/workflow_tracking.json`, and the git baseline, your **first message to the human** should be **short, plain-English, and ask only the opening round** of §5. Do **not** dump the full intake checklist. Do **not** list MCP tools, internal file paths, ForgeTrail terms ("hero workflow," "architecture," "spine," "exit criteria," "brief," "phase"), or file inventories. Target **~80 words or fewer** — this is a conversation starter, not a form.

**The anchor round is always Round 1:** three small, numbered questions — project name, what it is, who it's for. Nothing else. Stagger the rest of §5 across follow-up messages once they answer.

**Template (project name unknown):**
> I've set up the project scaffolding — we'll lock the plan together before writing any app code.
>
> To start, three quick ones (reply by number or just freely):
>
> 1. **What should we call it?** — project/codename is fine, we can rename later
> 2. **What are you building?** — a sentence or two in plain language
> 3. **Who is it for?** — primary users or customers
>
> I'll follow up with a few more small questions after that so we land the right shape on the first try.

**Template (project name already known, e.g. "gr-playbook"):**
> I've set up the scaffolding for **gr-playbook** — we'll lock the plan together before writing any app code.
>
> To start, two quick ones (reply by number or just freely):
>
> 1. **What are you building?** — a sentence or two in plain language
> 2. **Who is it for?** — primary users or customers
>
> I'll follow up with a few more small questions after that.

Adjust tone to match the chat. The shape is always **done → 2–3 numbered questions, one per line → promise of a short conversation, not a questionnaire.** Never compress the questions into a compound sentence.

**Round 2 (shape)** — reflect what you heard in one sentence, then ask three numbered questions:
> Got it — so **gr-playbook** is a tool for consulting firms to build branded playbooks for their clients.
>
> A few quick ones so I can pick the right stack and scope:
>
> 1. **Is this a web app (with a UI, logins, saved data), or an API/service/script (background worker, CLI — no UI)?** — pick A or B
> 2. **What's the main thing a user does from start to finish?** — e.g. "logs in → picks a client → fills a wizard → exports a PDF"
> 3. **What has to ship in v1, and what can wait?** — quick bullets are fine

**Round 3 (guardrails)** — ask only the topics from §5 that didn't come out naturally in Rounds 1–2. Same numbered format. Plain language, no jargon — use "**anything I should know before we pick a direction — deadlines, systems we have to integrate with, stuff that already exists to reuse?**" instead of "anything that would block a wrong architecture."

---

## 10. `CONTEXT_PROMPT.md` (Phase 2)

Once the brief is locked and you start the spine, create `CONTEXT_PROMPT.md` at the repo root. This is the "memory doc" a future session reads at the top of every chat so it knows where it is. Merge in the brief's key sections and keep it fresh.

**Minimum sections:**

```markdown
# Context — <project name>

## What this is
<1–2 sentences from brief §1>

## Hero workflow
<from brief §2>

## Stack
<from brief §4>

## Architecture at a glance
<data model, major modules, integrations — updated as the code evolves>

## Conventions
- Package manager: pnpm
- Modules: ESM only
- Language: TypeScript (strict)
- <other project-specific conventions>

## Current phase
<from .forgetrail/workflow_tracking.json>

## Recent gotchas (last 3–5)
<pull from tracking gotchas[]>

## Pointers
- Brief: docs/PHASE_1_BRIEF.md
- Tracking: .forgetrail/workflow_tracking.json
- TODO: TODO.md
```

Keep it **short** — this is a map, not a monograph. If it grows past ~200 lines, something belongs in a real doc instead.

---

## 11. Starter `.forgetrail/workflow_tracking.json` (copy block)

Write this to **`.forgetrail/workflow_tracking.json`** on first run. Replace the placeholder fields and update as the project progresses.

**Lite vs MCP tracking:** Lite uses **`schemaVersion: "lite-1"`**, numeric **`currentPhase`** (`1`–`7`), and per-phase **`exitCriteria`** objects (boolean flags). The full MCP starter uses string phase keys (`1-architecture`, …) and **`exitCriteriaMet`** / **`exitCriteriaRemaining`** arrays — see **`TRACKING_SCHEMA.md`** (phase ID map + both shapes). **`scripts/forgetrail-dev-launcher.mjs`** `status` understands both.

```json
{
  "schemaVersion": "lite-1",
  "project": {
    "name": "<project name>",
    "created": "<YYYY-MM-DD>",
    "description": "<one-line description>",
    "sourceControl": "git",
    "archetype": "product",
    "status": "active"
  },
  "currentPhase": 1,
  "phases": {
    "1": { "name": "Plan", "status": "in_progress", "exitCriteria": { "phase1BriefLocked": false, "stackLocked": false, "heroFlowAgreed": false, "v1ScopeAgreed": false } },
    "2": { "name": "Build", "status": "pending", "exitCriteria": { "runnableSpine": false, "heroFlowEndToEnd": false, "contextPromptWritten": false } },
    "3": { "name": "Stabilize", "status": "pending", "exitCriteria": {} },
    "4": { "name": "Iterate", "status": "pending", "exitCriteria": {} },
    "5": { "name": "Refine", "status": "pending", "exitCriteria": {} },
    "6": { "name": "Align", "status": "pending", "exitCriteria": {} },
    "7": { "name": "Harden", "status": "pending", "exitCriteria": {} }
  },
  "decisions": [],
  "gotchas": [],
  "sessions": [],
  "openQuestions": []
}
```

**Entry shapes** (append-only; include **`phase`** when the decision belongs to a specific lifecycle phase):

```json
// decisions[] — date, phase, decision, why, alternatives (alternatives may be [])
{ "date": "2026-04-22", "phase": 1, "decision": "Stack: SvelteKit + PocketBase", "why": "single-binary DB, fast spine", "alternatives": ["Next+Postgres"] }

// gotchas[]
{ "date": "2026-04-22", "phase": 2, "gotcha": "sv create hung: Directory not empty. Continue?", "fix": "Lite root is never empty by step 10; use manual scaffold (§4.2 step 10 A.1) or sv create into a new empty subfolder (app/); kill stuck process" }
{ "date": "2026-04-22", "phase": 2, "gotcha": "sv create hangs on Tailwind plugin prompt", "fix": "pass --no-add-ons or explicit --tailwindcss=plugins:none" }
{ "date": "2026-04-22", "phase": 2, "gotcha": "git commit failed with 'unknown option trailer' on pre-2.32 Git", "fix": "§8.9 — wrapper injected --trailer; bash -c 'git commit -F msg.txt' or upgrade to Git 2.32+" }
{ "date": "2026-04-23", "phase": 2, "gotcha": "tar -xf on Windows: (a) 'Cannot connect to Z: resolve failed' — bsdtar parses drive letters as remote host; (b) 'This does not look like a tar archive' — GNU tar from Git Bash shadowed bsdtar on PATH", "fix": "On win32 branch: PowerShell Expand-Archive (or C:\\Windows\\System32\\tar.exe by absolute path) with cwd + basename, not full X:\\... path; see §13 Engineering" }

// sessions[]
{ "date": "2026-04-22", "phase": 2, "summary": "wired auth + hero route end-to-end", "nextSession": "seed data + first export" }
```

---

## 12. `AGENTS.md` snippet (copy block)

Save this as `.forgetrail/AGENTS.md` so agents that auto-load it (Codex, Cursor, Cowork, and a growing number of others) pick up the protocol every session when cited or symlinked.

```markdown
<!--
  Agent protocol based on ForgeTrail Lite v2.0.0.
  © Catalyst Forge, LLC — www.catalystforge.com
  Licensed under Apache License 2.0 (upstream ForgeTrail repo).
-->

# Agent instructions for this repo

This repository uses **ForgeTrail Lite** as its project kickoff and operating protocol. The full protocol is in `.forgetrail/FORGETRAIL_LITE.md` — read it at the start of every fresh session.

## Non-negotiables
- **Phase gates:** pause at every phase transition and wait for explicit user approval before advancing. Current phase lives in `.forgetrail/workflow_tracking.json → currentPhase`.
- **Phase 1 before code:** do not write project code until `docs/PHASE_1_BRIEF.md` is locked and stack is agreed.
- **Phase 2 = full runnable spine** in one pass (init → deps → data → routes → hero flow end to end). No deferred spine.
- **Log decisions:** every material decision goes into `.forgetrail/workflow_tracking.json → decisions[]` with a one-line "why."
- **Plain first reply:** first user-facing message after bootstrap is product language, not methodology jargon. See `.forgetrail/FORGETRAIL_LITE.md` §9.
- **Ask questions as numbered lists, one per line.** Never mash multiple questions into a paragraph. See §5.
- **Git commits:** plain `-m` or `-F` only; no unrequested attribution trailers (§8.9). Git **2.32+** supports `--trailer` natively — focus on message policy, not trailer compatibility. **Pre-2.32 only:** `unknown option 'trailer'` → shell hop or upgrade Git.
- **Lists:** numbered = ordered steps or questions, bullets = parallel options, letters (A/B/C) = pick-one. See §8 rule 5.
- **No interactive CLIs** in scripted commands — pass every flag.
- **Five-turn rule:** if a problem has not converged in ~5 turns, propose a different approach, not more patches.

## Conventions
- Package manager: **pnpm**. Add deps with `pnpm add` / `pnpm add -D` — never hand-edit `package.json`, never `npm`/`yarn`.
- Modules: **ESM only** (`"type": "module"`, use `import`/`export`, never `require`).
- Language: **TypeScript** (strict).
- Source control: **git**. Commit at natural stopping points with phase-prefixed messages (`phase-2: …`). Plain `-m` or `-F`; no unrequested trailers (§8.9). Pre-2.32 Git + `unknown option 'trailer'` → `bash -c 'git commit -F …'` or upgrade to Git 2.32+.

## Setup is the agent's job
Initial `git init`, `pnpm init` / scaffolder, `pnpm install`, and the initial commit are all done by the agent per `.forgetrail/FORGETRAIL_LITE.md` §4. Do not ask the user to run setup commands by hand. If `git`, **Node.js**, **npm**, or **pnpm** are missing, follow §4.1 preflight (concrete install path; no-git mode for git only — never silently skip).

## Session start
1. Read `.forgetrail/workflow_tracking.json` and `CONTEXT_PROMPT.md` (if present).
2. Check `currentPhase` and the most recent `sessions[]` entry.
3. Verify `.git/` and `package.json` exist if the phase calls for them; if missing, re-read `.forgetrail/FORGETRAIL_LITE.md` §4 (preflight + ordered actions) and catch up before proceeding. If `project.sourceControl` is `"deferred"` in tracking, respect no-git mode and remind the user git is still pending.
4. If the previous session left exit criteria unmet, resume there — do not jump ahead.
```

---

## 12.5 Cursor rule snippet — override platform trailer injection (copy block)

**Why this exists:** Cursor and Claude Code often push attribution trailers into commits. Platform prompts can outrank a single doc file — **`.cursor/rules/`** snippets compete at the same instruction level. Some wrappers still inject `--trailer` at argv level on **pre-2.32 Git** only (§8.9).

Save upstream **`content/cursor-rules/forgetrail-no-trailer.mdc`** as **`.forgetrail/cursor/rules/forgetrail-no-trailer.mdc`**. Symlink or copy into **`.cursor/rules/`** (§1.5). Also create **`.forgetrail/AGENTS.md`** and **`.forgetrail/CLAUDE.md`** with the same policy (§12 snippets) — users switch tools between sessions.

**Cross-platform notes (§4.2 step 3):**

- **Cursor:** `.cursor/rules/forgetrail-no-trailer.mdc` — enforces no unrequested attribution; on **Git 2.32+** trailer syntax is not a Git error.
- **Claude Code:** `.forgetrail/CLAUDE.md` — overrides default `Co-Authored-By: Claude`.
- **Codex / AGENTS.md-native:** `.forgetrail/AGENTS.md` non-negotiables block.
- **Pre-2.32 Git + commit failures:** shell hop or upgrade Git (§8.9) — not required on current Git for compatibility.

---

## 12.6 Cursor rule snippet — Lite protocol feedback log (copy block)

Save as **`.forgetrail/cursor/rules/forgetrail-updates-log.mdc`**. Symlink or copy into **`.cursor/rules/`** (§1.5). Use the file at `content/cursor-rules/forgetrail-updates-log.mdc` in the ForgeTrail repo as the canonical upstream text — keep it in sync when §1.6 changes.

---

## 13. Anti-patterns & lessons (inline, since Lite has no `searchLessons`)

These are the failures ForgeTrail sees most often. The agent should re-read this list before any substantial change.

**Process**
- **Skipping the Phase 1 brief.** Rewrites compound. If the user says "just start coding," offer to write a 10-line brief in 2 minutes first — it still pays off.
- **Half-built spine.** Scaffolding a UI with mock data, or wiring a DB with no UI, and calling it Phase 2. The spine is end-to-end or it is not a spine.
- **Silent stack swap.** Choosing a framework, DB, or language the user did not confirm. Always name the stack and get a "yes" before Phase 2.
- **Tracking-file rot.** Writing `.forgetrail/workflow_tracking.json` once and never updating it. Update it at the end of every substantive turn.
- **Turning the first reply into a methodology dump.** Users want a product answer, not a tour of `decisions[]` and `exitCriteria`.

**Engineering**
- **Interactive CLIs in agent terminals.** `sv create`, `npm init`, `gh auth login`, `pnpm dlx create-*` will hang forever on a TTY prompt. Pass every flag, or skip the CLI and write files directly.
- **`sv create` against a repo that Lite has already bootstrapped.** By §4.2 step 10 the repo root is **never empty** — the Lite bootstrap (steps 1–9) writes **`.forgetrail/`**, `docs/PHASE_1_BRIEF.md`, `CONTEXT_PROMPT.md`, `.gitignore`, and `.git/` before any scaffolder runs. Running `pnpm dlx sv create .` at that point triggers an **interactive** `Directory not empty. Continue?` prompt with **no reliable non-interactive bypass** — agent terminals cannot answer it and the session hangs (§8 rule 6). **Prevention:** in Lite, **prefer the manual scaffold** described in §4.2 step 10 (A.1); it is deterministic and never prompts. If you want the `sv create` shortcut, target a **fresh subfolder that does not exist yet** (e.g. `sv create app`, never `sv create .`). **Recovery:** kill the hung process, delete any partial `app/`, and switch to the manual path or retry into a new folder name. Do not try to answer the prompt by piping "Yes" — non-portable and fragile.
- **Committing secrets or the wrong artifacts to a public repo.** Do not put API keys, `.env`, or customer-private notes in **`.forgetrail/workflow_tracking.json`** or committed rules. Prefer **`.forgetrail/`** (not repo root) for agent files per §1.5. If you **gitignored** `.forgetrail/` but later need it on GitHub, that is fine — it was intentional. If you **accidentally committed secrets** or sensitive internal URLs, treat the remote as compromised: rotate credentials and rewrite history (`git filter-repo`) if needed; a follow-up delete commit does **not** remove blobs from history. Vendoring a full Lite copy when **MCP** already serves methodology is clutter, not a license violation — drop the duplicate file and use MCP tools instead.
- **GitHub GH007 / private email on push.** See §4.1.1 — fix noreply identity and repo-local `user.email` before debugging merge or sync UI errors.
- **Re-running scaffolders in an initialized app folder.** A second `sv create` on top of an existing SvelteKit tree (root or `app/`) typically errors or corrupts config. Detect the presence of `package.json` plus `svelte.config.js` (or `app/package.json` if using the subfolder shortcut) and refuse.
- **Mixing CommonJS and ESM.** Pick ESM (`"type": "module"`) from day one. Do not sprinkle `require()` in a project that uses `import`.
- **Opaque backend errors: curl first, version-drift second, SDK source last.** Single-binary and managed backends (PocketBase, SurrealDB, Meilisearch, Supabase stack, and similar) ship the **server binary** and the **JS/TS SDK** on **independent release trains**. When the server tightens a wire rule (e.g. PocketBase 0.37 requires `Authorization: Bearer <token>` on reads; an older SDK still sends a bare token) you often get a **single opaque 400/500** like *Something went wrong while processing your request* with no hint of headers, query shape, or the rule that fired. Worse, the server may be **permissive on writes** and **strict on reads** — `create()` works, `getFullList()` fails — so the bug reads as *"data was never saved."* **Diagnostic:** do not start in SDK source or with retries. Bypass the client with `curl` (e.g. `curl -w "\nHTTP=%{http_code}\n"`), same credentials, and vary **one** dimension at a time: auth header format (`Authorization: <token>` vs `Authorization: Bearer <token>`), query params (drop `sort` / `filter` / `perPage`), HTTP method. The SDK hides the exact bytes on the wire; `curl` shows them — the delta between a 200 and what the SDK sends **is** the bug, usually in **minutes** vs an hour of internals archaeology. **Prevention / fix until the SDK matches:** a client `beforeSend` (or request-interceptor) shim that normalizes headers or query shape; treat any cross-endpoint opaque 400/500 as **wire mismatch until proven otherwise**. **Session hygiene:** log **SDK version + server version** together in `gotchas[]` so the next run checks version drift first.
- **Env secrets in the repo.** Only `.env.example` is committed. Real `.env` is in `.gitignore`. Check before every commit.
- **Assuming `.env` is loaded without code.** Node/TS entrypoints (`tsx`, `node`, Hono, workers) do **not** read `.env` unless you call **`dotenv`** (or equivalent) at startup — see §4.2.1. Vite loads env for `vite.config.*`, but monorepo layouts need **merged `loadEnv`** from repo root + package with paths derived from **`import.meta.url`**, not `process.cwd()` alone.
- **pnpm ignored native build scripts.** `better-sqlite3` and similar may install without `prebuild-install` / `node-gyp` on pnpm v9+ — see §4.1 preflight step 5 (`onlyBuiltDependencies` at workspace root).
- **Wrong API on a busy port.** A default like **8787** may already serve **another app** (unrelated JSON, 404s that look like your bug). Before debugging routes, **`curl http://127.0.0.1:<PORT>/api/health`** (or your health path). Teach changing **`PORT` + proxy / CORS / `*_API_URL`** in one place when the port moves.
- **Hardcoded PocketBase (or tool) versions in install scripts.** Pinning `0.25.x` in a script while the ecosystem moved on causes mysterious admin/API failures. Resolve **latest at install** unless `.env` pins a tested semver (§4.2.2).
- **Terminal-only onboarding for non-technical users.** If the README is only shell commands, add **setup.bat** / **setup.sh**, **run.bat** / **run.sh**, **status.bat** / **status.sh** (§4.5).
- **Debugging only via full app start.** Add **test-pocketbase.bat** / **test-ollama.bat** (§4.7) so operators can verify one service in isolation.
- **Defaulting to reasoning/thinking Ollama models** (R1, QwQ, etc.) for general product features — wastes VRAM and adds latency; use Granite 4.1 / Gemma 3 unless the brief requires thinking models (§4.8).
- **Non-idempotent setup scripts.** Any "bootstrap" script (DB schema, seed data, migrations) must be safe to run twice. If it errors on second run, it is not done.
- **"It works on my machine" dev loop.** If an ops step (install, seed, migrate, codegen) happens more than twice, turn it into a `pnpm` script the next session can re-run.
- **Unrequested attribution trailers.** Banned on all Git versions (§8.9). On **Git 2.32+**, `--trailer` is supported — the issue is **policy**, not Git breakage. Pre-2.32: `unknown option 'trailer'` may appear if a wrapper injects flags.
- **Shelling out to Unix-named tools on Windows without platform branching.** On Windows, a command like `tar`, `unzip`, `curl`, `sed`, `awk`, or `openssl` may resolve to Microsoft's bundled tool (e.g. bsdtar in System32, native `curl`), a **Git Bash / MSYS2** variant (GNU `tar`, GNU `sed`), or nothing at all — **whichever is first on PATH**. Install and bootstrap scripts are the highest-risk surface: they run earliest, on the freshest user environments, with the weakest toolchain assumptions. Two traps this causes:
  - **Drive-letter-as-host.** bsdtar (ships with Windows 10 1803+) parses `Z:\path\file.zip` as a remote `host:path` and errors with `Cannot connect to Z: resolve failed`. Any absolute Windows path with a drive letter passed to libarchive-style tools can hit this. **Fix:** run the tool with **`cwd` set to the target directory** and pass only the **file basename** — never the full `X:\...` path as a single argument to `tar -xf`.
  - **GNU vs. BSD / Microsoft coin-flip.** GNU `tar` **cannot read zip**; bsdtar can. If Git Bash is on PATH ahead of System32, `tar -xf foo.zip` may invoke GNU `tar` and fail with *"This does not look like a tar archive"* even though another `tar.exe` on the same machine would succeed. **Fix:** in Node scripts, branch on `process.platform === 'win32'` and prefer **PowerShell** built-ins (`Expand-Archive -LiteralPath ... -DestinationPath ...`) or call **`C:\Windows\System32\tar.exe`** by absolute path to sidestep PATH. Keep `unzip` / `tar` / `curl` as the macOS/Linux branch. Layer attempts and fall back with a clear error that points the user at a manual **Extract All** (or equivalent) as last resort.
  The same class of bug generalizes to any Unix-named binary on Windows — always **detect platform** and **prefer first-party Windows APIs or absolute paths** when the script must be reliable for all contributors.

**Debugging**
- **Patch spiral.** Three failed fixes in a row usually mean the model of the bug is wrong. Restate what you believe is happening, what the evidence says, and where the mismatch is — then pick a new approach.
- **Guessing at error causes.** Read the actual stack trace, read the actual file, then propose a fix. Speculating without reading is how one-line bugs become hour-long sessions.
- **Suppressing warnings/types.** `// @ts-ignore`, `any`, `--force`, `eslint-disable` are escape hatches, not fixes. Each use should be annotated with a comment explaining why it is safe and a TODO to remove it.

**Scope**
- **Feature creep inside a phase.** New ideas from the user during Phase 2 go into `.forgetrail/IDEAS.md` or `TODO.md`, not into the current spine. Stay ruthless until the hero flow works.
- **Polishing before spine is alive.** No copy editing, no palette tweaks, no refactors until Phase 5+. The spine earns that polish.

---

## 14. Minimal baseline files (Phase 2)

During Phase 2, create these once the spine is running. Keep them short and honest.

- **`README.md`** — what the project is, how to run it, required env vars, one screenshot or GIF if applicable. **Lead with a "Quick start (no terminal)" block** when §4.5 launchers exist (setup → run → status). **List which `.env` file each process reads** (repo root vs `frontend/` vs `backend/`) when using a monorepo or split UI/API (§4.2.1). Note that **dev servers must be restarted** after `.env` changes (Vite reads config at startup). **By default** (manual scaffold per §4.2 step 10 A.1) the app lives at the **repo root** — `src/`, `package.json`, `svelte.config.js`, etc. all at top level — so the run command is plain **`pnpm dev`**. **If** you took the `sv create app/` shortcut (A.2) the UI instead lives under `app/`; in that case document **`cd app && pnpm dev`** (or `pnpm -C app dev` from the root) prominently near the top, so the next session is not stuck guessing at the wrong directory. Update the README command block whenever the run command changes.
- **`TODO.md`** — ordered list of next work, seeded from brief §11. Check off items as you ship. Move deferred ideas to `.forgetrail/IDEAS.md`.
- **`.forgetrail/IDEAS.md`** — unstructured capture of future features, pivots, questions. Never blocks shipping. (Local-only when §1.5 branch B gitignores `.forgetrail/`.)
- **`.env.example`** — every env var the app reads, with a placeholder value and a one-line comment per var. Never commit `.env`. **Monorepo / split stack:** use a **root** `.env.example` for shared / backend / compose-style vars and a **frontend** `.env.example` for only what Vite reads in `vite.config` (`VITE_*`, proxy target, `FRONTEND_PORT` — name the vars your config actually loads). Common keys to declare here:
  - **Web search** (§4.4): if you chose a provider, add its key here — e.g. `TAVILY_API_KEY=`, `BRAVE_API_KEY=` — so the user knows to sign up and fill `.env` locally.
  - **Runtime / build-time LLM** (§7.1): cloud keys (`OPENAI_API_KEY=`, `ANTHROPIC_API_KEY=`) and/or local **`OLLAMA_BASE_URL=http://127.0.0.1:11434`**, **`OLLAMA_MODEL=ibm/granite4.1:8b`** (after **`test-ollama`** passes). Optional: `OLLAMA_PREFER_GEMMA=1`, `OLLAMA_USE_THINKING=1` only when reasoning models are required. Match names in `docs/PHASE_1_BRIEF.md` content-generation section.
  - **Build-time LLM generation** (§7.1 second pattern): the seed script may need a provider key for the offline run (`pnpm run seed`). Declare it here; document in `README.md` that the key is only required to **re-generate** seed data, not to run the app.
  - **BYO-LLM paste** (§7.1 third pattern): **no key goes in `.env.example`** — the whole point is that the user runs the prompt in their own chat. Only the validator / file paths are declared (in `package.json` or `src/lib/data/`).
  - **PocketBase (Default A, local dev):** put the **public API URL and port** in **`.env`** and **`.env.example`** (e.g. `PUBLIC_POCKETBASE_URL=http://127.0.0.1:8096` — exact name is your app’s convention). On a dev machine, **several PocketBase processes** (other projects, another repo, an old `pb` still running) may already be listening; PocketBase’s default HTTP port is **8090**, and if nothing picks an explicit free port, the new server **will not start** or your app will **connect to the wrong instance**. The value must be **one source of truth** shared by: how you start the binary (`pocketbase serve` / your setup script’s `--http=…` or scaffold defaults), the JS SDK in SvelteKit, and any **schema** or admin script that calls the Admin API. After changing the port, restart PocketBase and the app so no stale process holds the old address.
- **`.gitignore`** — **anchor root-only rules with a leading slash**. An unanchored pattern like `build/` matches at **any depth**, and will silently swallow a real source directory with the same name (e.g. SvelteKit's `src/routes/build/` for a dynamic `/build` route). `git status` will read "clean" while half the Phase 2 spine is untracked — a ~30-minute debug the first time it hits. Minimum `.gitignore`:

  ```gitignore
  # Optional: gitignore ForgeTrail agent workspace (tracking, Lite copy, rules)
  # Omit this block if you commit .forgetrail/ under Apache 2.0 (same as upstream).
  .forgetrail/

  # Optional: if you symlink agent files to repo root for IDE auto-load
  # AGENTS.md
  # CLAUDE.md
  # IDEAS.md
  # .forgetrail/workflow_tracking.json
  # .cursor/rules/forgetrail-no-trailer.mdc
  # .cursor/rules/forgetrail-updates-log.mdc

  # Deps
  node_modules/
  .pnpm-store/

  # Env / secrets
  .env
  .env.*
  !.env.example

  # Build output (anchored — unanchored "build/" or "dist/" will match
  # nested source dirs, e.g. SvelteKit's src/routes/build/).
  /build/
  /dist/
  .svelte-kit/
  .next/
  .vite/

  # OS & editor cruft
  .DS_Store
  Thumbs.db
  *.swp
  .vscode/

  # Local data
  /pb_data/
  /pocketbase/
  *.db
  ```

  **Rule of thumb:** whenever you add a framework, check whether its build-output directory name (`build`, `dist`, `public`, `out`, `target`) could collide with a route or source path in that framework, and **anchor accordingly**. After Phase 2, run `git ls-files | grep routes/ | head` (or equivalent) once to confirm no route directories were swallowed.
- **Optional JSON data files** — e.g. `data/seed-*.json` or `fixtures/*.json` created by the user (see §4.3) for seed or demo content. The agent validates and imports; the user can regenerate or add files **multiple times** for different tables or domains.
- **`docs/FORGETRAIL_PROGRESS.md`** — human-readable ForgeTrail phase snapshot (§4.6); refresh when `currentPhase` or exit criteria change, or when the user runs **status.bat** / **forgetrail:status**.
- **One-click dev launchers** — **`setup.bat`** / **`setup.sh`**, **`run.bat`** / **`run.sh`**, **`status.bat`** / **`status.sh`** at repo root; logic in **`scripts/forgetrail-dev-launcher.mjs`** (upstream template). See **`ONE_CLICK_DEV_SETUP.md`**.
- **Isolated health checks** — **`test-pocketbase.bat`** / **`test-ollama.bat`** (and **`setup-ollama.bat`** when local LLM); scripts in **`scripts/`** per **`SYSTEM_HEALTH_CHECKS.md`**.

Phases 3–7 add documents as the project grows (test plan, design notes, deploy runbook, security review). Lite does not prescribe templates for those — write what the project actually needs.

---

## 15. If something in this file conflicts with the user

The user wins. This is a default protocol, not a law. When the user overrides a rule:

1. Acknowledge the override briefly.
2. Record it in `decisions[]` with **`date`**, **`phase`** (current lifecycle number), **`decision`**, **`why`**, and optional **`alternatives`** so future sessions see the exception.
3. Proceed.

The one exception: **do not** skip logging the override itself — that is how Lite stays coherent across sessions.

---

## Footer — when to upgrade from Lite

ForgeTrail Lite covers the shape of a project. The full **ForgeTrail MCP server** adds deeper per-phase playbooks, a searchable lessons database, audit prompts (security, pre-launch, marketing, docs), template library, and richer tracking. If you want those — or you are shipping a production system with real users — consider graduating to the MCP-backed bootstrap (`NEW_PROJECT_BOOTSTRAP.md`). Lite stays useful as the portable on-ramp.

---

**ForgeTrail Lite v2.0.0** · © Catalyst Forge, LLC · [www.catalystforge.com](https://www.catalystforge.com) · [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)
