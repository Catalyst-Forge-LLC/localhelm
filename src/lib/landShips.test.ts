import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
	markLandShipFailed,
	readLandPendingSiteIds,
	readLandShipFingerprint,
	recordLandShip,
	shipUnchanged,
} from './landShips.js';

describe('land ship records', () => {
	it('does not treat a failed ship as the last successful fingerprint', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-land-ships-'));
		await recordLandShip(root, 'detangler', 'old-success:clean');
		await markLandShipFailed(root, 'detangler', 'new-tree:clean', 'YAML frontmatter failed');
		assert.equal(await readLandShipFingerprint(root, 'detangler'), 'old-success:clean');
		assert.deepEqual(await readLandPendingSiteIds(root), ['detangler']);
		assert.equal(shipUnchanged('old-success:clean', 'new-tree:clean'), false);
		assert.equal(shipUnchanged('old-success:clean', 'old-success:clean', true), false);

		const raw = JSON.parse(await readFile(path.join(root, '.localhelm', 'land-ships.json'), 'utf8')) as {
			sites: Record<string, { fingerprint: string; pending?: boolean }>;
		};
		assert.equal(raw.sites.detangler.fingerprint, 'old-success:clean');
		assert.equal(raw.sites.detangler.pending, true);

		await recordLandShip(root, 'detangler', 'new-tree:clean');
		assert.equal(await readLandShipFingerprint(root, 'detangler'), 'new-tree:clean');
		assert.deepEqual(await readLandPendingSiteIds(root), []);
	});
});
