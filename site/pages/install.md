---
title: Install
description: Install LocalHelm from npm.
order: 1
---

Requires **Node.js 22+**.

```bash
pnpm add -g localhelm
```

or `npm i -g localhelm`.

```bash
localhelm scan ..
localhelm enroll ../my-cli --apply
localhelm serve
```

Dashboard: `http://127.0.0.1:4321`. The fleet file lives next to the repos you enroll (`localhelm.fleet.json`).

Flags, enroll, publish, and the dashboard live in the [docs](/docs).
