import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { acquireJobLock } from './lock.js';

describe('job lock', () => {
	it('holds one job at a time', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-lock-'));
		const first = await acquireJobLock(root);
		await assert.rejects(() => acquireJobLock(root), /another localhelm job/);
		await first.release();
		const second = await acquireJobLock(root);
		await second.release();
	});
});
