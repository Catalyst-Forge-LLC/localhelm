# LocalHelm dashboard

Checkout-only SvelteKit loopback UI. Not in the npm tarball.

```bash
# from the localhelm repo, in a folder that can see localhelm.fleet.json
pnpm cli serve
# default http://127.0.0.1:54322  (or localberth get localhelm)
```

The page calls the same TypeScript library as the CLI. Writes still go through a plan; `--apply` is a checkbox/button, not an implicit confirm.
