import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mapPool, waitForNpmVersion, withPublishedLocal } from './npm.js';

describe('mapPool', () => {
	it('keeps order and runs more than one worker', async () => {
		const seen: number[] = [];
		const out = await mapPool([3, 1, 2], 2, async (n) => {
			seen.push(n);
			await new Promise((resolve) => setTimeout(resolve, n * 15));
			return n * 10;
		});
		assert.deepEqual(out, [30, 10, 20]);
		assert.equal(seen.length, 3);
	});
});

describe('withPublishedLocal', () => {
	it('lifts latest when local is already on npm but /latest lagged', () => {
		const cell = withPublishedLocal({ name: 'getfilepress', latest: '0.1.8', status: 'ok' }, '0.1.9', true);
		assert.equal(cell.latest, '0.1.9');
	});

	it('keeps /latest when the local version is not on npm', () => {
		const cell = withPublishedLocal({ name: 'getfilepress', latest: '0.1.8', status: 'ok' }, '0.1.9', false);
		assert.equal(cell.latest, '0.1.8');
	});

	it('does not move latest backwards', () => {
		const cell = withPublishedLocal({ name: 'pkg', latest: '2.0.0', status: 'ok' }, '1.9.0', true);
		assert.equal(cell.latest, '2.0.0');
	});
});

describe('waitForNpmVersion', () => {
	it('returns as soon as the version document exists', async () => {
		let n = 0;
		const cell = await waitForNpmVersion('localhelm', '0.1.12', {
			intervalMs: 0,
			timeoutMs: 1_000,
			sleep: async () => undefined,
			probe: async () => {
				n += 1;
				return n < 2
					? { name: 'localhelm', status: 'none' }
					: { name: 'localhelm', latest: '0.1.12', status: 'ok' };
			},
		});
		assert.equal(cell.status, 'ok');
		assert.equal(cell.latest, '0.1.12');
		assert.equal(n, 2);
	});

	it('times out with not-on-npm when the version never appears', async () => {
		let now = 0;
		const cell = await waitForNpmVersion('localhelm', '0.1.12', {
			intervalMs: 5,
			timeoutMs: 10,
			now: () => now,
			sleep: async () => {
				now += 5;
			},
			probe: async () => ({ name: 'localhelm', status: 'none' }),
		});
		assert.equal(cell.status, 'none');
		assert.match(cell.error ?? '', /is not on npm yet/);
	});
});
