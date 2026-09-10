---
title: Publish
---

```bash
localhelm auth
localhelm publish my-lib
localhelm publish my-lib --apply
localhelm publish my-lib --apply --otp 123456
```

`publish` requires named project ids. It bumps and pushes only when needed, then `npm publish --access public`. Never `--force`.

## One Publish

| Button | When |
| --- | --- |
| **Publish 0.1.2** | Local version is already ahead of npm |
| **Publish 0.1.3 · 4 commits** | Local already matches npm (0.1.2). Origin has 4 commits since that version. Confirm bumps to 0.1.3 (patch by default) and publishes. |
| **Push 4 commits** | Branch is 4 commits ahead of origin. Uncommitted files stay local. A bare `(4)` on a toolbar button is selected rows, not commits. |

Use Fleet to pick minor or major before you confirm a bump-publish.

## What blocks a publish

Dirty trees, private packages, diverged remotes, and “nothing to publish” (origin has no work since the last npm version). Push of commits that are already ahead does **not** wait for a clean tree; uncommitted files stay local.

## Auth

Intended setup is `localhelm auth` plus a granular automation token (Bypass 2FA) in the **user** `~/.npmrc`. npm is moving to trusted/staged publish after ~Jan 2027.
