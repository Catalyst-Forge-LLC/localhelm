<p align="center">
  <img src="https://unpkg.com/localhelm/site/static/logo.png" alt="LocalHelm" width="218" />
</p>

# LocalHelm

**Control panel for local development.**

One control panel for the repos you choose. See which ones have uncommitted work, unpushed commits, unpublished versions, or dependents pinned to an old release. Then act from the same board: commit, push, publish, bump versions, update dependents, and start or stop dev servers. Every write opens a plan first and waits for you to confirm.

The controls depend on where you open it:

- **Operator board** at `http://127.0.0.1:4321`, on the machine that runs `localhelm serve`: every read and every write.
- **Deck** at `/deck`, from a phone or any other device on your LAN or Tailscale: read-only. One tile per running app that has a [LocalSlip](https://localslip.dev) claim and listens beyond `127.0.0.1`. Tap to open, long-press to copy the link. No commit, publish, start, or stop. Write requests from anywhere but loopback get a 403.

Start and stop need LocalSlip. The Sites tab needs a FilePress site. Both are optional. LocalSlip is the slip. LocalHelm is the wheel.

<p align="center">
  <img src="https://localhelm.dev/dashboard.jpg" alt="LocalHelm operator board with Today needs, FilePress sites, and LocalSlip ports" />
</p>

```bash
pnpm add -g localhelm
# or from a checkout:
pnpm install && pnpm build

# From the folder that contains your repos:
localhelm serve
```

Open `http://127.0.0.1:4321`. Click **Add projects**, scan that folder (`.` is where you ran serve), tick the ones you keep, and confirm. Nothing auto-enrolls.

The same actions exist on the CLI if you want them. `scan`, `status`, and `deps` only read. Other commands print a plan; `--apply` writes. `publish`, `push`, `ship`, and `global` need named ids. Never `--force`.

```bash
localhelm scan .
localhelm enroll ./my-cli ./my-lib --apply
localhelm status
localhelm serve --free-port             # stop the named pid on that port, then serve
```

Menu **Main / Demo** (or `localhelm serve --demo`) is a sandbox fleet (`localhelm.fleet.demo.json`). Add and remove stay off the main file. **Clear demo** wipes only that sandbox. Commit, publish, push, and Land stay off.

`localhelm serve` opens the dashboard on port 4321. A global install runs the packaged board (SSR deps are bundled; no `app/` needed). A checkout still uses Vite. Serve from the same tree as `localhelm.fleet.json` (or a child) or the board stays empty. If that port is already taken, serve names the pid and stops. Re-run with `--free-port` to stop it and bind. Never `--force`. Writes stay on loopback.

Skip folders with `.localhelmignore` at the workspace, or `~/.localhelm/ignore`.

Requires Node 22+. License Apache-2.0. Site: [localhelm.dev](https://localhelm.dev).

<!-- xfacts-label -->

## xFacts label

- **AppFacts:** [viewer](https://appfacts.dev/v#af1.eNpNUUFOwzAQ_Irlc5oAx56KIiEBFZciLggh19km2zq2ZW_SRlX_zjqmhZOl2ZnZ2fFZjnJ5X0irepBLaZxWpgPTy0LS5BNUr58FOWcYiaRoiIwpTTgCIwY12Jhoj17pDhYP5V0m6oNcnqVRth1UmwjvbLfRAT0VYjOCISjEixpVxlgUBks4p3hzDZT7yNgucK6jC2wms-gVaV4wGbRtslVojmgbUW82KTQnzYMPTBu89b28FLIBz8E_z9LyaBVnq32sDrObZ-wIW3HbJnYuiEbFbutUaFifdRRPv-zUTZyDCziBHgidnUXc1h8dvZ_yHUmDliDk5uZCeSy0672zYCneVCvUzuJuqnLIq5hBEadIwOd8FXI7oGlSw1z7gQv-7pXlJzD1enLnevC5-47Ix2VV3b63bGBMlYN3EcmF6R-pReqGbcnRqlqRMrx08eRCC4v1uv6zkJcfq5PB9g) · [raw](https://github.com/Catalyst-Forge-LLC/localhelm/blob/main/APP_FACTS.md)


[See the rest of the Catalyst Forge shelf.](https://catalystforge.com/tools/)
