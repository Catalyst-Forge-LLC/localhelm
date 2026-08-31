import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PluginBoard } from './plugin.js';
import { visitorMachineCard } from './visitorMachine.js';
import { isVisitorSelf, visitorTilesFromBoards } from './visitorTiles.js';

const leaseBoard = (rows: PluginBoard['rows']): PluginBoard => ({
	plugin: 'localslip',
	tab: 'ports',
	title: 'Leases',
	columns: [],
	rows,
});

describe('Deck tiles from Ports boards', () => {
	it('keeps listening LAN leases and drops loopback, parked, and this dashboard', () => {
		const tiles = visitorTilesFromBoards(
			[
				leaseBoard([
					{
						id: 'localhelm-site',
						label: 'localhelm-site',
						cells: { listening: 'yes', bind: '0.0.0.0', port: '5201', parked: 'no' },
						actions: [],
					},
					{
						id: 'dictawhisper',
						cells: { listening: 'yes', bind: '127.0.0.1', port: '7777' },
						actions: [],
					},
					{
						id: 'parked-site',
						cells: { listening: 'yes', bind: '0.0.0.0', port: '5180', parked: 'yes' },
						actions: [],
					},
					{
						id: 'localhelm',
						cells: { listening: 'yes', bind: '0.0.0.0', port: '4321' },
						actions: [],
					},
				]),
			],
			{ helmPort: 4321 },
		);
		assert.deepEqual(tiles, [{ name: 'localhelm-site', port: 5201, title: 'localhelm-site' }]);
	});

	it('treats helm and slip dashboard ids as self', () => {
		assert.equal(isVisitorSelf('localhelm', 9999), true);
		assert.equal(isVisitorSelf('localslip', 9999), true);
		assert.equal(isVisitorSelf('filepress', 54321), true);
		assert.equal(isVisitorSelf('filepress', 5180), false);
	});
});

describe('visitor machine card', () => {
	it('returns a hostname string and an address list', () => {
		const card = visitorMachineCard();
		assert.equal(typeof card.hostname, 'string');
		assert.ok(Array.isArray(card.addresses));
	});
});
