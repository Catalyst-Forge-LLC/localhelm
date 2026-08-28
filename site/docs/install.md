---
title: Install
---

Requires **Node.js 22+**.

## Global install

```bash
pnpm add -g localhelm
```

or `npm i -g localhelm`.

Then:

```bash
localhelm scan ..
localhelm enroll ../my-cli --apply
localhelm serve
```

The dashboard is `http://127.0.0.1:4321`. The fleet file is `localhelm.fleet.json` at the shared parent of the repos you enroll.

## From a checkout

```bash
pnpm install
pnpm build
pnpm cli status
```

The dashboard from the tree is `pnpm serve`. The published CLI is `localhelm serve`.

## Site and docs

This documentation is [localhelm.dev/docs](https://localhelm.dev/docs). Product pages live on FilePress; these docs are a path mount at `/docs`.
