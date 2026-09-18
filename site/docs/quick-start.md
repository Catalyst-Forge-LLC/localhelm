---
title: Quick start
---

## Open the board

With only LocalHelm installed, stand in the folder that contains your repos:

```bash
localhelm serve
```

Visit `http://127.0.0.1:4321`. Today says **No fleet** until you enroll. **Add projects**, scan `.` (the folder you ran serve from), tick the ones you keep, then write. Nothing joins until that confirm.

You do not need LocalSlip, FilePress, or a terminal enroll to get a useful Fleet and Today.

The **Deck** (`/deck`) is the phone tile grid. A phone hitting `/` on LAN or Tailscale lands there. Write APIs stay on loopback.

## Optional integrations

| Integration | What it adds | Required to enroll? |
| --- | --- | --- |
| [LocalSlip](https://localslip.dev) | Ports tab, start/stop of claimed listeners | No |
| FilePress plugin | Sites jobs (`plugin filepress`) | No |
| xFacts plugin | Labels board for enrolled AppFacts | No |

Those tabs stay empty until you enroll the matching checkout. They are not missing homework on a new board.

## Same thing from a terminal

```bash
localhelm scan .
localhelm enroll ./my-cli ./my-lib --apply
localhelm status
```

`scan` proposes folders. Nothing joins until `--apply`. `status` reports dirty trees, local versus published versions, and pin disagreements.

## A write is a plan

On the board, each gold button shows a plan, then Confirm writes. From a terminal:

```bash
localhelm bump my-cli patch
localhelm bump my-cli patch --apply
```

`publish` and `push` require named project ids. Never `--force`.

## See dependents

```bash
localhelm deps
localhelm ready
```

`ready` lists packages that are already unpublished-ahead. [Publish](/docs/publish) covers the cut and npm step.
