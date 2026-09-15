import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	applyWritePatch,
	applyWritePatches,
	unpublishedAheadOf,
	writeReloadBusy,
} from './inventoryPatch.js';
import type { ProjectStatus } from './types.js';

function row(over: Partial<ProjectStatus> & Pick<ProjectStatus, 'id'>): ProjectStatus {
	return {
		path: over.id,
		absPath: over.id,
		missing: false,
		localVersion: '1.0.0',
		private: false,
		npm: { name: over.id, status: 'ok', latest: '1.0.0' },
		git: {
			repo: true,
			dirty: false,
			staged: 0,
			unstaged: 0,
			untracked: 0,
			ahead: 2,
			behind: 0,
		},
		pins: [],
		cascadeBehind: 0,
		unpublishedAhead: false,
		...over,
	};
}

describe('inventoryPatch', () => {
	it('names the post-write busy line', () => {
		assert.equal(writeReloadBusy('git', ['temper-pass']), 'reading git · temper-pass');
		assert.equal(writeReloadBusy('git', ['a', 'b']), 'reading git (2 projects)');
		assert.equal(writeReloadBusy('light', ['a', 'b', 'c']), 'reading fleet (3 projects)');
	});

	it('treats a bumped local version as unpublished-ahead', () => {
		assert.equal(unpublishedAheadOf('1.0.1', { status: 'ok', latest: '1.0.0' }, false), true);
		assert.equal(unpublishedAheadOf('1.0.0', { status: 'ok', latest: '1.0.0' }, false), false);
		assert.equal(unpublishedAheadOf('1.0.1', { status: 'ok', latest: '1.0.0' }, true), false);
	});

	it('clears ahead after a push and latest after a publish', () => {
		const pushed = applyWritePatch(row({ id: 'localhelm' }), { id: 'localhelm', gitAhead: 0 });
		assert.equal(pushed.git.ahead, 0);
		const published = applyWritePatch(pushed, {
			id: 'localhelm',
			npmLatest: '1.0.1',
			localVersion: '1.0.1',
			commitsSinceNpm: 0,
		});
		assert.equal(published.npm.latest, '1.0.1');
		assert.equal(published.unpublishedAhead, false);
		assert.equal(published.commitsSinceNpm, 0);
	});

	it('patches only the named rows', () => {
		const next = applyWritePatches([row({ id: 'a' }), row({ id: 'b' })], [{ id: 'b', gitAhead: 0 }]);
		assert.equal(next[0]?.git.ahead, 2);
		assert.equal(next[1]?.git.ahead, 0);
	});
});
