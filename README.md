<p align="center">
  <img src="https://unpkg.com/localhelm/site/static/logo.png" alt="LocalHelm" width="218" />
</p>

# LocalHelm

**Control panel for local development.**

See which local projects need attention: uncommitted work, package versions, dependents, and supported site or port status. Scan proposes. You enroll. `status` is a read. Writes need `--apply`. [LocalSlip](https://localslip.dev) is the slip. LocalHelm is the wheel. Ports and FilePress jobs are optional.

<p align="center">
  <img src="https://localhelm.dev/dashboard.jpg" alt="LocalHelm dashboard: Today needs and FilePress sites" />
</p>

```bash
pnpm add -g localhelm
# or from a checkout:
pnpm install && pnpm build

# From the folder that contains your repos:
localhelm serve
```

Open `http://127.0.0.1:4321`. **Add projects**, scan that folder (`.` is where you ran serve), tick the ones you keep, then write. Nothing auto-enrolls. LocalSlip and FilePress are optional later.

The same actions exist on the CLI if you want them. `scan` never writes. Other commands print a plan; `--apply` writes. `publish`, `push`, `ship`, and `global` need named ids. Never `--force`.

```bash
localhelm scan .
localhelm enroll ./my-cli ./my-lib --apply
localhelm status
localhelm serve --free-port             # stop the named pid on that port, then serve
```

`localhelm serve` opens the dashboard on port 4321. A global install runs the packaged board (SSR deps are bundled; no `app/` needed). A checkout still uses Vite. Serve from the same tree as `localhelm.fleet.json` (or a child) or the board stays empty. If that port is already taken, serve names the pid and stops. Re-run with `--free-port` to stop it and bind. Never `--force`. Writes stay on loopback.

Skip folders with `.localhelmignore` at the workspace, or `~/.localhelm/ignore`.

Requires Node 22+. License Apache-2.0. Site: [localhelm.dev](https://localhelm.dev).

<!-- xfacts-label -->

## xFacts label

- **AppFacts:** [viewer](https://appfacts.dev/v#af1.eNpNUUFOwzAQ_Irlc5oAx56KIiEBFZciLggh19km2zq2ZW_SRlX_zjqmhZOl2ZnZ2fFZjnJ5X0irepBLaZxWpgPTy0LS5BNUr58FOWcYiaRoiIwpTTgCIwY12Jhoj17pDhYP5V0m6oNcnqVRth1UmwjvbLfRAT0VYjOCISjEixpVxlgUBks4p3hzDZT7yNgucK6jC2wms-gVaV4wGbRtslVojmgbUW82KTQnzYMPTBu89b28FLIBz8E_z9LyaBVnq32sDrObZ-wIW3HbJnYuiEbFbutUaFifdRRPv-zUTZyDCziBHgidnUXc1h8dvZ_yHUmDliDk5uZCeSy0672zYCneVCvUzuJuqnLIq5hBEadIwOd8FXI7oGlSw1z7gQv-7pXlJzD1enLnevC5-47Ix2VV3b63bGBMlYN3EcmF6R-pReqGbcnRqlqRMrx08eRCC4v1uv6zkJcfq5PB9g) · [raw](https://github.com/Catalyst-Forge-LLC/localhelm/blob/main/APP_FACTS.md)

