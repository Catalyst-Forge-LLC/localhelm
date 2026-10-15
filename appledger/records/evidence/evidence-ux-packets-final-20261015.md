---
format_version: 0.1.0
id: evidence-ux-packets-final-20261015
kind: evidence
title: Verify all UX packets and actual package release contracts
record_status: active
created_at: 2026-10-15T05:04:19Z
updated_at: 2026-10-15T05:04:19Z
recorded_by: { id: codex, type: agent }
visibility: internal
relations: []
claims: []
data:
  evidence_kind: test_run
  repository_id: repo-home
  source: docs/specs/ux-friction-packets.md
  checked_at: 2026-10-15T05:00:31Z
  result: All 360 tests in 131 suites pass; runtime and dashboard builds pass; Svelte diagnostics report zero errors and warnings; 26 combined synthetic desktop/mobile browser checks pass. Actual LocalHelm package build, archive verification, and read-only release plans for LocalHelm and UXcalibur pass.
  limitations:
    - Browser action and companion subjects are synthetic; only an isolated temporary workspace received real Activity writes.
    - No real push, publication, deployment, model call, service mutation, label change, or personal skill installation.
    - The default Node-adjacent npm is missing promise-retry; build and pack verification used the complete alternate npm through npm_execpath. The global installation was not repaired.
    - The existing Build phase remains active. This evidence does not approve a phase transition or external release.
---

Final checks used `pnpm build`, `pnpm --dir app check`, `pnpm dashboard:build`,
`node node_modules/tsx/dist/cli.mjs --test 'src/lib/*.test.ts'`, and the ignored
browser fixture `.localhelm/friction-qa.mjs --durability --layout --jobs --complete`.
The actual package preparation also rebuilt both runtime and dashboard through
the root prepublishOnly script before packing and verifying the archive.

At 04:57:58Z the real LocalHelm root package, package.json version source, root
README source, and localhelm executable produced a verified local archive with
484 files and 3,250,337 bytes. Its SHA-256 was
`4b111ec9b5b76c57492d869e0e321f4cda464a525a066a826e4d051566663fec`.
The archive included bin/localhelm.mjs, dist/cli/main.js, and dashboard/index.js.
This is historical build evidence; a future confirmed Publish must pack and
verify its own current source and archive.

At 05:00:31Z normal read-only status and Publish planning, including commit counts,
resolved LocalHelm to its public root package and proposed the next patch release
with build/pack/verify before push and publication. UXcalibur resolved to its
public root package and reported nothing to publish at the user's published
0.1.2. Its registry executable metadata and temporary project skill installation
had also been verified; the installed skill file matched its source.

Raw receipts remain ignored under .localhelm/: packets-final-tests.log,
packets-final-check.log, packets-final-browser.log, friction-qa/*.png,
release-contract-receipt.json, and release-plans-receipt.json. Screens were
visually inspected at desktop and mobile widths.

AppLedger checking reports no schema errors. Existing warnings concern its
interpretation of native AppFacts/FeatureFacts bindings and the historical
packagePrivacy.ts digest in evidence-remove-npm-private-20261014. That digest
is preserved as evidence of its earlier verification; current tests cover the
updated release-target-aware implementation.
