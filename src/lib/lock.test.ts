import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { acquireJobLock, clearStaleJobLock, isPidAlive, parseJobLockHolder } from './lock.js';

describe('job lock', () => {
	it('holds one job at a time', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-lock-'));
		const first = await acquireJobLock(root);
		await assert.rejects(() => acquireJobLock(root), /another localhelm job/);
		await first.release();
		const second = await acquireJobLock(root);
		await second.release();
	});

	it('names a live holder pid', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-lock-'));
		const first = await acquireJobLock(root);
		await assert.rejects(() => acquireJobLock(root), new RegExp(`pid ${process.pid}`));
		await first.release();
	});

	it('steals a leftover lock when the pid is gone', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-lock-'));
		const dir = path.join(root, '.localhelm');
		await mkdir(dir, { recursive: true });
		await writeFile(path.join(dir, 'job.lock'), '199999999\n2026-09-14T00:00:00.000Z\n', 'utf8');
		assert.equal(isPidAlive(199999999), false);
		const stale = await clearStaleJobLock(root);
		assert.equal(stale.cleared, true);
		assert.equal(stale.pid, 199999999);
		const lock = await acquireJobLock(root);
		await lock.release();
	});

	it('acquires after a dead pid leftover without a separate clear', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-lock-'));
		const dir = path.join(root, '.localhelm');
		await mkdir(dir, { recursive: true });
		await writeFile(path.join(dir, 'job.lock'), '199999998\n2026-09-14T00:00:00.000Z\n', 'utf8');
		const lock = await acquireJobLock(root);
		await lock.release();
	});

	it('parses the pid and time from the lock file', () => {
		assert.deepEqual(parseJobLockHolder(`${process.pid}\n2026-09-14T12:00:00.000Z\n`), {
			pid: process.pid,
			at: '2026-09-14T12:00:00.000Z',
		});
		assert.equal(parseJobLockHolder('nope\n'), null);
		assert.equal(isPidAlive(process.pid), true);
	});
});
