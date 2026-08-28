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
localhelm enroll ../filepress ../ollanet --apply
localhelm status
localhelm status filepress              # one project only
localhelm status --json
localhelm deps
localhelm bump filepress patch          # plan: write package.json + commit that file; --apply to write
localhelm fetch
localhelm pull                          # plan; add --apply for ff-only
localhelm push                          # plan every enrolled origin
localhelm push localhelm filepress --apply   # origin only; name ids; never --force
localhelm export                        # plan; add --apply to write localhelm.status.json
localhelm ready                         # already unpublished-ahead
localhelm publish ollanet               # plan: bump/push only if needed, then npm publish
localhelm auth                          # npm whoami + how to set an automation token
localhelm publish ollanet --apply       # opens npm’s login URL if the token still requires a passkey
localhelm publish ollanet --apply --otp 123456   # only if npm asks for a numeric authenticator code
localhelm cascade ollanet               # plan pin updates to ^npm; --apply writes + commits
localhelm plugins                       # FilePress (and later others) if the enrolled project has localhelm.plugin.mjs
localhelm plugin filepress              # content sites: headers, link→npm, ship
localhelm plugin filepress sync         # plan engine sync for every FilePress site
localhelm serve                         # dashboard on all interfaces :4321 (operator: 127.0.0.1)
```

`scan` never writes. Mutating commands print a plan; pass `--apply` to write. `publish` requires named project ids; it bumps and pushes only when needed, then `npm publish`. Never `--force`. One job at a time (`.localhelm/job.lock`).

The loopback dashboard (`app/`, checkout only) calls the same library: scan/enroll, status, bump, fetch, pull, push, publish, export, ready, cascade.

Put gitignore-style patterns in `.localhelmignore` at the workspace (or a parent). `node_modules`, dot-folders, and `__*` are always skipped. Optional user-global list: `~/.localhelm/ignore`.

Requires Node 22+. License Apache-2.0. Site: [localhelm.dev](https://localhelm.dev).
