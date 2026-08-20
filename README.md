# LocalHelm

**Status for the products you ship.**

A named fleet of local repos: git, npm, and dependents, in one place. Pairing: **LocalBerth** is the slip; **LocalHelm** is the wheel.

```bash
pnpm add -g localhelm
# or from a checkout:
pnpm install && pnpm build

localhelm scan ..
localhelm enroll ../filepress ../ollanet --apply
localhelm status
localhelm status --json
localhelm deps
localhelm bump filepress patch          # plan
localhelm fetch
localhelm pull                          # plan; add --apply for ff-only
localhelm export                        # plan; add --apply to write localhelm.status.json
localhelm serve                         # dashboard on 127.0.0.1:54322
```

`scan` never writes. Mutating commands print a plan; pass `--apply` to write. The tool never publishes and never git-pushes. One job at a time (`.localhelm/job.lock`).

The loopback dashboard (`app/`, checkout only) calls the same library: scan/enroll checkboxes, status, bump, fetch, pull, export.

Put gitignore-style patterns in `.localhelmignore` at the workspace (or a parent). `node_modules`, dot-folders, and `__*` are always skipped. Optional user-global list: `~/.localhelm/ignore`.

Requires Node 22+. License Apache-2.0. Site: [localhelm.dev](https://localhelm.dev).
