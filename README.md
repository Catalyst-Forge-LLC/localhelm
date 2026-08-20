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
```

`scan` never writes. `enroll` / `unenroll` print a plan; pass `--apply` to write `localhelm.fleet.json`. The tool never publishes and never git-pushes.

Requires Node 22+. License Apache-2.0. Site: [localhelm.dev](https://localhelm.dev).
