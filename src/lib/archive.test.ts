import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { archiveIds, archivePath, planArchive, readArchive, restoreIds } from './archive.js';

describe('archive', () => {
	it('hides and restores ids without touching a folder', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-archive-'));
		const first = await archiveIds(root, ['temper-pass', 'demo']);
		assert.deepEqual(first.ids, ['demo', 'temper-pass']);
		assert.equal(archivePath(root).replace(/\\/g, '/').endsWith('.localhelm/archive.json'), true);
		const restored = await restoreIds(root, ['temper-pass']);
		assert.deepEqual(restored.ids, ['demo']);
		assert.deepEqual((await readArchive(root)).ids, ['demo']);
		await rm(root, { recursive: true, force: true });
	});

	it('plans skip for already hidden or not archived', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-archive-plan-'));
		await archiveIds(root, ['demo']);
		assert.deepEqual(await planArchive(root, ['demo', 'fresh'], false), [
			{ id: 'demo', action: 'skip', reason: 'already hidden' },
			{ id: 'fresh', action: 'hide' },
		]);
		assert.deepEqual(await planArchive(root, ['demo', 'fresh'], true), [
			{ id: 'demo', action: 'restore' },
			{ id: 'fresh', action: 'skip', reason: 'not archived' },
		]);
		assert.deepEqual((await readArchive(root)).ids, ['demo']);
		await rm(root, { recursive: true, force: true });
	});
});
