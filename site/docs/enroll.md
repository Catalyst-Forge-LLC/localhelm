---
title: Enroll
---

The fleet is chosen, not auto-enrolled.

```bash
localhelm scan ..
localhelm enroll ../my-cli ../my-lib --apply
localhelm unenroll old-name --apply
```

`scan` proposes folders (git?, `package.json` name/version, private). Nothing joins the fleet until you confirm.

## Manifest

`localhelm.fleet.json` lives at the shared parent (`workspaceRoot: "."`). Each row is an id, a path, and optional npm name or group.

Removing a row never deletes a folder. Archive hides a row on Today without unenrolling.

## Ignore

Put gitignore-style patterns in `.localhelmignore`. Optional user-global list: `~/.localhelm/ignore`.
