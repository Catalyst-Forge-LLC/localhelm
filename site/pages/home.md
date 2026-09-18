---
title: LocalHelm
description: See which local projects need attention in one place.
---

<aside class="dict">
<p><strong>helm</strong> <span class="pos">n.</span> the wheel by which a ship is steered.</p>
</aside>

See which local projects need attention in one place: uncommitted work, package versions, dependents, and supported site or port status. Choose the repositories you track, then inspect their current state.

![LocalHelm dashboard showing Today needs and FilePress sites](/dashboard.jpg "Today: fleet writes you can confirm, and FilePress sites waiting on Land")

Install, stand in the folder that contains your repos, then `localhelm serve`. On the board, **Add projects**, scan, tick, and write. LocalSlip and FilePress are optional add-ons, not a suite install.

```text
localhelm serve
```

`scan` never writes. `status` is a read. Other commands print a plan. `--apply` writes. `publish`, `push`, and `ship` need named ids. Never `--force`. The CLI can enroll the same way if you want a terminal.

`localhelm serve` opens the operator board at `http://127.0.0.1:4321`. Serve from the fleet’s parent folder. Writes stay on loopback. The **Deck** at `/deck` is the phone tile grid.

[LocalSlip](https://localslip.dev) is the slip. LocalHelm is the wheel.

[Docs](/docs) · [Install](/install) · [Why a wheel](/posts/why-a-wheel)
