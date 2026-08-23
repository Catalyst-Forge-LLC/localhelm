import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { whyNotPublish, whyNotPush, writableCascadeCount, type PublishGateRow } from './writeGate.js';

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
