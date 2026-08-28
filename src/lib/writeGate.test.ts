import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	canCutVersion,
	commitCountLabel,
	fleetWriteIds,
	fleetWriteLabel,
	plainGitError,
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

	it('skips a cut when origin has nothing since the last npm version', () => {
		assert.equal(whyNotPublish(row({ commitsSinceNpm: 0 })), 'nothing to cut');
		assert.equal(whyNotPublish(row({ commitsSinceNpm: 3 })), undefined);
		assert.equal(whyNotPublish(row({ unpublishedAhead: true, commitsSinceNpm: 0 })), undefined);
	});
});

describe('fleetWriteIds', () => {
	it('offers Cut when Today would, not nothing-to-do', () => {
		const cut = row({ commitsSinceNpm: 4 });
		assert.equal(canCutVersion(cut), true);
		assert.deepEqual(fleetWriteIds(cut), ['cut']);
		assert.equal(fleetWriteLabel('cut', cut), 'Cut 1.0.1 · 4 commits');
		assert.equal(fleetWriteLabel('cut', cut, 'minor'), 'Cut 1.1.0 · 4 commits');
		assert.equal(fleetWriteLabel('cut', row({ commitsSinceNpm: 1 })), 'Cut 1.0.1 · 1 commit');
		assert.equal(fleetWriteLabel('push', row({ git: git({ ahead: 3 }) })), 'Push 3 commits');
		assert.equal(fleetWriteLabel('push', row({ git: git({ ahead: 1 }) })), 'Push 1 commit');
		assert.equal(fleetWriteLabel('pins', cut, 'patch', 1), 'Write 1 pin');
		assert.equal(fleetWriteLabel('pins', cut, 'patch', 2), 'Write 2 pins');
		assert.equal(commitCountLabel(1), '1 commit');
		assert.equal(commitCountLabel(11), '11 commits');
		assert.deepEqual(fleetWriteIds(row({ commitsSinceNpm: 0 })), []);
		assert.equal(canCutVersion(row({ unpublishedAhead: true, git: git({ ahead: 0 }) })), false);
		assert.deepEqual(fleetWriteIds(row({ unpublishedAhead: true, git: git({ ahead: 0 }) })), ['publish']);
	});

	it('keeps Push and Cut together when both apply', () => {
		const both = row({ commitsSinceNpm: 2, git: git({ ahead: 3 }) });
		assert.deepEqual(fleetWriteIds(both), ['push', 'cut']);
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
