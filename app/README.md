# LocalHelm dashboard

Checkout-only SvelteKit loopback UI. Not in the npm tarball.

```bash
# from the localhelm repo, in a folder that can see localhelm.fleet.json
pnpm cli serve
# default http://127.0.0.1:4321  (or localslip get localhelm)
```

The page calls the same TypeScript library as the CLI.

- **Read** buttons (refresh, fetch) change no files.
- **Write** buttons stay disabled until you have run the matching **Plan**, and they re-lock on every refresh.
- The "needs you" column is the point of the screen: unpublished versions, dirt, pins behind, unreadable remotes.
- **Ready to publish** is a list, not a button. You still type `pnpm publish` in that repo.
- **Cascade** retargets dependents to the published `^V`. Plan first; write commits those pin + lockfile paths by default.
- A remote that cannot be read is a side note, never a replacement for local status.
