import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	bridgeGaugeFrac,
	bridgeIdleLine,
	bridgeServeHeading,
	fleetProjectMeta,
	fleetVersionLabel,
	fleetVersionNote,
	headerNeedChips,
} from './fleetDisplay.js';

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
				publish: 0,
				push: 0,
				pins: 0,
				dirty: 0,
				missing: 0,
				npmErrors: 0,
			}),
			[],
		);
		assert.deepEqual(
			headerNeedChips({
				publish: 4,
				push: 4,
				pins: 0,
				dirty: 1,
				missing: 0,
				npmErrors: 0,
			}),
			[
				{
					id: 'publish',
					label: '4 publish',
					count: 4,
					word: 'publish',
					tone: 'hot',
					tab: 'today',
					need: 'publish',
				},
				{ id: 'push', label: '4 push', count: 4, word: 'push', tone: 'hot', tab: 'today', need: 'push' },
				{ id: 'dirty', label: '1 dirty', count: 1, word: 'dirty', tone: 'warm', tab: 'today', need: 'all' },
			],
		);
		assert.deepEqual(
			headerNeedChips({
				publish: 0,
				push: 0,
				pins: 3,
				dirty: 0,
				missing: 0,
				npmErrors: 0,
			}),
			[
				{
					id: 'pins',
					label: '3 pins behind',
					count: 3,
					word: 'pins behind',
					tone: 'warm',
					tab: 'today',
					need: 'pins',
				},
			],
		);
	});

	it('builds the keel idle line in contract order', () => {
		assert.equal(
			bridgeIdleLine({ fleetCount: 43, fetchedAt: '9:41:07 PM', npmUser: 'acme' }),
			'Fleet 43 · remotes fetched 9:41:07 PM · npm acme',
		);
		assert.equal(
			bridgeIdleLine({ fleetCount: 41, hiddenCount: 2, fetchedAt: null, npmUser: null }),
			'Fleet 41 · 2 hidden · remotes not fetched this session · npm not signed in',
		);
		assert.equal(
			bridgeIdleLine({
				fleetCount: 43,
				fetchedAt: '9:41:07 PM',
				staleCount: 3,
				npmUser: 'acme',
			}),
			'Fleet 43 · remotes fetched 9:41:07 PM · 3 could not be read · npm acme',
		);
		assert.equal(
			bridgeIdleLine({
				fleetCount: 0,
				fetchedAt: null,
				npmUser: null,
				noFleet: true,
			}),
			'No fleet yet · Add projects on Today',
		);
	});

	it('maps gauge need to a 0..1 arc share', () => {
		assert.equal(bridgeGaugeFrac(0, 2), 0);
		assert.equal(bridgeGaugeFrac(10, 0), 0);
		assert.equal(bridgeGaugeFrac(10, 5), 0.5);
		assert.equal(bridgeGaugeFrac(4, 9), 1);
	});

	it('puts host:port on the glass and demotes the lease note', () => {
		assert.deepEqual(
			bridgeServeHeading({ host: '127.0.0.1', port: '4321', portSource: 'localslip' }),
			{ hostPort: '127.0.0.1:4321', note: 'port leased from LocalSlip' },
		);
		assert.deepEqual(bridgeServeHeading({ host: '0.0.0.0', port: '4321', portSource: null }), {
			hostPort: ':4321',
			note: 'on all interfaces',
		});
		assert.deepEqual(bridgeServeHeading({ host: null, port: null, portSource: null }), {
			hostPort: '',
			note: '',
		});
	});
});
