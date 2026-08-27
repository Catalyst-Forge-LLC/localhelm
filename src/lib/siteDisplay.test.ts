import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	siteCellValue,
	siteEngineVersion,
	siteLiveHref,
	siteLocalHref,
	siteNeedsEngineSync,
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
