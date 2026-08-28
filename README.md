<p align="center">
  <img src="https://unpkg.com/localhelm/site/static/logo.png" alt="LocalHelm" width="218" />
</p>

# LocalHelm

**Control panel for local development.**

Your local fleet is the apps and sites you keep, including tools that never publish. Ports sit on the same board. [LocalSlip](https://localslip.dev) is the slip; LocalHelm is the wheel.

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

`scan` never writes. Other commands print a plan; `--apply` writes. `publish` and `push` need named ids. Never `--force`.

`localhelm serve` opens the dashboard on port 4321. Same library as the CLI. Writes stay on loopback.

Skip folders with `.localhelmignore` at the workspace, or `~/.localhelm/ignore`.

Requires Node 22+. License Apache-2.0. Site: [localhelm.dev](https://localhelm.dev).
