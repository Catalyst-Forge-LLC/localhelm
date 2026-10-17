---
title: Dashboard
---

```bash
localhelm serve
localhelm serve --host 127.0.0.1 --port 4321
```

Run serve from the folder that contains your repos (or a child of the fleet file). Default bind is **all interfaces** on **4321**. `--host` / `--hosts` (Vite-style, with or without an address) also means all interfaces. `--host 127.0.0.1` stays loopback-only. The checkout dashboard (`app/`) calls the same library as the CLI.

An empty board is not “all quiet.” Today and the header say **No fleet** and offer **Add projects**. Sites and Ports stay optional until you enroll those checkouts.

**Demo board** (menu **Main / Demo** pills, or `localhelm serve --demo`) writes `localhelm.fleet.demo.json` and `.localhelm/demo/` next to the real workspace. Add and remove stay off the main fleet. **Clear demo** asks first, then deletes only those demo paths. Writes that would change a repo (commit, publish, push, Land) are refused until you leave demo.

![LocalHelm operator board with Today needs, FilePress sites, and LocalSlip ports](/dashboard.jpg "The operator board. Today lists writes to confirm. FilePress sites and LocalSlip ports sit beside it.")

A phone or any other device on LAN or Tailscale opens the **Deck** (`/deck`). It is read-only: one tile per running app that has a LocalSlip claim and listens beyond `127.0.0.1`. Tap a tile to open it on that host. Long-press copies the link. From the operator board, menu **Deck** is the same page. `/visitor` still redirects there. Write APIs stay on loopback.

## Tabs

| Tab | What it is |
| --- | --- |
| Today | Needs you (writes), Looks (Ports facts), Sites and Ports snapshots |
| Fleet | Enrolled repos: version, git, pins, the same writes as Today |
| Sites | FilePress jobs, if a FilePress site is enrolled |
| Ports | [LocalSlip](https://localslip.dev) leases, if enrolled |

The same product can appear on three tabs. **Also on** chips jump and check that id.

## Reads versus writes

Commit-message drafts use Ollama on `127.0.0.1:11434` by default. To send repository text to another host, explicitly set `LOCALHELM_OLLAMA_MACHINE` or `LOCALHELM_OLLAMA_URL`; optionally select `LOCALHELM_OLLAMA_MODEL`. The dialog names the destination before requesting drafts. Drafting does not scan the LAN or select a cached remote. Discovery (`ollanet scan --lan`) is a separate opt-in operation; configure the chosen destination afterward. If drafting fails, the editable fallback remains.

Header **Refresh** re-reads enrolled projects, Sites, and Ports. Row refresh is the same for one id. **Fetch remotes** runs `git fetch` and clears the five-minute npm cache. Those are observations plus a remote update. They do not publish.

Start and stop on Ports ask LocalSlip. Commit, Push, Publish, Ship, Install global, Write pins, enroll, and plugin jobs (including start and stop) open a plan modal right away. A spinner and the current step show while the plan loads, then the list fills in. Confirm applies. Close leaves disk unchanged. Publish covers both an already-bumped version and a bump plus npm when origin has commits since the last published version. After a laptop npm publish, confirm can offer to install that CLI globally. If some of a batch fail, the confirm lists those first with a reason; click a name. Activity keeps the full npm log. Install checks that exact version on npm first; if a new publish is not visible yet, confirm offers Wait or Try again.

Publish OTP lives in the confirm modal. Never `--force`.

## New Cloudflare Pages projects

For a Pages deploy script with explicit `--project-name` and `--branch`, **Ship** checks whether the project exists before building. If it is missing, **Create Pages project** shows the Cloudflare account name and ID, project, production branch, and site directory. Cancel creates nothing. Confirm creates the empty project, then **Open Ship plan** leads to a separate deployment confirmation.

A failed Ship that reports a missing Pages project offers **Review Pages setup**. LocalHelm rechecks the target before writing and preserves the failed action in history. Existing projects are reused. Account ambiguity, authentication failures, and custom Wrangler/environment configuration require manual setup; LocalHelm does not guess the target. Demo cannot create projects.

## npm private packages

In Fleet, the existing **private** text beside a package's version is a link to
remove its `private: true` flag. The confirmation names the package and exact
`package.json` before writing. Cancel leaves the file unchanged. Confirm removes
only that top-level property, preserves other fields, and refreshes the row's
package/npm status. The edit stays local for review and commit; ordinary Publish
checks and its separate confirmation still apply.

This is npm publishability, separate from GitHub repository visibility. It does
not publish, push, or change repository access. Public packages have no added
control, and there is no action to add the flag. Demo mode cannot apply the edit.
If the enrolled root is a development harness with a separate generated release,
removing its flag does not configure that separate release target.

## Stale and unavailable

When Git refuses a checkout with “detected dubious ownership,” Today and Fleet offer **Trust this directory**. The modal shows the exact checkout root and explains that confirmation adds it to Git’s global trusted-directory list for the account running LocalHelm. Trust only a repository you control. Cancel makes no change; confirmation adds that one directory and refreshes its Git status. No wildcard or whole-workspace trust is added. Demo mode cannot apply it.

An unreadable Git status is labeled **Git trust required** or **Git status unavailable**, rather than “nothing to do.” Other Git errors do not offer the trust action.

If a remote cannot be read, the board says ahead and behind counts may be stale. Local dirty and version cells stay from this machine. An npm fetch error is an error, not a clean match. Empty Sites or Ports means that plugin or LocalSlip is not in play, not that those systems are healthy.
