import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { ACTIVITY_LIMIT, activityPath, appendActivity, clearActivity, readActivity } from './activity.js';

describe('activity log', () => {
	it('writes newest first under .localhelm', async () => {
		const root = path.join(tmpdir(), `localhelm-activity-${Date.now()}`);
		await mkdir(root, { recursive: true });
		const first = await appendActivity(root, { title: 'scan', data: { n: 1 }, at: '2026-08-23T12:00:00.000Z' });
		const second = await appendActivity(root, { title: 'push', data: { n: 2 }, at: '2026-08-23T12:01:00.000Z' });
		assert.equal(activityPath(root).replace(/\\/g, '/').endsWith('.localhelm/activity.json'), true);
		assert.equal(second[0]?.title, 'push');
		assert.equal(second[1]?.title, 'scan');
		assert.deepEqual(await readActivity(root), second);
		assert.equal(first.length, 1);
	});

	it('caps the file and treats a missing or broken file as empty', async () => {
		const root = path.join(tmpdir(), `localhelm-activity-cap-${Date.now()}`);
		await mkdir(path.join(root, '.localhelm'), { recursive: true });
		assert.deepEqual(await readActivity(root), []);
		await writeFile(activityPath(root), '{not json', 'utf8');
		assert.deepEqual(await readActivity(root), []);
		for (let i = 0; i < ACTIVITY_LIMIT + 5; i += 1) {
			await appendActivity(root, { title: `row ${i}`, data: { i } });
		}
		const entries = await readActivity(root);
		assert.equal(entries.length, ACTIVITY_LIMIT);
		assert.equal(entries[0]?.title, `row ${ACTIVITY_LIMIT + 4}`);
		await clearActivity(root);
		assert.deepEqual(await readActivity(root), []);
		await clearActivity(root);
	});

	it('rejects a blank title', async () => {
		const root = path.join(tmpdir(), `localhelm-activity-blank-${Date.now()}`);
		await mkdir(root, { recursive: true });
		await assert.rejects(() => appendActivity(root, { title: '  ', data: {} }), /title is required/);
	});
});
