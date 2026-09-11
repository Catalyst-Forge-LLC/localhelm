import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	canPublish,
	canGlobal,
	canShip,
	commitCountLabel,
	confirmNamedLine,
	globalInstallLine,
	globalWriteLabel,
	shipConfirmLine,
	needsGlobal,
	fleetWriteIds,
	fleetWriteLabel,
	landPluginApplyOk,
	plainGitError,
	plainPluginError,
	plainPublishError,
	publishApplyTitle,
	publishResultLine,
	whyNotPublish,
	whyNotPush,
	writableCascadeCount,
	type PublishGateRow,
} from './writeGate.js';

function git(partial: Partial<PublishGateRow['git']> = {}): PublishGateRow['git'] {
	return {
		repo: true,
		dirty: false,
		ahead: 0,
		behind: 0,
		branch: 'main',
		origin: 'https://example.com/x.git',
		...partial,
	};
}

function row(partial: Partial<PublishGateRow> = {}): PublishGateRow {
	return {
		missing: false,
		private: false,
		unpublishedAhead: false,
		localVersion: '1.0.0',
		npm: { name: 'widget', latest: '1.0.0', status: 'ok' },
		git: git(),
		...partial,
	};
}

describe('plainGitError', () => {
	it('shortens SSH publickey denial', () => {
		assert.equal(
			plainGitError('git@github.com: Permission denied (publickey).\r\nfatal: Could not read from remote repository.'),
			'origin rejected the SSH key',
		);
	});
});

describe('plainPluginError', () => {
	it('keeps a FilePress assertion and drops the Vite build dump', () => {
		const raw = [
			'smellcheck ship pnpm ship in smellcheck\\site',
			'\u001b[36mvite v8.2.2 \u001b[32mbuilding client environment for production...\u001b[39m',
			'✓ 199 modules transformed.',
			'Wrote site to "Z:\\workspace\\smellcheck\\site\\build"',
			'ELIFECYCLE  Command failed with exit code 1.',
			'filepress: Genie leaked into the static build (dev-only).',
			'_app\\immutable\\chunks\\BaPzVmF0.js: GeniePanel',
			'smellcheck ship failed (exit 1)',
		].join('\n');
		assert.equal(plainPluginError(raw), 'filepress: Genie leaked into the static build (dev-only).');
	});

	it('keeps a short push failure', () => {
		assert.equal(plainPluginError('aibreze-site push failed'), 'aibreze-site push failed');
	});

	it('prefers the pnpm line over update failed (exit 1)', () => {
		const raw = [
			'localslip   update   pnpm update getfilepress  (0.1.11 → 0.1.28)',
			'npm warn Unknown env config "python".',
			'ERR_PNPM_NO_MATCHING_VERSION No matching version found for getfilepress@0.1.28',
			'localslip   update   failed (exit 1)',
		].join('\n');
		assert.equal(
			plainPluginError(raw),
			'ERR_PNPM_NO_MATCHING_VERSION No matching version found for getfilepress@0.1.28',
		);
	});
});

describe('plainPublishError', () => {
	it('skips npmrc warnings and keeps the provenance gate', () => {
		const raw = [
			'npm warn Unknown env config "auto-install-peers". This will error in a future major version of npm.',
			'Provenance only works in GitHub Actions (OIDC). A laptop publish fails with: Automatic provenance generation not supported for provider: null.',
			'Ship 1.1.4 from CI: push, then cut GitHub Release v1.1.4.',
		].join('\n');
		assert.match(plainPublishError(raw), /Provenance only works in GitHub Actions/);
	});

	it('names a skill-facts version miss', () => {
		const raw = [
			'npm warn Unknown env config "python".',
			'AssertionError [ERR_ASSERTION]: The input did not match the regular expression /version: "0.1.10"/. Input:',
			'',
			'---',
			'version: "0.1.9"',
		].join('\n');
		assert.equal(plainPublishError(raw), 'skill facts still 0.1.9 (package 0.1.10)');
	});
});

describe('publishApplyTitle', () => {
	it('names failed ids so Activity chips can jump', () => {
		const title = publishApplyTitle([
			{ id: 'coldeye', reason: 'published coldeye@0.1.1' },
			{ id: 'aibreze', reason: 'skill facts still 0.1.9 (package 0.1.10)' },
			{ id: 'finetuna', reason: 'Provenance only works in GitHub Actions (OIDC).' },
		]);
		assert.equal(title, 'publish --apply — 1 published, 2 failed: aibreze, finetuna');
		assert.equal(
			publishApplyTitle([{ id: 'finetuna', reason: 'open GitHub Publish finetuna@1.1.5  https://github.com/x/y/actions/workflows/publish.yml' }]),
			'publish --apply — 1 opened GitHub',
		);
		assert.equal(
			publishResultLine({ id: 'aibreze', reason: 'skill facts still 0.1.9 (package 0.1.10)' }),
			'aibreze  skill facts still 0.1.9 (package 0.1.10)',
		);
	});
});

describe('whyNotPush', () => {
	it('allows ahead commits on a dirty tree', () => {
		assert.equal(whyNotPush(git({ ahead: 2, dirty: true })), undefined);
	});

	it('skips not-ahead, diverged, and no-origin', () => {
		assert.equal(whyNotPush(git({ ahead: 0 })), 'not ahead');
		assert.equal(whyNotPush(git({ ahead: 1, behind: 1 })), 'diverged');
		assert.equal(whyNotPush(git({ ahead: 1, origin: undefined })), 'no origin');
	});
});

describe('whyNotPublish', () => {
	it('skips dirty even when unpublished-ahead', () => {
		assert.equal(whyNotPublish(row({ unpublishedAhead: true, git: git({ dirty: true, ahead: 2 }) })), 'dirty');
	});

	it('skips unpublished-ahead that cannot push', () => {
		assert.equal(
			whyNotPublish(row({ unpublishedAhead: true, git: git({ ahead: 1, behind: 1 }) })),
			'diverged',
		);
		assert.equal(
			whyNotPublish(row({ unpublishedAhead: true, git: git({ ahead: 1, origin: undefined }) })),
			'no origin',
		);
	});

	it('allows unpublished-ahead with a clean tree and no extra push', () => {
		assert.equal(whyNotPublish(row({ unpublishedAhead: true, git: git({ ahead: 0 }) })), undefined);
	});

	it('skips a bump-publish when origin has nothing since the last npm version', () => {
		assert.equal(whyNotPublish(row({ commitsSinceNpm: 0 })), 'nothing to publish');
		assert.equal(whyNotPublish(row({ commitsSinceNpm: 3 })), undefined);
		assert.equal(whyNotPublish(row({ unpublishedAhead: true, commitsSinceNpm: 0 })), undefined);
	});
});

describe('fleetWriteIds', () => {
	it('offers one Publish for a version bump with origin commits', () => {
		const next = row({ commitsSinceNpm: 4 });
		assert.equal(canPublish(next), true);
		assert.deepEqual(fleetWriteIds(next), ['publish']);
		assert.equal(fleetWriteLabel('publish', next), 'Publish 1.0.1 · 4 commits');
		assert.equal(fleetWriteLabel('publish', next, 'minor'), 'Publish 1.1.0 · 4 commits');
		assert.equal(fleetWriteLabel('publish', row({ commitsSinceNpm: 1 })), 'Publish 1.0.1 · 1 commit');
		assert.equal(fleetWriteLabel('publish', row({ unpublishedAhead: true, git: git({ ahead: 0 }) })), 'Publish 1.0.0');
		assert.equal(fleetWriteLabel('push', row({ git: git({ ahead: 3 }) })), 'Push 3 commits');
		assert.equal(fleetWriteLabel('push', row({ git: git({ ahead: 1 }) })), 'Push 1 commit');
		assert.equal(fleetWriteLabel('pins', next, 'patch', 1), 'Write 1 pin');
		assert.equal(fleetWriteLabel('pins', next, 'patch', 2), 'Write 2 pins');
		assert.equal(commitCountLabel(1), '1 commit');
		assert.equal(commitCountLabel(11), '11 commits');
		assert.deepEqual(fleetWriteIds(row({ commitsSinceNpm: 0 })), []);
		assert.deepEqual(fleetWriteIds(row({ unpublishedAhead: true, git: git({ ahead: 0 }) })), ['publish']);
	});

	it('keeps Push and Publish together when both apply', () => {
		const both = row({ commitsSinceNpm: 2, git: git({ ahead: 3 }) });
		assert.deepEqual(fleetWriteIds(both), ['publish', 'push']);
	});

	it('offers Commit first when the tree is dirty', () => {
		assert.deepEqual(fleetWriteIds(row({ git: git({ dirty: true }) })), ['commit']);
		assert.equal(fleetWriteLabel('commit', row({ git: git({ dirty: true }) })), 'Commit');
	});
});

describe('writableCascadeCount', () => {
	it('counts only registry pins on clean consumers', () => {
		const projects = [
			{ id: 'lib', missing: false, git: { dirty: false }, pins: [] },
			{
				id: 'app',
				missing: false,
				git: { dirty: false },
				pins: [{ targetId: 'lib', kind: 'registry', onLatest: false }],
			},
			{
				id: 'dirty-app',
				missing: false,
				git: { dirty: true },
				pins: [{ targetId: 'lib', kind: 'registry', onLatest: false }],
			},
			{
				id: 'linked',
				missing: false,
				git: { dirty: false },
				pins: [{ targetId: 'lib', kind: 'link', onLatest: false }],
			},
		];
		assert.equal(writableCascadeCount('lib', projects), 1);
	});
});

describe('needsGlobal', () => {
	it('is optional and never a gold write', () => {
		const cli = {
			missing: false,
			private: false,
			unpublishedAhead: false,
			localVersion: '0.2.0',
			npm: { name: 'localhelm', latest: '0.2.0' },
			bin: ['localhelm'],
			global: { version: null as string | null },
		};
		assert.equal(canGlobal(cli), true);
		assert.equal(needsGlobal(cli), true);
		assert.equal(globalWriteLabel(cli), 'Install global 0.2.0');
		assert.equal(needsGlobal({ ...cli, global: { version: '0.2.0' } }), false);
		assert.equal(globalWriteLabel({ ...cli, global: { version: '0.1.9' } }), 'Update global 0.2.0');
		assert.equal(canGlobal({ ...cli, bin: [] }), false);
		assert.equal(needsGlobal({ ...cli, private: true }), false);
		assert.ok(!fleetWriteIds(row()).includes('global' as never));
	});
});

describe('confirmNamedLine', () => {
	it('omits the id for one subject and keeps it when several are listed', () => {
		assert.equal(confirmNamedLine('localhelm', 'pnpm run ship (root)', false), 'pnpm run ship (root)');
		assert.equal(confirmNamedLine('localhelm', 'pnpm run ship (root)', true), 'localhelm  pnpm run ship (root)');
		assert.equal(shipConfirmLine({ id: 'localhelm', action: 'ship', dir: 'root' }, false), 'pnpm run ship (root)');
		assert.equal(shipConfirmLine({ id: 'pages', action: 'ship', dir: 'site' }, true), 'pages  pnpm run ship (site/)');
		assert.equal(
			globalInstallLine({ id: 'localhelm', action: 'global', npm: 'localhelm', version: '0.1.11' }, false),
			'pnpm add -g localhelm@0.1.11',
		);
		assert.equal(
			globalInstallLine(
				{ id: 'filepress', action: 'global', npm: 'getfilepress', version: '0.1.29', have: '0.1.28' },
				true,
			),
			'filepress  pnpm add -g getfilepress@0.1.29 (have 0.1.28)',
		);
	});
});

describe('canShip', () => {
	it('is optional and never a gold write', () => {
		assert.equal(canShip({ missing: false, ship: { dir: 'root' } }), true);
		assert.equal(canShip({ missing: false, ship: { dir: 'site' } }), true);
		assert.equal(canShip({ missing: true, ship: { dir: 'root' } }), false);
		assert.equal(canShip({ missing: false }), false);
		assert.ok(!fleetWriteIds(row()).includes('ship' as never));
	});
});

describe('landPluginApplyOk', () => {
	it('reads FilePress results and xFacts rows', () => {
		assert.deepEqual(landPluginApplyOk({ results: [{ id: 'site', ok: true }] }), { ok: true, reason: 'done' });
		assert.equal(
			landPluginApplyOk({
				rows: [{ id: 'x-facts', ok: false, detail: '✘ [ERROR] Authentication error [code: 10000]' }],
			}).ok,
			false,
		);
		assert.match(
			landPluginApplyOk({
				rows: [{ id: 'x-facts', ok: false, detail: '✘ [ERROR] Authentication error [code: 10000]' }],
			}).reason,
			/Authentication error/,
		);
	});
});
