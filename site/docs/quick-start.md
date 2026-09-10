---
title: Quick start
---

## Standalone first

With only LocalHelm installed:

```bash
localhelm scan ..
localhelm enroll ../my-cli ../my-lib --apply
localhelm status
```

`scan` proposes folders. Nothing joins until `--apply`. `status` reports dirty trees, local versus published versions, and pin disagreements (a local `package.json` that does not match what dependents or npm last said). That is useful without LocalSlip, FilePress, or xFacts.

## Open the dashboard

```bash
localhelm serve
```

Then visit `http://127.0.0.1:4321` for the operator board. The **Deck** (`/deck`) is the phone tile grid. A phone hitting `/` on LAN or Tailscale lands there. Write APIs stay on loopback.

## Optional integrations

| Integration | What it adds | Required to enroll? |
| --- | --- | --- |
| [LocalSlip](https://localslip.dev) | Ports tab, start/stop of claimed listeners | No |
| FilePress plugin | Sites jobs (`plugin filepress`) | No |
| xFacts plugin | Labels board for enrolled AppFacts | No |

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
