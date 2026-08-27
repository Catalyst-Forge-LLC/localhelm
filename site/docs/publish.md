---
title: Publish
---

```bash
localhelm auth
localhelm publish ollanet
localhelm publish ollanet --apply
localhelm publish ollanet --apply --otp 123456
```

`publish` requires named project ids. It bumps and pushes only when needed, then `npm publish --access public`. Never `--force`.

## Two gold writes

| Button | When |
| --- | --- |
| **Publish 0.1.2** | Local version is already ahead of npm |
| **Cut 0.1.3 · 4 commits** | Local already matches npm (0.1.2). Origin has 4 commits since that version. The button is the next patch, not a version number. |
| **Push 4 commits** | Branch is 4 commits ahead of origin. Uncommitted files stay local. A bare `(4)` on a toolbar button is selected rows, not commits. |

Cut is a patch by default. Use Fleet to pick minor or major before you confirm.

## What blocks a publish

Dirty trees, private packages, diverged remotes, and “nothing to cut” (origin has no work since the last npm version). Push of commits that are already ahead does **not** wait for a clean tree; uncommitted files stay local.

## Auth

Intended setup is `localhelm auth` plus a granular automation token (Bypass 2FA) in the **user** `~/.npmrc`. npm is moving to trusted/staged publish after ~Jan 2027.
