# Bridge header — LocalHelm

**Spec kind:** Visual / IA  
**Status:** Locked (2026-09-14)  
**Chrome pass (2026-09-14):** First build still read as the old toolbar — `--hairline` on `--hull` is invisible, lamps were the old chips. Operator asked for more sea-space. Hairlines use `--steel`, lamps are instrument plates (count + word + halo), keel is a recessed waterline strip. Still no bay labels, no steampunk, no fake gauges.  
**HUD pass (2026-09-15):** Operator brought cinematic sci-fi dashboard references (corner brackets, chart grid, cyan edge light, big mono numbers over tracked labels). The mix is now explicit — see §3.1. Framing device switched from hairline dividers to **corner brackets** (supersedes §10 answer 5). Chart-paper grid on the hull, `--cyan` running lights, glow allowed on lamp dots, keel line, and Refresh. Labels still plain; no gauges that don't map to a digest field.  
**Stations + body (2026-09-15):** Operator asked to go brighter and carry the HUD to tabs / boards / tables. Chart grid is on the whole `.shell`. Stations are tracked uppercase with a cyan active underline. Panels get corner ticks; writes stay gold.  
**Gauges + Deck (2026-09-15):** Keel copy moved into the situation bay (not a strip under the logo). Three dials — Fleet / Sites / Slips — show real counts; the arc is `need / count`. Shared tokens live in `app/src/lib/helm-hud.css` so Deck can wear the same hull.  
**Overlays (2026-09-15):** Confirm, Add, locker, tooltips, and the activity drawer use the same hull / steel / well / gold chrome. Plan-then-confirm behavior is unchanged.  
**Deck tiles (2026-09-15):** Phone grid stays. Tiles are frosted glass plates (`--glass-fill` + blur) with a short lift/glow hover — not operator tables.
**Related:** `docs/PHASE_1_BRIEF.md`, `docs/specs/cheap-surfaces.md`, `CONTEXT_PROMPT.md` sessions 43–46  
**Surfaces:** Dashboard `header` + `.status-rail` + stations + body chrome in `app/src/routes/+page.svelte` / `app/src/lib/dashboard.css`. Deck (`/deck`) stays out.

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
- Lamp dots as the motif element that carries meaning; **one** framing device — corner brackets (chosen 2026-09-15 over hairline dividers)
- Chart-paper grid on the hull at about 11% cyan — brighter after the 2026-09-15 pass; still texture, not scanlines
- Glow only where a light is on: lamp dots and counts, the keel rule and marker, Refresh, `host:port`. No hull glow, no page gradients.
- Quiet motion only when something is actually happening (keel step ticks on Refresh); none at idle

### No

- Gears, rivets, pipes, Victorian serif
- “Engage warp” / cosplay button labels
- Fake instruments
- Renaming UI tabs or CLI commands to match motif words
- Hull glow, page gradients, or borders that do not separate anything. Instrument glow (see Yes) is allowed.
- Radar sweeps, waveforms, globes, progress rings with no digest field behind them.
- **New words on the glass.** No “BRIDGE” / “SITUATION” microcaps or bay labels shown to the operator. Motif is carried by geometry and lamps, not by naming bays.
- A new color (e.g. green for “quiet”). Reuse hot / warm / bad / info tones only.

Internal / spec terms (binnacle, keel, conn) may appear in docs and class names. Operator-facing labels stay plain English. Avoid compass-side words (port / starboard) in class names — they collide with `host:port` and the Ports tab.

### 3.1 The mix, stated plainly

“Sea-space-punk” is a **ship's bridge drawn as a HUD.** Each element has one foot in each world:

| Element | Sea | Space |
| ------- | --- | ----- |
| Hull background | dark navy, chart paper | faint cyan grid (the reference boards' grid) |
| Bay frames | brass corner fittings | HUD corner brackets — thin cyan ticks, not full boxes |
| Lamps | engine-room indicator lamps | big tabular-mono count over a tracked uppercase label, side stripe, glowing dot |
| Refresh | taking a sounding | cyan running light; the one cool-toned control |
| Pull / Push | brass engine telegraph | outlined gold plates, glow on hover |
| Keel | waterline | glowing cyan rule with a diamond marker that turns gold when busy, red on error |
| Words | helm, fleet, deck, land, ship | none — no “SYSTEMS NOMINAL”, no station names on glass |

**Cyan is for live / reading / heading. Gold is for a write that is waiting. Red is for broken.** Nothing else glows. If a reference-board element cannot be tied to a real fact (radar sweep, waveform, globe), it stays off the bridge.

---

## 4. Core concepts

| Term | Meaning |
| ---- | ------- |
| **Bridge** | The full header band: three bays + keel. |
| **Ident** | Left bay: mark, product name, heading (serve + npm). |
| **Situation / binnacle** | Center bay: instrument lamps from fleet digest (needs work). |
| **Conn** | Right bay: primary sounding (Refresh) + telegraph writes (Pull / Push) + logbook + locker. |
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

### 5.1 Ident (left)

- Keep the mark + **LocalHelm**.
- Add a one-line **heading** from facts we already have:
  - `serveLine` (host:port + LocalSlip lease / `--port` note)
  - npm user, or “npm not signed in” after `statusReady`
- **Composition:** `host:port` in mono on the glass. The lease / `--port` note is demoted to a tooltip or a trailing dim whisper; it must not push the heading to two lines. `serveLine` today can be as long as “serving :4321 on all interfaces (port leased from LocalSlip)” — do not print that verbatim.
- **Empty case:** when the serve port is unknown (dev server without env), the heading shows only the npm part; never an empty line or a placeholder like `—:—`.
- Fleet path stays a **copyable whisper** in the locker (optional whisper under heading is allowed if it does not fight the title). Not a second `h1`.

### 5.2 Situation (center / binnacle)

- Need chips become **instrument lamps** with counts: unpublished, dirty, pins behind, missing, npm errors.
- Same data as `headerNeedChips` in `src/lib/fleetDisplay.ts` — still hide zeros.
- Each lamp is a `<button>` (not a div with a dot) with an `aria-label` that includes the count and destination, e.g. `3 unpublished — open Today`.
- **Click → Today with the matching filter** (`NeedFilter` in `src/lib/dashboardTypes.ts`):

  | Lamp | Today filter |
  | ---- | ------------ |
  | unpublished | `publish` |
  | dirty | `push` |
  | pins behind | `pins` (sets `?need=pins`, unchanged) |
  | missing | `all` |
  | npm errors | `all` |

- **Tone map** (reuse existing dashboard tones; no new colors):

  | Tone | Existing class | Lamps |
  | ---- | -------------- | ----- |
  | gold | `hot` / `warm` | unpublished, dirty, pins behind — a write is waiting |
  | red | `bad` | missing, npm errors — something is broken |
  | cyan | `info` | live / reading |
  | dim | — | All quiet: dim ice, steady dot |

- This bay owns the empty center.
- When the fleet digest has no lamps and `statusReady` is true: one lamp **All quiet** (same rule as Today — never claim quiet before status finishes).
- Before status is ready: binnacle may show a quiet “Reading…” or stay empty; do not invent counts.
- **During a re-read, lamps hold.** `statusReady` stays `true` while Refresh runs, so a naive build flickers to All quiet or to zero lamps mid-read. Lamps keep their last values (dimmed) and update only when the new inventory lands. Never claim quiet *during* status either.

### 5.3 Conn (right)

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
| Idle after `statusReady` | Never blank. Contract below. |
| Idle before status | May show `reading packages…` / boot note; not a permanent empty spacer |

**Precedence** (one keel, one message; same if/else chain the rail uses today):

1. `busy` → `Working: {busy}…`
2. `statusNote` → live step
3. `error` → error line
4. idle line, with **stale remotes merged in** (not replacing it)

`error` clears when the next read or write starts — not on a timer, not on click. Stale remotes do **not** evict the idle heading; they fold into it (see contract).

**Idle line contract** (exact, so it can be tested):

- Separator: ` · `
- Order: `Fleet {N}` · remotes · npm
- `N` = enrolled projects in the digest, **excluding** archived/hidden rows. If any are hidden, append `· {H} hidden` after `Fleet {N}`.
- remotes: `remotes fetched {fetchedAt}` (existing `toLocaleTimeString` form) or `remotes not fetched this session`. If `staleRemotes` is non-empty, append `· {S} could not be read`.
- npm: `npm {user}` or `npm not signed in`.

Examples:

```
Fleet 43 · remotes fetched 9:41:07 PM · npm acme
Fleet 41 · 2 hidden · remotes not fetched this session · npm not signed in
Fleet 43 · remotes fetched 9:41:07 PM · 3 could not be read · npm acme
```

Build this string in a pure helper `bridgeIdleLine(...)` in `src/lib/fleetDisplay.ts` next to `headerNeedChips` (no `node:*` imports) and unit-test it. This is the one piece of logic in the spec worth a test; it is **not** optional.

**Height:** the keel is one line. Only the error state may grow, keeping the existing `.err` `max-height: 4.5em` scroll. Idle and live copy truncate with an ellipsis rather than wrap.

### 5.5 Stations

Today / Fleet / Sites / Ports / plugin tabs stay the row below the bridge. They are **stations** chrome now (tracked uppercase, cyan active underline, mono counts) but they are not folded into the header. Operator labels stay Today / Fleet / Sites / Ports.

### 5.6 Narrow viewport

- **Breakpoint:** bays stack at **≤ 48rem** (768px). The drawer already breaks at 1100px; the bridge does not need to follow it — the bays fit side by side well below that.
- **Stack order (locked):** Ident → Situation → Conn → Keel. Operator chose this over Ident + Conn first.
- No horizontal scroll of the bridge. Conn actions wrap; lamps wrap.

### 5.7 Guardrails

These prevent the most likely wrong builds. Treat them as acceptance, not advice.

| # | Guardrail | Why |
| - | --------- | --- |
| G1 | **Height budget.** Bridge (bays + keel) is no taller than today's `header` + `.status-rail` on desktop (≈ 5.5rem). Measure before and after. | The shell is `100vh` / `overflow: hidden`; every pixel the bridge grows comes out of the Fleet table. “Use the full width” must not become “use more height.” |
| G2 | **Keel precedence and error lifetime** as in §5.4. | Avoids re-deriving the rail chain and avoids errors that vanish on a timer. |
| G3 | **Lamps hold during refresh** (§5.2). | `statusReady` is `true` mid-read; naive builds flash All quiet. |
| G4 | **One framing device: corner brackets** on each bay (`--cyan-dim`, 1px, ~0.7rem ticks, drawn with background gradients — no pseudo-elements, no full box). Glow only on instruments that are on (§3). No hull glow, no page gradients. | Four motif elements at once is the costume §3 rejects. Invisible hairlines made the first build read as the old toolbar. |
| G5 | **Motion gated.** Keel tick / lamp pulse only while `busy || statusNote`, never at idle, and disabled under `@media (prefers-reduced-motion: reduce)`. Nothing in `app/src` honors that query yet; the bridge is the first to introduce motion, so it is the first to gate it. | Accessibility; also keeps idle chrome still. |
| G6 | **Semantics.** Lamps are `<button>`s with count + destination in `aria-label`. Keel keeps `aria-live="polite"` (already on `.status-rail`). | Screen readers get counts and live steps, not decorative dots. |
| G7 | **Deck shares tokens, not the operator board.** `helm-hud.css` is imported by Deck. Tiles stay a phone grid — no Fleet tables, no ConfirmModal. | Same hull language; different job. |
| G8 | **Stable hooks.** `data-bridge` attribute on the four regions, valued `ident`, `situation`, `conn`, `keel`. | §8 acceptance and the browser pass can assert keel copy per state without guessing selectors. |
| G9 | **Tokens, not literals.** Dashboard CSS uses: `--hull` (`#03060c`), `--well` (`#060a13`), `--steel` (`#3a5a70`), `--gold` / `--gold-soft`, `--ice`, `--cyan` (`#7ef4ff`), `--cyan-dim` / `--cyan-glow` / `--grid`, `--alarm`, `--dim`. Same tokens on header, stations, panels, tables. Deck does not import this file. | One palette; brighter after the 2026-09-15 pass. |

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
| Pull / Push placement | Stay in **conn** (also remain on Fleet) | Fleet-tab toolbar only |
| Empty digest | **All quiet** lamp after `statusReady` | Leave binnacle blank |
| Fetch remotes | Stay in **locker** | Second conn control |
| Narrow stack order | Ident → Situation → Conn → Keel | Ident + Conn, then lamps, then keel |
| Bay framing | **Hairline dividers** between bays | Corner ticks on each bay |
| Stale remotes on keel | **Merged into idle line** | Replaces idle line (today's rail behavior) |

Locked 2026-09-14 from operator answers. Narrow stack is the override; the other five match the prior defaults.

---

## 8. Acceptance (when built)

1. With a loaded fleet and quiet digest, `[data-bridge="keel"]` shows the §5.4 idle line (Fleet N / remotes / npm) and `[data-bridge="situation"]` shows one All quiet lamp — no blank keel spacer.
2. With unpublished / dirty / pins behind, situation shows those lamps; each click opens Today with the §5.2 filter (`publish` / `push` / `pins`).
3. Refresh updates the keel through packages → npm → git → Sites and Ports, then returns to idle keel copy. Lamps do **not** disappear or flash All quiet while it runs.
4. An error set during a read stays on the keel until the next read or write starts.
5. Locker still exposes plugins, Deck, brief, fetch remotes, export, fleet path.
6. Desktop: bridge height ≤ today's header + rail (G1). ≤ 48rem: bays stack per §5.6; Refresh visible without scrolling; no horizontal scroll.
7. `prefers-reduced-motion: reduce` disables keel tick and lamp pulse; at idle nothing animates in either mode.
8. `bridgeIdleLine` unit tests cover: signed in / not, fetched / not fetched, hidden > 0, stale > 0.
9. `/deck` renders unchanged.
10. No steampunk chrome; no renamed CLI or product strings; no new operator-facing bay labels.

---

## 9. Implementation

Locked. Build in this pass.

1. Lock this file (`Status: Locked` + date).
2. Peel header markup to `app/src/lib/BridgeHeader.svelte` (same peel rule as `TodayBoard.svelte` — ConfirmModal / `loadStatus` / URL state stay on `+page.svelte`). `HelmMenu` stays a child and keeps receiving what it receives today.

   **Props contract** (all already exist as `+page.svelte` state or derived values; the peel is a copy job, not a rewrite):

   | Prop | Source on page |
   | ---- | -------------- |
   | `busy`, `statusNote`, `error`, `staleRemotes`, `statusReady` | keel state |
   | `serveLine`, `npmUser`, `fetchedAt` | ident heading + keel idle |
   | `needChips` | `headerNeedChips(...)` |
   | `fleetCount`, `hiddenCount` | digest / archive |
   | `activityOpen`, `activityBadge` | logbook |
   | `onRefresh`, `onPull`, `onPush`, `onToggleActivity` | conn callbacks |
   | `onLamp(filter: NeedFilter)` | situation click → `setTab('today')` + filter |

   No `node:*` imports in the component. Nothing about plan-then-confirm moves.
3. Tokens (G9) + bridge rules in `app/src/lib/dashboard.css` in one bridge section. Reduced-motion gate (G5) lives there too.
4. `bridgeIdleLine(...)` in `src/lib/fleetDisplay.ts` with unit tests (§5.4 contract). Required, not optional.
5. Measure header + rail height before the peel; assert the bridge is not taller after (G1).
6. Browser-check desktop and ≤ 48rem; check `/deck` unchanged (G7).
7. Log decision in `.forgetrail/workflow_tracking.json`; session note in `CONTEXT_PROMPT.md`.

Cost: **Free/Cheap** — rearrange and restyle existing facts. No new daemon.

---

## 10. Lock answers (2026-09-14)

1. Pull/Push stay in **conn** (and still on Fleet).
2. **All quiet** when the digest is empty after `statusReady`.
3. Fetch remotes stays in the **locker**.
4. Narrow stack: **Ident → Situation → Conn → Keel**.
5. Bay framing: ~~hairline dividers~~ → **corner brackets** (operator reference boards, 2026-09-15).
6. Stale remotes: **merge into the idle line**.
