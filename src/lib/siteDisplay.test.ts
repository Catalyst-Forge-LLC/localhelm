import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	siteCellValue,
	siteEngineVersion,
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
		]);
		assert.deepEqual(
			cols.map((col) => col.id),
			['engine', 'headers'],
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
});
