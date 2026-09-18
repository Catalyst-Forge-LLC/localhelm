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

From the folder that contains your repos:

```bash
localhelm serve
```

Dashboard: `http://127.0.0.1:4321`. **Add projects** on Today, scan that folder, tick, then write. The fleet file (`localhelm.fleet.json`) lives next to the repos you enroll. Serve from that tree so Helm finds it.

Flags, enroll, publish, and the dashboard live in the [docs](/docs).
