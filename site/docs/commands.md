---
title: Commands
---

| Command | Description |
| --- | --- |
| `localhelm scan [dir…]` | Propose folders; never writes |
| `localhelm enroll <path>… [--apply]` | Add rows after a plan |
| `localhelm unenroll <id>… [--apply]` | Drop rows; never deletes a folder |
| `localhelm status [id…]` | Local / npm / git / pins |
| `localhelm deps [id]` | Fleet pin graph |
| `localhelm bump <id> patch\|minor\|major [--apply]` | Write `package.json` and commit that file |
| `localhelm fetch` | `git fetch` enrolled remotes |
| `localhelm pull [--apply]` | Fast-forward only; skips dirty |
| `localhelm push <id>… --apply` | Origin only; never `--force` |
| `localhelm export [file] [--apply]` | Write `localhelm.status.json` |
| `localhelm ready` | Already unpublished-ahead |
| `localhelm publish <id>… [--apply]` | Bump/push if needed, then npm publish |
| `localhelm auth` | `npm whoami` and token setup |
| `localhelm cascade <id> [--apply]` | Retarget dependents to `^V` |
| `localhelm land <site-id> [--apply]` | Needed engine/package writes, then Sync → Push → Ship |
| `localhelm brief` | Markdown of Today + listening Ports |
| `localhelm archive [id…] [--apply]` | Hide on Today; folder stays |
| `localhelm plugins` | Loaded `localhelm.plugin.mjs` hosts |
| `localhelm plugin <id> [action] [name…] [--apply]` | Plan/apply a plugin job |
| `localhelm serve [--host ADDR] [--port N]` | Dashboard on **4321** |

```bash
localhelm --help
```

Deep pages: [Enroll](/docs/enroll), [Dashboard](/docs/dashboard), [Publish](/docs/publish).
