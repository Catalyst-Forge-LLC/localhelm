---
title: LocalHelm
description: Status for the products you ship.
---

<aside class="dict">
<p><strong>helm</strong> <span class="pos">n.</span> the wheel by which a ship is steered.</p>
</aside>

You have a folder of repos. `git status` in one of them answers that repo. The scarce resource is knowing which **products** are dirty, unpublished, or still pinned to last week’s package.

Name the fleet. Scan a folder, check the ones you ship, then read git, npm, and dependents in one place.

```text
localhelm scan ..
localhelm enroll ../filepress ../ollanet --apply
localhelm status
localhelm serve
```

**LocalBerth** is the slip; **LocalHelm** is the wheel.

After you install, `localhelm serve` opens the dashboard at `http://127.0.0.1:4321`.

[Docs](/docs) · [Install](/install) · [Why a wheel](/posts/why-a-wheel)
