<p align="center">
  <img src="site/static/logo.png" alt="LocalHelm" width="218" />
</p>

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
localhelm serve                         # dashboard on 127.0.0.1:54322
```

`scan` never writes. Mutating commands print a plan; pass `--apply` to write. `publish` requires named project ids; it bumps and pushes only when needed, then `npm publish`. Never `--force`. One job at a time (`.localhelm/job.lock`).

The loopback dashboard (`app/`, checkout only) calls the same library: scan/enroll, status, bump, fetch, pull, push, publish, export, ready, cascade.

Put gitignore-style patterns in `.localhelmignore` at the workspace (or a parent). `node_modules`, dot-folders, and `__*` are always skipped. Optional user-global list: `~/.localhelm/ignore`.

Requires Node 22+. License Apache-2.0. Site: [localhelm.dev](https://localhelm.dev).

<!-- xfacts-nutrition-label -->

## Nutrition label

- **AppFacts:** [viewer](https://appfacts.dev/v#af1.eNpFkcFqwzAQRH_FzFmJ2x51agkUSkMvKb2UEjby1lYiS0JaJzEh_15kp-Qqzey8nb3gCP2o4KlnaLhgyHXseijIGMvTav1WSQgOCllIhgwNMmKPDAVnDftcZC-RTMeLp-XDLDQH6Asc-Xagtgg-x8gbk2wUKKTBi50SP0LDy32Gwm-ink8hHaCxObITfreiKsnnaeLorG_LHLLuZH1TrTYbKOwG65rtBKjxZYVxVWg4ZujvCzw0nvM0bJ_rgy3ZERon3lUN5W4XKDXVPfmqZs8cWpSlhTxhV3xmM4gNvvoNqSq9mND35Jt8993gTM43_z_4v-JYEOevCX3u9vpz26SUFskcqOVtT55aTtCIPvZlr8QxZCshjdDoRGLWdd1a6Ybd0oS-XpGQG7MsXkNqebFer-r7Ra9_Do2lOw) · [raw](https://github.com/Catalyst-Forge-LLC/localhelm/blob/main/APP_FACTS.md)
