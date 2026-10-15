# LocalHelm UX packets

Audience: people managing several local projects. Target: a compact control panel that identifies the right action, shows the exact target, acknowledges results, and recovers without repeating an uncertain write. Approved direction: proceed with packets A–D from [the UX review](../UX_REVIEW_2026-10-14.md). Date: 2026-10-14. Existing Build phase and companion ownership remain unchanged.

## Delivery tracker

| Packet | State | Dependencies | Acceptance / next action |
| --- | --- | --- | --- |
| A — verified npm archives | In progress | Existing named Publish flow | Read release contract; build/pack once; validate and publish identical bytes; test library/CLI/generated packages and failures |
| B — durable action recovery | Not started | Existing job runner; A for release results | Persist job identities and per-subject results; reload/reconcile without replay; fresh-plan remaining work |
| C — shared action language and compact layout | Not started | B recovery entry points | Consistent next-step copy; compact secondary actions; patch/minor/major still available; large/narrow/keyboard checks |
| D — companion and Activity durability | Not started | Existing plugin APIs; B storage patterns | Race-safe per-plugin reads and board epochs; useful empty/failure states; idempotent queued Activity persistence |

## Shared contracts

Preserve the dark HUD, nautical identity, compact tables, named project selection, native dialogs, and gold primary action. Gold identifies the next enabled action; disabled work has visible guidance. Keep primary jobs in plain language: Commit saves to Git; Push sends commits to origin; Publish releases an npm package; Ship deploys; Land updates and deploys a FilePress site. Secondary commands and raw payloads expand only when useful.

All writes keep their existing named-plan/confirmation boundaries, operator/demo enforcement, workspace lock, and exact enrolled identity. No external publish, push, deployment, model call, service mutation, or installed-skill change is part of development verification. Tests use synthetic workspaces, bare Git remotes, fake publishers, and isolated browser APIs. Do not introduce a provider or runtime dependency for these packets.

## A. Release contract and exact archive

Default release: enrolled directory, its `package.json`, and its README. Optional checked-in `localhelm.release.json` explicitly names a package directory, authoritative source manifest, README source, and an enrolled-root build script. All paths resolve within the enrolled checkout. A generated directory is build output, never a new fleet enrollment. Status and Bump read/write the authoritative source manifest; Git/Ship still operate on the enrolled checkout. Existing dependency graph ownership remains the enrolled workspace.

Configuration version 1:

```json
{
  "version": 1,
  "directory": ".artifacts/npm-package",
  "manifest": "packages/cli/release.json",
  "readme": "packages/cli/README.md",
  "buildScript": "package:build",
  "kind": "cli",
  "executables": ["example"]
}
```

`kind` is `package` or `cli`; ordinary libraries need no executable. A CLI must declare expected executable names through its source manifest or configuration. Missing/invalid configuration is a visible package error, never a fallback publication of the harness. Plans read files only and disclose sources, build/lifecycle work, and verification. Opening a plan does not execute scripts.

Confirmed local release: optional source bump and commit → build/pack/verify → necessary origin push → publish the verified archive. Run configured build, preserve `prepublishOnly`, then npm's prepack/prepare/postpack lifecycle. Verify the tar archive itself: package name/version/public status/license, README source bytes when supplied, declared/expected executable entries, safe regular file paths, and archive digest. Store a receipt and file list. Reject build failure, identity drift, missing entry files, changed tracked source/HEAD, or changed archive before a push/publication. Publish this archive without rebuilding. Preserve publish/postpublish hooks after registry acknowledgement; a hook failure remains a successful publication with a warning, never a retryable unpublished result.

GitHub publication stays an explicit workflow handoff. Do not claim that a local archive is the workflow's artifact. Its workflow must own equivalent verification; no inferred remote target support.

Acceptance A1: no scripts/artifact created by plan. A2: normal library and CLI pack, declared executable omission blocks before publisher/push. A3: generated private-root package uses source version/private/name and bumps only that source. A4: lifecycle runs once in correct order, packed README and binary match source, publisher receives verified file/hash. A5: stale manifest, archive mutation, tracked build changes, malformed config and escaping paths fail with recovery guidance. A6: UI keeps progress-step ownership and displays archive evidence; CLI and HTTP plans use the same contract.

Owned modules: release target reader, archive reader/verifier, npm command invocation, status/Bump/Publish and shared types, confirmation/progress/result presentation. Verifiers: `pnpm build`, `pnpm exec tsx --test src/lib/release*.test.ts src/lib/publish.test.ts`, dashboard check/build, and isolated rendered release scenarios. No real publisher is needed.

## B. Durable results and recovery

Every confirmed multi-project action gets a workspace/board-scoped job ID, action label, original subject IDs, start/update times, and per-subject state: pending, running, succeeded, failed, or unknown. Persist before starting each subject and after its acknowledgement; a storage failure must be visible before another write begins. Stop finishes the current subject and leaves the rest pending. A lost connection or reload converts running to unknown, preserving completed results and exact errors. Successful writes remain successful if a later status refresh fails.

Recovery opens a retained result, offers a read-only status refresh/reconciliation, and opens a fresh action plan for selected unresolved subjects. It never resubmits stored write payloads or treats unknown as rolled back. Session/browser data is scoped to workspace and Main/Demo. Keep existing Publish/Land specialized outcomes compatible; migrate or coexist without showing duplicate recovery dialogs.

Acceptance B1: partial success/failure and Stop persist. B2: reload/server restart retains result and marks unacknowledged work unknown. B3: reconcile is read-only and retries require a new plan. B4: board/workspace separation, malformed/old records, unavailable storage, and status-refresh failure are handled explicitly. Owned modules: browser-safe job records/storage and runner integration, action result classification, recovery component and fresh-plan dispatch.

## C. Action language and compact layout

Present one primary next action per row with secondary work grouped. Keep the inline private link. Move manual Bump out of its dedicated always-visible table column into secondary controls only after a rendered prototype; retain patch/minor/major selection in Publish and manual bump plans. Explain blocked Push/Publish and companion prerequisites in text reachable by keyboard/touch. Preserve selection and focused project when an action menu closes or a refresh lands. On narrow screens, project identity and next action remain discoverable; horizontal tables have an accessible scroll region and visible cue.

Acceptance C1: action meanings are consistent across Today/Fleet/confirmations/CLI help. C2: patch/minor/major and manual Bump still work. C3: dense/long-name fleet, 390px, keyboard menus/focus, and disabled prerequisites are verified visually and through interactions. Owned modules: shared action presentation/recovery helpers, Fleet/Today row layout, menu and confirmation controls, relevant help.

## D. Companion state and Activity durability

Plugin reads use independent per-plugin ordering plus a board epoch. A scoped update preserves unrelated boards and faults. A stale success/failure cannot overwrite newer data or a changed board. Enabling/disabling has a pending state, server acknowledgement, and visible failure recovery. Distinguish not configured, loading, empty, disabled, failed, and stale-with-last-known-data; retry the affected plugin without blocking others.

Activity entries have client IDs and original timestamps. Buffer unsaved entries in board/workspace-scoped durable storage; retries are idempotent at the server, concurrent appends cannot lose each other, and writes are atomic. Merge server results with queued local entries instead of replacing them. Show queue/save failures in Activity without changing action results. Clearing Activity requires successful server acknowledgement before clearing the matching queue, and cannot let an old in-flight response resurrect cleared entries.

Acceptance D1: independent/out-of-order plugin reads, failed toggles, and rapid Main/Demo transitions preserve correct state. D2: an unavailable plugin has a targeted retry and does not hide working plugins. D3: failed/concurrent/retried Activity saves preserve original entries exactly once across reload. D4: clear races and storage failure stay truthful. Owned modules: plugin read coordinator/state, pane recovery copy, Activity queue and server serialization/idempotency, browser integration.

## Evidence and completion

Update each packet when implementation starts, after meaningful checks, and when its acceptance is verified. Save raw synthetic receipts under ignored `.localhelm/`; record commands/results/limits in the ledger and this tracker. Commit each completed packet in LocalHelm; pushes and real publication remain separate. The larger review remains the rationale and source map.

Lifecycle references: [npm scripts](https://docs.npmjs.com/cli/v11/using-npm/scripts/), [npm pack](https://docs.npmjs.com/cli/v11/commands/npm-pack/), [npm publish](https://docs.npmjs.com/cli/v11/commands/npm-publish/).
