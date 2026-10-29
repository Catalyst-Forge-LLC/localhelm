---
title: "Run, commit, and ship every project from one board."
description: "Local command center for your projects. Start and stop apps, commit and push, and when a project is ready to go out, publish packages to npm, update dependents, and deploy sites. Every write shows its plan first and runs after you confirm."
---

<section class="value-hero" aria-label="LocalHelm overview"><div class="value-intro"><p class="value-kind">Local command center for your projects</p><h1>Run, commit, and ship every project from one board.</h1><p class="value-lede">Start and stop your apps locally, then commit and push the work. When a project is ready to go out, LocalHelm can also bump its version, publish packages to npm, update the projects that depend on them, and deploy sites. Work across many repos at once. Every write shows its plan first and runs after you confirm, on the computer hosting your projects.</p><div class="cta-row"><a class="cta cta-primary" href="/install">Install LocalHelm</a><a class="cta cta-secondary" href="#operator-board">See the operator board</a></div><p class="value-limit">The operator board runs locally. The phone Deck is read-only. Dev-server controls require LocalSlip.</p></div><figure class="value-proof" id="operator-board" tabindex="-1"><figcaption>LocalHelm operator board</figcaption><a href="/dashboard.jpg"><img src="/dashboard.jpg" alt="LocalHelm operator board with Today needs, FilePress sites, and LocalSlip ports" width="1280" height="720"></a><p class="value-note">Running apps, uncommitted work, releases, and sites on one board. Inspect each plan before confirming a write.</p></figure></section>

The controls depend on where you open it:

- **Operator board**, `http://127.0.0.1:4321` on the machine that runs `localhelm serve`: every read and every write.
- **Deck**, `/deck` from a phone or any other device on your LAN or Tailscale: read-only. It shows one tile per running app that has a [LocalSlip](https://localslip.dev) claim and listens beyond `127.0.0.1`. Tap a tile to open that app. Long-press to copy its link. No commit, publish, start, or stop.

LocalHelm refuses write requests unless they come from loopback, so a phone cannot run them even with the right URL.

## Run the operator board

Install, stand in the folder that contains your repos, then run:

```text
localhelm serve
```

On the board, click **Add projects**, scan the folder, tick the repos you keep, and confirm. Nothing enrolls on its own.

The CLI runs the same actions. `scan`, `status`, and `deps` only read. Other commands print a plan, and `--apply` writes. `publish`, `push`, `ship`, and `global` need named ids. Never `--force`.

Start and stop need LocalSlip. The Sites tab needs a FilePress site. Both are optional; without them those tabs stay empty.

LocalSlip is the slip. LocalHelm is the wheel.

[Docs](/docs) · [Install](/install) · [Why a wheel](/posts/why-a-wheel)
