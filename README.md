<p align="center">
  <img src="https://unpkg.com/localhelm/site/static/logo.png" alt="LocalHelm" width="218" />
</p>

# LocalHelm

**Control panel for local development.**

Fleet, sites, and ports in one place — including tools that never ship. Pairing: **LocalSlip** is the slip; **LocalHelm** is the wheel.

```bash
pnpm add -g localhelm
# or from a checkout:
pnpm install && pnpm build

localhelm scan ..
localhelm enroll ../my-cli ../my-lib --apply
localhelm status
localhelm status my-cli                 # one enrolled id
localhelm status --json
localhelm deps
localhelm bump my-cli patch             # plan; --apply writes
localhelm fetch
localhelm pull                          # plan; --apply is ff-only
localhelm push                          # plan every enrolled origin
localhelm push my-cli my-lib --apply    # named ids; never --force
localhelm export                        # plan; --apply writes JSON
localhelm ready                         # already unpublished-ahead
localhelm publish my-lib                # plan
localhelm auth                          # npm whoami + token hint
localhelm publish my-lib --apply
localhelm publish my-lib --apply --otp 123456
localhelm cascade my-lib                # plan pin updates; --apply writes
localhelm plugins
localhelm plugin filepress              # FilePress plugin, if present
localhelm plugin filepress sync
localhelm serve                         # :4321 on all interfaces
```

`scan` never writes. Mutating commands print a plan; pass `--apply` to write. `publish` requires named project ids; it bumps and pushes only when needed, then `npm publish`. Never `--force`. One job at a time (`.localhelm/job.lock`).

The loopback dashboard (`app/`, checkout only) calls the same library: scan/enroll, status, bump, fetch, pull, push, publish, export, ready, cascade.

Put gitignore-style patterns in `.localhelmignore` at the workspace (or a parent). `node_modules`, dot-folders, and `__*` are always skipped. Optional user-global list: `~/.localhelm/ignore`.

Requires Node 22+. License Apache-2.0. Site: [localhelm.dev](https://localhelm.dev).
