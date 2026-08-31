---
title: Quick start
---

## Scan and enroll

```bash
localhelm scan ..
localhelm enroll ../my-cli ../my-lib --apply
localhelm status
```

`scan` never writes. `enroll` prints a plan; `--apply` writes the fleet file.

Put gitignore-style patterns in `.localhelmignore` at the workspace (or a parent). `node_modules`, dot-folders, and `__*` are always skipped.

## Open the dashboard

```bash
localhelm serve
```

Then visit `http://127.0.0.1:4321` for the operator board. The **Deck** (`/deck`) is the phone tile grid. A phone hitting `/` on LAN or Tailscale lands there. Ports come from [LocalSlip](https://localslip.dev). Write APIs stay on loopback.

## A write is a plan

```bash
localhelm bump my-cli patch
localhelm bump my-cli patch --apply
```

Mutating commands print what they would do. Pass `--apply` to write. `publish` and `push` require named project ids. Never `--force`.

## See dependents

```bash
localhelm deps
localhelm ready
```

`ready` lists packages that are already unpublished-ahead. [Publish](/docs/publish) covers the cut and npm step.
