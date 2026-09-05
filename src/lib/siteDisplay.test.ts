import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	pluginCellHref,
	pluginCellLinks,
	pluginRowNote,
	pluginRowOpenHref,
	siteCellValue,
	siteEngineVersion,
	siteLiveHref,
	siteLocalHref,
	siteNeedsEngineSync,
	sitePluginJobVisible,
	siteSyncLabel,
	siteSyncTarget,
	siteTableColumns,
} from './siteDisplay.js';

describe('siteDisplay', () => {
	it('replaces pin/locked/update with one engine column', () => {
		const cols = siteTableColumns('filepress', [
			{ id: 'pin', label: 'pin' },
			{ id: 'locked', label: 'locked' },
			{ id: 'update', label: 'update' },
			{ id: 'headers', label: 'headers' },
			{ id: 'ship', label: 'ship' },
			{ id: 'git', label: 'git' },
			{ id: 'live', label: 'live' },
		]);
		assert.deepEqual(
			cols.map((col) => col.id),
			['engine', 'git', 'live'],
		);
		assert.deepEqual(siteTableColumns('other', [{ id: 'pin', label: 'pin' }]), [{ id: 'pin', label: 'pin' }]);
	});

	it('keeps xFacts label columns and hides name plus ok-status', () => {
		assert.deepEqual(
			siteTableColumns('xfacts', [
				{ id: 'app', label: 'app' },
				{ id: 'tool', label: 'tool' },
				{ id: 'skill', label: 'skill' },
				{ id: 'agent', label: 'agent' },
				{ id: 'model', label: 'model' },
				{ id: 'name', label: 'name' },
				{ id: 'status', label: 'status' },
			]).map((col) => col.id),
			['app', 'tool', 'skill', 'agent', 'model'],
		);
		assert.equal(pluginRowNote('xfacts', { status: 'ok' }), null);
		assert.equal(pluginRowNote('xfacts', { status: 'needs encode' }), 'needs encode');
		assert.equal(pluginRowNote('filepress', { status: 'needs encode' }), null);
	});

	it('keeps FilePress sync and push off the Sites job list', () => {
		assert.equal(sitePluginJobVisible('filepress', 'ship'), true);
		assert.equal(sitePluginJobVisible('filepress', 'sync'), false);
		assert.equal(sitePluginJobVisible('filepress', 'push'), false);
		assert.equal(sitePluginJobVisible('localslip', 'push'), true);
	});

	it('prefers the locked version and names the sync target', () => {
		const cells = {
			pin: 'npm ^0.1.10',
			locked: '0.1.10',
			update: 'pnpm update getfilepress  (0.1.10 → 0.1.11)',
			headers: 'ok',
		};
		assert.equal(siteEngineVersion(cells), '0.1.10');
		assert.equal(siteCellValue('engine', cells), '0.1.10');
		assert.equal(siteSyncTarget(cells), '0.1.11');
		assert.equal(siteNeedsEngineSync(cells), true);
		assert.equal(siteSyncLabel(cells), 'Sync engine 0.1.11');
	});

	it('hides sync when the pin is already current', () => {
		const cells = { pin: 'npm ^0.1.10', locked: '0.1.10', update: 'already ^0.1.10', headers: 'ok' };
		assert.equal(siteNeedsEngineSync(cells), false);
		assert.equal(siteSyncLabel(cells), 'Sync engine');
	});

	it('treats only http(s) live cells as openable', () => {
		assert.equal(siteLiveHref({ live: 'https://localhelm.dev' }), 'https://localhelm.dev/');
		assert.equal(siteLiveHref({ live: 'http://127.0.0.1:4173/' }), 'http://127.0.0.1:4173/');
		assert.equal(siteLiveHref({ live: '—' }), null);
		assert.equal(siteLiveHref({ live: 'javascript:alert(1)' }), null);
		assert.equal(siteLiveHref({}), null);
		assert.equal(pluginCellHref('ok https://skillfacts.dev/v#sf1.abc'), 'https://skillfacts.dev/v#sf1.abc');
		assert.equal(pluginCellHref('ok'), null);
		assert.equal(
			pluginRowOpenHref({
				href: 'https://appfacts.dev/v#af1.x',
				cells: { live: '—' },
			}),
			'https://appfacts.dev/v#af1.x',
		);
		assert.deepEqual(
			pluginCellLinks(
				{
					cells: { skill: '3' },
					linkGroups: {
						skill: [
							{ label: 'core', href: 'https://skillfacts.dev/v#sf1.a' },
							{ label: 'audit' },
						],
					},
				},
				'skill',
				'3',
			),
			[
				{ label: 'core', href: 'https://skillfacts.dev/v#sf1.a' },
				{ label: 'audit', href: null },
			],
		);
		assert.deepEqual(
			pluginCellLinks(
				{
					cells: { app: 'ok' },
					links: { app: 'https://appfacts.dev/v#af1.x' },
				},
				'app',
				'ok',
			),
			[{ label: 'ok', href: 'https://appfacts.dev/v#af1.x' }],
		);
	});

	it('opens the *-site lease, not the dashboard lease', () => {
		const leases = [
			{ id: 'localhelm', href: 'http://127.0.0.1:4321/' },
			{ id: 'localhelm-site', href: 'http://127.0.0.1:5201/' },
		];
		assert.equal(siteLocalHref('localhelm', leases), 'http://127.0.0.1:5201/');
		assert.equal(siteLocalHref('localhelm', [{ id: 'localhelm', href: 'http://127.0.0.1:4321/' }]), null);
		assert.equal(siteLocalHref('aibreze', [{ id: 'aibreze-site', href: 'http://127.0.0.1:5181/' }]), 'http://127.0.0.1:5181/');
		assert.equal(siteLocalHref('localhelm-site', [{ id: 'localhelm-site' }]), null);
	});
});
