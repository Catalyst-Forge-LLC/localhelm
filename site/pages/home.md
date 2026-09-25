---
title: See which local projects need work.
description: One control panel for the projects on your machine. See which need work, then commit, push, publish, and start or stop dev servers from the same board.
---

<aside class="dict">
<p><strong>helm</strong> <span class="pos">n.</span> the wheel by which a ship is steered.</p>
</aside>

See which projects need a commit, push, release, or dependency update. Review the proposed changes before applying them.

Start with the repository board. Add LocalSlip for the documented dev-server workflow, FilePress for site builds, and ollanet for optional model-assisted drafting. Those are optional. The core board is the repo list.

<div class="cta-row">
  <a class="cta cta-primary" href="/install">Install LocalHelm</a>
  <a class="cta cta-secondary" href="https://github.com/Catalyst-Forge-LLC/localhelm">View on GitHub</a>
</div>

Commit, publish, and dependent-update actions show a plan for you to confirm before they run. Actions run on the computer hosting LocalHelm.

The controls depend on where you open it:

- **Operator board**, `http://127.0.0.1:4321` on the machine that runs `localhelm serve`: every read and every write.
- **Deck**, `/deck` from a phone or any other device on your LAN or Tailscale: read-only. It shows one tile per running app that has a [LocalSlip](https://localslip.dev) claim and listens beyond `127.0.0.1`. Tap a tile to open that app. Long-press to copy its link. No commit, publish, start, or stop.

LocalHelm refuses write requests unless they come from loopback, so a phone cannot run them even with the right URL.

![LocalHelm operator board with Today needs, FilePress sites, and LocalSlip ports](/dashboard.jpg "The operator board. Today lists writes to confirm. FilePress sites and LocalSlip ports sit beside it.")

Install, stand in the folder that contains your repos, then run:

```text
localhelm serve
```

On the board, click **Add projects**, scan the folder, tick the repos you keep, and confirm. Nothing enrolls on its own.

The CLI runs the same actions. `scan`, `status`, and `deps` only read. Other commands print a plan, and `--apply` writes. `publish`, `push`, `ship`, and `global` need named ids. Never `--force`.

Start and stop need LocalSlip. The Sites tab needs a FilePress site. Both are optional; without them those tabs stay empty.

LocalSlip is the slip. LocalHelm is the wheel.

[Docs](/docs) · [Install](/install) · [Why a wheel](/posts/why-a-wheel)
