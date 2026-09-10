---
title: LocalHelm
description: See which local projects need attention in one place.
---

<aside class="dict">
<p><strong>helm</strong> <span class="pos">n.</span> the wheel by which a ship is steered.</p>
</aside>

See which local projects need attention in one place: uncommitted work, package versions, dependents, and supported site or port status. Choose the repositories you track, then inspect their current state.

Scan a folder, enroll the ones you keep, then read git, npm, and dependents. LocalSlip and FilePress are optional add-ons, not a suite install.

```text
localhelm scan ..
localhelm enroll ../my-cli ../my-lib --apply
localhelm status
```

`scan` never writes. `status` is a read. Other commands print a plan. `--apply` writes. `publish`, `push`, and `ship` need named ids. Never `--force`.

`localhelm serve` opens the operator board at `http://127.0.0.1:4321`. Writes stay on loopback. The **Deck** at `/deck` is the phone tile grid.

[LocalSlip](https://localslip.dev) is the slip. LocalHelm is the wheel.

[Docs](/docs) · [Install](/install) · [Why a wheel](/posts/why-a-wheel)
