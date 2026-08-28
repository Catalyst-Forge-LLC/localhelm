# localhelm.dev

Marketing + docs site for [LocalHelm](https://github.com/Catalyst-Forge-LLC/localhelm), built with [FilePress](https://getfilepress.com) (`getfilepress` on npm). Modeled on the [LocalSlip](https://localslip.dev) explainer.

```bash
pnpm install
pnpm docs:build    # Markdown → docs/dist (Svelte-style shell)
pnpm dev           # docs build + FilePress preview
pnpm build         # → build/ (includes /docs mount)
```

Docs source: `docs/*.md` + `_nav.json`. FilePress mounts `docs/dist` at `/docs` via `paths` in `filepress.config.ts` (requires getfilepress **≥ 0.1.8** for Docs clicks in `filepress dev`).

If [LocalSlip](https://localslip.dev) is installed, this explainer stays on **5201** as `localhelm-site` (not the dashboard on 4321).

Optional: add `theme.css` next to `filepress.config.ts` to override the default Essay theme.

## Deploy

**Cloudflare Pages:** from the repo root, `pnpm ship` (build + `wrangler pages deploy`, project `localhelm`). Output is `site/build`, Node 22+.

| Setting | Value |
| --- | --- |
| Root directory | `site` |
| Build command | `pnpm install && pnpm build` |
| Output directory | `build` |
| Node | 22+ |

Any static host: publish the `build/` folder. Details: https://getfilepress.com/deploy
