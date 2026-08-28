import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	canonicalizeTab,
	isPortsPluginTab,
	parseDashboardTab,
	pluginTabCount,
	pluginTabIcon,
	pluginTabMetas,
} from './dashboardTabs.js';

describe('dashboardTabs', () => {
	it('keeps old Sites and Ports URLs on the matching plugin', () => {
		assert.equal(parseDashboardTab('sites'), 'filepress');
		assert.equal(parseDashboardTab('ports'), 'localslip');
		assert.equal(parseDashboardTab('filepress'), 'filepress');
		assert.equal(parseDashboardTab('xfacts'), 'xfacts');
		assert.equal(parseDashboardTab('today'), 'today');
		assert.equal(parseDashboardTab('Not A Tab'), null);
		assert.equal(canonicalizeTab('sites'), 'filepress');
		assert.equal(isPortsPluginTab('ports'), true);
		assert.equal(isPortsPluginTab('localslip'), true);
		assert.equal(isPortsPluginTab('filepress'), false);
	});

	it('uses plugin labels for tab names', () => {
		assert.deepEqual(
			pluginTabMetas(
				[
					{ id: 'filepress', label: 'FilePress Sites' },
					{ id: 'localslip', label: 'LocalSlip Ports' },
					{ id: 'xfacts', label: 'xFacts labels', enabled: false },
				],
				[],
			),
			[
				{ id: 'filepress', label: 'FilePress Sites' },
				{ id: 'localslip', label: 'LocalSlip Ports' },
			],
		);
		assert.deepEqual(
			pluginTabMetas([], [{ plugin: 'filepress', title: 'FilePress sites' }]),
			[{ id: 'filepress', label: 'FilePress sites' }],
		);
	});

	it('counts FilePress rows and LocalSlip leases', () => {
		assert.equal(pluginTabIcon('filepress'), 'lucide:globe');
		assert.equal(
			pluginTabCount('filepress', [{ plugin: 'filepress', rows: [{}, {}] }]),
			2,
		);
		assert.equal(
			pluginTabCount('localslip', [
				{ plugin: 'localslip', title: 'Leases', rows: [{}, {}, {}] },
				{ plugin: 'localslip', title: 'Observed', rows: [{}] },
			]),
			3,
		);
	});
});
