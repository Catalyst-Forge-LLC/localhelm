import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bindIsLan, portFiltersActive, rowMatchesPortFilters } from './portFilters.js';

describe('bindIsLan', () => {
	it('treats loopback as not LAN', () => {
		assert.equal(bindIsLan('127.0.0.1'), false);
		assert.equal(bindIsLan('[::1]'), false);
		assert.equal(bindIsLan('localhost'), false);
		assert.equal(bindIsLan('—'), false);
	});

	it('treats wildcard and LAN binds as LAN', () => {
		assert.equal(bindIsLan('0.0.0.0'), true);
		assert.equal(bindIsLan('192.168.1.10'), true);
	});
});

describe('rowMatchesPortFilters', () => {
	const up = {
		listening: 'yes',
		bind: '127.0.0.1',
		conflict: 'no',
		kind: 'always',
		firewall: 'skipped',
	};

	it('filters listen, bind, conflict, ephemeral, and firewall on leases', () => {
		assert.equal(rowMatchesPortFilters(up, { listening: true }, 'leases'), true);
		assert.equal(rowMatchesPortFilters(up, { listening: false }, 'leases'), false);
		assert.equal(rowMatchesPortFilters(up, { lan: false }, 'leases'), true);
		assert.equal(rowMatchesPortFilters(up, { lan: true }, 'leases'), false);
		assert.equal(rowMatchesPortFilters({ ...up, bind: '0.0.0.0' }, { lan: true }, 'leases'), true);
		assert.equal(rowMatchesPortFilters(up, { conflict: true }, 'leases'), false);
		assert.equal(rowMatchesPortFilters({ ...up, conflict: 'yes' }, { conflict: true }, 'leases'), true);
		assert.equal(rowMatchesPortFilters(up, { ephemeral: true }, 'leases'), false);
		assert.equal(rowMatchesPortFilters({ ...up, kind: 'ephemeral' }, { ephemeral: true }, 'leases'), true);
		assert.equal(rowMatchesPortFilters(up, { firewall: 'skipped' }, 'leases'), true);
		assert.equal(rowMatchesPortFilters(up, { firewall: 'applied' }, 'leases'), false);
	});

	it('only uses bind on observed rows', () => {
		const obs = { bind: '0.0.0.0' };
		assert.equal(rowMatchesPortFilters(obs, { lan: true, listening: true, conflict: true }, 'observed'), true);
		assert.equal(rowMatchesPortFilters(obs, { lan: false }, 'observed'), false);
	});

	it('reports when any chip is on', () => {
		assert.equal(portFiltersActive({}), false);
		assert.equal(portFiltersActive({ listening: false }), true);
		assert.equal(portFiltersActive({ lan: true }), true);
	});
});
