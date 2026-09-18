---
title: Enroll
---

Which apps and sites join the fleet is chosen, not auto-enrolled.

On the dashboard, **Add projects** is the confirm: scan a folder, tick rows, then write. From a terminal:

```bash
localhelm scan .
localhelm enroll ./my-cli ./my-lib --apply
localhelm unenroll old-name --apply
```

`scan` proposes folders (git?, `package.json` name/version, private). Nothing joins the fleet until you confirm. Serve from the folder that holds `localhelm.fleet.json` (or a child) so the board finds it.

## Manifest

`localhelm.fleet.json` lives at the shared parent (`workspaceRoot: "."`). Each row is an id, a path, and optional npm name or group.

Removing a row never deletes a folder. Archive hides a row on Today without unenrolling.

## Ignore

Put gitignore-style patterns in `.localhelmignore`. Optional user-global list: `~/.localhelm/ignore`.
