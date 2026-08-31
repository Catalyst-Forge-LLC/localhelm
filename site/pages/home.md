---
title: LocalHelm
description: Control panel for local development.
---

<aside class="dict">
<p><strong>helm</strong> <span class="pos">n.</span> the wheel by which a ship is steered.</p>
</aside>

You have a folder of repos. `git status` in one of them answers that repo. The local fleet is the apps and sites you keep, including tools that never publish. The board also shows ports and the Deck.

Scan a folder, check which ones to keep, then read git, npm, dependents, and listening leases in one place.

```text
localhelm scan ..
localhelm enroll ../my-cli ../my-lib --apply
localhelm status
localhelm serve
```

[LocalSlip](https://localslip.dev) is the slip; LocalHelm is the wheel.

`localhelm serve` opens the dashboard at `http://127.0.0.1:4321`.

[Docs](/docs) · [Install](/install) · [Why a wheel](/posts/why-a-wheel)
