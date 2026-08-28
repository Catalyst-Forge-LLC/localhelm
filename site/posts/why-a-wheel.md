---
title: Why a wheel
date: 2026-08-27
description: git status answers one repo. The scarce resource is the fleet.
tags: [notes]
---

`git status` in a folder answers that folder. After a morning of publishes, the question is which products are dirty, which versions never made it to npm, and which dependents still pin last week’s package. The same board also holds local tools that never publish.

You scan a parent folder, check the ones you keep, and read git, npm, and pins in one place. Writes print a plan. `--apply` is the confirm. Never `--force`.

[LocalSlip](https://localslip.dev) is the slip: a name for a port you still type. LocalHelm is the wheel.
