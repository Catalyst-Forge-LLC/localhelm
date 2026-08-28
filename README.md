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
localhelm plugin xfacts                 # xFacts labels board, if enrolled
localhelm serve                         # :4321 on all interfaces
```

`scan` never writes. Other commands print a plan; `--apply` writes. `publish` and `push` need named ids. Never `--force`.

`localhelm serve` opens the dashboard on port 4321. Same library as the CLI. Writes stay on loopback.

Skip folders with `.localhelmignore` at the workspace, or `~/.localhelm/ignore`.

Requires Node 22+. License Apache-2.0. Site: [localhelm.dev](https://localhelm.dev).

<!-- xfacts-nutrition-label -->

## Nutrition label

- **AppFacts:** [viewer](https://appfacts.dev/v#af1.eNpNUUFOwzAQ_Irlc5oAx56KIiEBFZciLggh19km2zq2ZW_SRlX_zjqmhZOl2ZnZ2fFZjnJ5X0irepBLaZxWpgPTy0LS5BNUr58FOWcYiaRoiIwpTTgCIwY12Jhoj17pDhYP5V0m6oNcnqVRth1UmwjvbLfRAT0VYjOCISjEixpVxlgUBks4p3hzDZT7yNgucK6jC2wms-gVaV4wGbRtslVojmgbUW82KTQnzYMPTBu89b28FLIBz8E_z9LyaBVnq32sDrObZ-wIW3HbJnYuiEbFbutUaFifdRRPv-zUTZyDCziBHgidnUXc1h8dvZ_yHUmDliDk5uZCeSy0672zYCneVCvUzuJuqnLIq5hBEadIwOd8FXI7oGlSw1z7gQv-7pXlJzD1enLnevC5-47Ix2VV3b63bGBMlYN3EcmF6R-pReqGbcnRqlqRMrx08eRCC4v1uv6zkJcfq5PB9g) · [raw](https://github.com/Catalyst-Forge-LLC/localhelm/blob/main/APP_FACTS.md)

