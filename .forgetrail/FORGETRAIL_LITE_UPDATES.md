# ForgeTrail Lite — local feedback log (starter)

Copy into **`.forgetrail/FORGETRAIL_LITE_UPDATES.md`** on a bootstrapped project (gitignored). Use when a session finds a gap in **ForgeTrail Lite itself** — not routine app bugs.

**How to use:** see **`FORGETRAIL_LITE.md` §1.6** and symlink **`forgetrail-updates-log.mdc`** into `.cursor/rules/` (§12.6).

**Upstream:** merge accepted entries into `forgetrail/content/FORGETRAIL_LITE.md`, then trim or archive here.

---

## Entries

### 1. Shared TS imported by `.svelte` must not import `node:*`

**What went wrong:** A Svelte 5 client component imported `visitorOpenHref` from a shared module that also `import`ed `node:os`. Vite externalized `node:os` and the browser threw `Cannot access "node:os.hostname" in client code`. The next HMR update then forced a full reload.

**Suggested Lite change:** In the SvelteKit pitfalls / dashboard section (near §4.2 or the anti-patterns around shared `$lib`), add: modules imported by `.svelte` (even one named export) are in the browser graph. Keep `node:os`, `node:fs`, `node:child_process` in a `*Machine.ts` / `$lib/server` file. Client code uses `import type` plus browser-safe helpers (`visitorHttpUrl`, not a wrapper that lives next to `os.hostname`).

**Also:** Do not name a Svelte `$lib` shim the same as a Node module in the sibling `src/lib` (e.g. `$lib/scan` vs `src/lib/scan.ts`). Vite can load the Node walker (`node:os` / `node:fs`) into the client. Use a distinct name (`$lib/scanPaths`) and re-export only the browser-safe file.

**Project pointer:** LocalHelm `src/lib/visitorTiles.ts` vs `src/lib/visitorMachine.ts`; `$lib/scanPaths` vs `src/lib/scan.ts`.

### 2. Vite `allowedHosts` blocks Tailscale MagicDNS

**What went wrong:** A local dashboard bound `0.0.0.0` so a phone could open it. Hitting `http://<machine>.<tailnet>.ts.net:PORT` returned Vite `403 Blocked request. This host is not allowed.` Raw Tailscale/LAN IPs worked. Vite 6+ allows localhost and IPs by default, not DNS names.

**Suggested Lite change:** In Vite / SvelteKit serve notes (§4.2 or anti-patterns): if the spine is meant to be opened from a phone via LAN name or Tailscale MagicDNS, set `server.allowedHosts: true` (or `['.ts.net']`) in `vite.config`. Pair with loopback-only write routes if the board has no auth.

**Project pointer:** LocalHelm `app/vite.config.ts`.

### 3. Private GitHub + relative README logo 404s on npmjs

**What went wrong:** `package.json` `files` already included `site/static/logo.png` (in the tarball; unpkg 200). npmjs still showed a broken image. The GitHub repo is private, so `raw.githubusercontent.com` 404s. Putting `site/static/logo.png` in `files` is necessary but not sufficient.

**Suggested Lite change:** In the npm publish / README notes: npmjs does not reliably load relative README images from the tarball. If the repo is **private**, do not use a GitHub raw URL. Point the `<img>` at a public CDN of the published file (`https://unpkg.com/<pkg>/path/to/logo.png`) and keep that path in `files`. Also: npm sanitizes very long hash URLs (AppFacts viewer); a `## xFacts label` with only that link renders as an empty heading.

**Project pointer:** LocalHelm `README.md`.

### 4. Vite-hosted plugin jobs must not `spawnSync` a long deploy

**What went wrong:** Sites → Ship runs `pnpm ship` (Vite build + wrangler Pages). The FilePress plugin used `spawnSync`, which freezes the Vite event loop for minutes. The browser then shows `Failed to fetch` with no HTTP body. Activity never logs the apply. A 1MB `maxBuffer` can also kill wrangler mid-upload.

**Suggested Lite change:** Near dashboard / plugin notes (§4.2): long write jobs hosted by `vite dev` must be async (`spawn`, not `spawnSync`) so HMR and keep-alives stay alive. Disable the HTTP server socket timeout (`setTimeout(0)`) for jobs that write no bytes until they finish. Map browser `Failed to fetch` to “serve may have stopped / check the terminal.” Raise `maxBuffer` (or inherit stdio) when capturing deploy logs.

**Project pointer:** LocalHelm `app/vite.config.ts` + `src/lib/fetchError.ts`; FilePress `localhelm.plugin.mjs`.

### 5. Dashboard boot must not serialize independent I/O or lock the chrome

**What went wrong:** A fleet status route awaited anonymous `GET registry.npmjs.org/<name>/latest` in a pool (easy 429; errors cached 5 minutes). `npm view` is one package per process — there is no `npm view --owner` or multi-name argv. Plugin `board()` hooks ran in a `for`/`await` loop (~13s). The client set `busy` for that read, which disabled the header and tabs until both finished. Roster JSON was already 4ms.

**Suggested Lite change:** In dashboard / Phase 2 spine notes (§4.2): independent reads (registry, plugin boards, git) should fan out with a small pool; cache short-TTL process state across refresh. Do not disable navigation/chrome for a read — show an inline “reading…” line. Writes can still take the lock. Prefer a dedicated/network LLM host when the operator’s workstation is the busy box (ollanet-style discovery: remote first, localhost last). For npm latest, prefer the CLI (`npm search maintainer:<whoami>` then leftover `npm view`) over anonymous `/latest` HTTP so npmrc/auth/cache apply.

**Project pointer:** LocalHelm `src/lib/npm.ts` `npmLatestMany`, `src/lib/plugin.ts` `loadPluginDashboard`, `app/src/routes/+page.svelte` `readQuiet`.

### 6. Vite 8 `ssr.noExternal: true` breaks CJS in `vite dev`

**What went wrong:** A packaged SvelteKit adapter-node board needs `ssr.noExternal: true` so a global install does not import bare npm names. The same flag in `vite.config` also applies to checkout `vite dev`. Vite 8’s SSR module runner then inlines CommonJS (`ignore`’s `module.exports`) as ESM and API routes 500 with `ReferenceError: module is not defined`.

**Suggested Lite change:** In Vite / SvelteKit serve notes (§4.2): `ssr.noExternal: true` is a **build** setting. Omit the key during `vite dev` (Vite 8 / Rolldown rejects `noExternal: false`; it only accepts `true` or an array). Leave node_modules external in checkout serve so CJS packages load through Node.

**Project pointer:** LocalHelm `app/vite.config.ts`.

### 7. pnpm virtual store after a folder rename

**What went wrong:** A FilePress site (`localslip/site`) still had `node_modules` from when the repo was named `localberth`. `pnpm update getfilepress` failed with `ERR_PNPM_UNEXPECTED_VIRTUAL_STORE` because `.modules.yaml` recorded `Z:\workspace\localberth\site\node_modules\.pnpm`.

**Suggested Lite change:** In pnpm / monorepo notes (near §4 or anti-patterns): renaming or moving a checkout leaves an absolute `virtualStoreDir` in `node_modules/.modules.yaml`. Delete `node_modules` and `pnpm install` from the lockfile directory. Tools that run `pnpm update` in a sibling should detect this error (or the stale path) and reinstall once instead of failing the whole batch.

**Project pointer:** FilePress `scripts/siblings/lib.ts` `staleVirtualStoreDir`; LocalHelm Land sync of `localslip`.

| Topic | Lite § to patch |
| --- | --- |
| Node builtins in Svelte client graph | §4.2 / anti-patterns |
| Vite allowedHosts vs Tailscale `*.ts.net` | §4.2 / anti-patterns |
| Private GitHub README images on npmjs | npm / README |
| Long Vite plugin jobs / Failed to fetch | §4.2 / anti-patterns |
| Serial dashboard I/O + chrome lock | §4.2 / anti-patterns |
| Vite 8 noExternal + CJS in vite dev | §4.2 / anti-patterns |
| pnpm virtual store after folder rename | §4 / anti-patterns |
