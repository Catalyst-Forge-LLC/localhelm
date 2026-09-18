---
title: Install
---

Requires **Node.js 22+**.

## Global install

```bash
pnpm add -g localhelm
```

or `npm i -g localhelm`.

Stand in the folder that **contains** your repos (the shared parent), then:

```bash
localhelm serve
```

Open `http://127.0.0.1:4321`. **Add projects**, scan that folder, tick the ones you keep, then write. The fleet file (`localhelm.fleet.json`) is written next to those repos. Serve from that same tree later so the board finds it.

The CLI can do the same enroll (`localhelm scan .` then `enroll … --apply`) if you prefer a terminal.

## From a checkout

```bash
pnpm install
pnpm build
pnpm serve
```

The published CLI is `localhelm serve`.

## Site and docs

This documentation is [localhelm.dev/docs](https://localhelm.dev/docs). Product pages live on FilePress; these docs are a path mount at `/docs`.
