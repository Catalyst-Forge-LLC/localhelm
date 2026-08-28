import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fleetProjectMeta, fleetVersionLabel, fleetVersionNote, headerNeedChips } from './fleetDisplay.js';

describe('fleetDisplay', () => {
	it('hides the npm name when it matches the fleet id', () => {
		assert.equal(fleetProjectMeta('localhelm', 'localhelm', '.'), null);
		assert.equal(fleetProjectMeta('filepress', 'getfilepress', '.'), 'getfilepress');
		assert.equal(fleetProjectMeta('private-app', undefined, '../private-app'), '../private-app');
	});

	it('shows local only when npm matches', () => {
		const row = { localVersion: '0.1.10', private: false, npm: { status: 'ok', latest: '0.1.10' } };
		assert.equal(fleetVersionNote(row), null);
		assert.equal(fleetVersionLabel(row), '0.1.10');
	});

	it('notes npm only when it differs or is missing', () => {
		assert.equal(
			fleetVersionLabel({
				localVersion: '0.2.0',
				private: false,
				unpublishedAhead: true,
				npm: { status: 'ok', latest: '0.1.10' },
			}),
			'0.2.0 · npm 0.1.10',
		);
		assert.equal(
			fleetVersionLabel({ localVersion: '0.0.1', private: true, npm: { status: 'ok', latest: '0.0.1' } }),
			'0.0.1 · private',
		);
		assert.equal(
			fleetVersionLabel({ localVersion: '1.0.0', private: false, npm: { status: 'none' } }),
			'1.0.0 · not published',
		);
	});

	it('only lists header chips that need work', () => {
		assert.deepEqual(
			headerNeedChips({
				unpublishedAhead: 0,
				dirty: 0,
				cascadeBehind: 0,
				missing: 0,
				npmErrors: 0,
			}),
			[],
		);
		assert.deepEqual(
			headerNeedChips({
				unpublishedAhead: 2,
				dirty: 1,
				cascadeBehind: 0,
				missing: 0,
				npmErrors: 0,
			}),
			[
				{ id: 'unpublished', label: '2 unpublished', tone: 'hot', tab: 'today' },
				{ id: 'dirty', label: '1 dirty', tone: 'warm', tab: 'today' },
			],
		);
	});
});
