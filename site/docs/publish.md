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
| **Cut version N** | Local matches npm, and origin has N commits since that version |

Cut is a patch by default. Use Fleet to pick minor or major before you confirm.

## What blocks a publish

Dirty trees, private packages, diverged remotes, and “nothing to cut” (origin has no work since the last npm version). Push of commits that are already ahead does **not** wait for a clean tree; uncommitted files stay local.

## Auth

Intended setup is `localhelm auth` plus a granular automation token (Bypass 2FA) in the **user** `~/.npmrc`. npm is moving to trusted/staged publish after ~Jan 2027.
