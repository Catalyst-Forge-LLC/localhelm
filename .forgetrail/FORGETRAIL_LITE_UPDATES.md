# ForgeTrail Lite — local feedback log (starter)

Copy into **`.forgetrail/FORGETRAIL_LITE_UPDATES.md`** on a bootstrapped project (gitignored). Use when a session finds a gap in **ForgeTrail Lite itself** — not routine app bugs.

**How to use:** see **`FORGETRAIL_LITE.md` §1.6** and symlink **`forgetrail-updates-log.mdc`** into `.cursor/rules/` (§12.6).

**Upstream:** merge accepted entries into `forgetrail/content/FORGETRAIL_LITE.md`, then trim or archive here.

---

## Entries

### 1. Shared TS imported by `.svelte` must not import `node:*`

**What went wrong:** A Svelte 5 client component imported `visitorOpenHref` from a shared module that also `import`ed `node:os`. Vite externalized `node:os` and the browser threw `Cannot access "node:os.hostname" in client code`. The next HMR update then forced a full reload.

**Suggested Lite change:** In the SvelteKit pitfalls / dashboard section (near §4.2 or the anti-patterns around shared `$lib`), add: modules imported by `.svelte` (even one named export) are in the browser graph. Keep `node:os`, `node:fs`, `node:child_process` in a `*Machine.ts` / `$lib/server` file. Client code uses `import type` plus browser-safe helpers (`visitorHttpUrl`, not a wrapper that lives next to `os.hostname`).

**Project pointer:** LocalHelm `src/lib/visitorTiles.ts` vs `src/lib/visitorMachine.ts`.

### 2. Vite `allowedHosts` blocks Tailscale MagicDNS

**What went wrong:** A local dashboard bound `0.0.0.0` so a phone could open it. Hitting `http://<machine>.<tailnet>.ts.net:PORT` returned Vite `403 Blocked request. This host is not allowed.` Raw Tailscale/LAN IPs worked. Vite 6+ allows localhost and IPs by default, not DNS names.

**Suggested Lite change:** In Vite / SvelteKit serve notes (§4.2 or anti-patterns): if the spine is meant to be opened from a phone via LAN name or Tailscale MagicDNS, set `server.allowedHosts: true` (or `['.ts.net']`) in `vite.config`. Pair with loopback-only write routes if the board has no auth.

**Project pointer:** LocalHelm `app/vite.config.ts`.

| Topic | Lite § to patch |
| --- | --- |
| Node builtins in Svelte client graph | §4.2 / anti-patterns |
| Vite allowedHosts vs Tailscale `*.ts.net` | §4.2 / anti-patterns |
