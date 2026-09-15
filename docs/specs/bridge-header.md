# Bridge header — LocalHelm

**Spec kind:** Visual / IA  
**Status:** Draft (2026-09-14) — not locked; no build until operator says so  
**Related:** `docs/PHASE_1_BRIEF.md`, `docs/specs/cheap-surfaces.md`, `CONTEXT_PROMPT.md` sessions 43–44  
**Surfaces:** Dashboard `header` + `.status-rail` in `app/src/routes/+page.svelte` / `app/src/lib/dashboard.css`. Tabs stay **stations** under the bridge in v1.

Pairing: **LocalSlip is the slip (local DNS for ports). LocalHelm is the wheel.** Deck stays `/deck`. This spec elevates the header into a **bridge** — command center chrome for the wheel. It does not change CLI verbs, product names, or plugin hosts.

---

## 1. Problem

The header has width and almost no command-center job.

Today it is a **toolbar**:

| Zone | What sits there now |
| ---- | ------------------- |
| Left | Logo + “LocalHelm” + need chips tucked under the title |
| Right | Refresh, Pull, Push, activity, hamburger |
| Below | Status rail that is **blank** when idle (`&nbsp;`) |
| Menu | Serve host/port, npm whoami, remotes age, fleet path, Deck, brief, plugins |

The center of the band is empty. The facts that tell you “where the helm is pointed” are one click away. Refresh already streams real steps (`reading packages`, `checking npm`, `reading git`, Sites and Ports); the rail still reads like a leftover progress line when idle.

**Friction:** The operator cannot glance at the top of the board and know heading (where we serve, who npm is, remotes age) and situation (what needs a write) without opening the menu or scanning Today.

---

## 2. Goals

1. Use the full header width as a **bridge**: ident, situation, conn — plus a **keel** that is never blank after status is ready.
2. Surface facts we already compute (`serveLine`, `npmUser`, `fetchedAt`, `staleRemotes`, digest chips, live `statusNote`) without new APIs or persist.
3. Adopt a **sea-space** motif (old ship meet spaceship) that elevates chrome without costume or steampunk.
4. Keep button labels operator-plain (Refresh, Pull, Push). Motif is structure and light, not theme-park copy.
5. Peel later without rewriting ConfirmModal / `loadStatus` (same rule as TodayBoard).

### Non-goals

- Renaming the product, CLI (`localhelm`), or npm package.
- Steampunk (gears, rivets, pipes, Victorian serif, brass-for-brass).
- Neon cyberpunk, scanlines-as-skin, fake CRT, decorative radar.
- Made-up gauges that do not map to a real digest field.
- New APIs, new persist, fake telemetry, clock, or CPU meter.
- Pulling Fleet / Sites / Ports tables into the header.
- Restyling stations (Today / Fleet / plugin tabs) into the header in v1.
- Changing plan-then-confirm, write gates, or LocalSlip lease/firewall behavior.

---

## 3. Voice: sea-space-punk (not steampunk)

### Yes

- Ship words we already own: helm, fleet, deck, slip, land, ship, wake
- Bridge vocabulary for chrome only: bridge, binnacle, keel, sounding, conn, stations, logbook, locker
- Dark hull we already use (`#000` / `#1c1c21`)
- Instrument gold already on writes (`#c9a227` / `#fde68a`)
- Cyan / ice for live instruments (`.info` is already `#93c5fd`)
- Tight mono for counts and `host:port` (chart table, not display type)
- Hairline frames, corner ticks, lamp dots — HUD of a working bridge
- Quiet motion only when something is actually happening (keel step ticks on Refresh)

### No

- Gears, rivets, pipes, Victorian serif
- “Engage warp” / cosplay button labels
- Fake instruments
- Renaming UI tabs or CLI commands to match motif words

Internal / spec terms (binnacle, keel, conn) may appear in docs and class names. Operator-facing labels stay plain English.

---

## 4. Core concepts

| Term | Meaning |
| ---- | ------- |
| **Bridge** | The full header band: three bays + keel. |
| **Ident** | Port / wheel: mark, product name, heading (serve + npm). |
| **Situation / binnacle** | Center: instrument lamps from fleet digest (needs work). |
| **Conn** | Starboard: primary sounding (Refresh) + telegraph writes (Pull / Push) + logbook + locker. |
| **Keel** | Full-width strip under the bays. Always on after status is ready. Idle heading or live step. |
| **Stations** | Tab row under the bridge (Today, Fleet, Sites, Ports, plugins). Out of scope for v1 restyle. |
| **Sounding** | Refresh — re-read packages, npm, git, then Sites/Ports. |
| **Logbook** | Activity log control (icon + badge). |
| **Locker** | Hamburger menu: plugins, Deck, brief, fetch remotes, export, fleet path. |

---

## 5. Layout

```
┌────────────────────────── Bridge ──────────────────────────┐
│  Ident (wheel)     Situation (binnacle)      Conn (helm)   │
│  mark + title      instrument lamps          Refresh       │
│  heading line      (or All quiet)            Pull · Push   │
│                                              logbook · menu│
├────────────────────────── Keel ────────────────────────────┤
│  idle heading  ·  or live step  ·  or error / stale        │
└────────────────────────────────────────────────────────────┘
  Stations (tabs) — unchanged in v1
```

### 5.1 Ident (port / wheel)

- Keep the mark + **LocalHelm**.
- Add a one-line **heading** from facts we already have:
  - `serveLine` (host:port + LocalSlip lease / `--port` note)
  - npm user, or “npm not signed in” after `statusReady`
- Fleet path stays a **copyable whisper** in the locker (optional whisper under heading is allowed if it does not fight the title). Not a second `h1`.

### 5.2 Situation (center / binnacle)

- Need chips become **instrument lamps** with counts: unpublished, dirty, pins behind, missing, npm errors.
- Same data as `headerNeedChips` in `src/lib/fleetDisplay.ts` — still hide zeros.
- Click still jumps Today (pins still set `?need=pins`).
- This bay owns the empty center.
- When the fleet digest has no lamps and `statusReady` is true: one lamp **All quiet** (same rule as Today — never claim quiet before status finishes).
- Before status is ready: binnacle may show a quiet “Reading…” or stay empty; do not invent counts.

### 5.3 Conn (starboard / helm)

| Control | Role | Note |
| ------- | ---- | ---- |
| **Refresh** | Primary conn / sounding | Keep the word Refresh. Highest visual weight. |
| **Pull** / **Push** | Secondary telegraph | Fleet-wide writes; weight below Refresh. Stay in conn (default fork). |
| Activity | Logbook | Keep icon; badge stays (unseen / count). |
| Menu | Locker | Plugins, Deck, copy brief, fetch remotes, export JSON, fleet path, remotes/npm meta that still fits the panel. |

### 5.4 Keel (full width, always on)

| State | Copy |
| ----- | ---- |
| Busy write (`busy`) | `Working: {busy}…` (unchanged semantics) |
| Refresh / status note | Live step from progress stream: `reading packages (12 of 43)`, `checking npm…`, `reading git…`, `reading Sites and Ports` |
| Error | Existing error line |
| Stale remotes | Existing stale warning |
| Idle after `statusReady` | Never blank. Example: `Fleet N · remotes fetched {time} · npm {user}` or `Fleet N · remotes not fetched this session · npm not signed in` |
| Idle before status | May show `reading packages…` / boot note; not a permanent empty spacer |

### 5.5 Stations

Today / Fleet / Sites / Ports / plugin tabs stay the row below the bridge. v1 does not fold them into the header or restyle them as “stations” chrome beyond optional later work.

### 5.6 Narrow viewport

Bays stack: Ident → Situation → Conn → Keel. No horizontal scroll of the bridge. Conn actions wrap; lamps wrap.

---

## 6. What moves, what stays

### Up onto the glass (already computed)

| Fact | Source today | Bridge home |
| ---- | ------------ | ----------- |
| Serve host/port | `serveLine` (menu hint) | Ident heading |
| npm whoami | `npmUser` (menu) | Ident heading + keel idle |
| Remotes age | `fetchedAt` (menu) | Keel idle |
| Stale remotes | `staleRemotes` (rail) | Keel |
| Digest needs | `headerNeedChips` | Situation lamps |
| Live Refresh phases | `statusNote` | Keel busy |

### Stay in the locker

- Plugin on/off
- Deck link (`/deck`)
- Copy brief
- Fetch remotes (menu write; keel mentions remotes age only)
- Export inventory JSON
- Fleet file path (copy)

### Do not add

- New APIs, new persist, fake telemetry
- Clock, CPU meter, decorative radar
- Fleet / Sites / Ports tables in the header

---

## 7. Open forks (defaults)

| Fork | Default | Alternative |
| ---- | ------- | ----------- |
| Pull / Push placement | Stay in **conn** | Fleet-tab toolbar only |
| Empty digest | **All quiet** lamp after `statusReady` | Leave binnacle blank |
| Fetch remotes | Stay in **locker** | Second conn control |

Defaults stand unless the operator overrides when locking or building.

---

## 8. Acceptance (when built)

1. With a loaded fleet and quiet digest, the header shows Ident heading + All quiet + idle keel with Fleet N / remotes / npm — no blank keel spacer.
2. With unpublished / dirty / pins behind, situation shows those lamps; click opens Today (pins still filters pins).
3. Refresh updates the keel through packages → npm → git → Sites and Ports, then returns to idle keel copy.
4. Locker still exposes plugins, Deck, brief, fetch remotes, export, fleet path.
5. Desktop and a narrow viewport: no clipped primary controls; bays stack sanely.
6. No steampunk chrome; no renamed CLI or product strings.

---

## 9. Implementation later (out of this draft)

Do **not** build until the operator locks this spec and asks to implement.

1. Lock this file (`Status: Locked` + date).
2. Peel header markup to something like `BridgeHeader.svelte` (same peel rule as `TodayBoard.svelte` — ConfirmModal / `loadStatus` / URL state stay on `+page.svelte`).
3. Tokens + keel idle copy in `app/src/lib/dashboard.css` only (or a small bridge section there). Prefer existing gold / cyan / hull colors.
4. Optional: `bridgeIdleLine(...)` helper next to `headerNeedChips` for keel idle string tests.
5. Browser-check desktop and narrow viewport.
6. Log decision in `.forgetrail/workflow_tracking.json`; session note in `CONTEXT_PROMPT.md`.

Cost: **Free/Cheap** — rearrange and restyle existing facts. No new daemon.

---

## 10. Questions for lock

1. Keep Pull/Push in conn, or Fleet-only?
2. Show **All quiet** when digest is empty, or leave the binnacle empty?
3. Keep Fetch remotes in the locker?

Until answered, §7 defaults apply.
