---
title: LocalHelm
description: Control panel for local development.
---

<aside class="dict">
<p><strong>helm</strong> <span class="pos">n.</span> the wheel by which a ship is steered.</p>
</aside>

You have a folder of repos. `git status` in one of them answers that repo. The board is also for **local tools** that never publish: sites, ports, and the phone tile grid.

Name the fleet. Scan a folder, check the ones you keep, then read git, npm, dependents, and listening leases in one place.

```text
localhelm scan ..
localhelm enroll ../filepress ../ollanet --apply
localhelm status
localhelm serve
```

**LocalSlip** is the slip; **LocalHelm** is the wheel.

After you install, `localhelm serve` opens the dashboard at `http://127.0.0.1:4321`.

[Docs](/docs) · [Install](/install) · [Why a wheel](/posts/why-a-wheel)
