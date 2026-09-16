import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	clearNpmCache,
	mapPool,
	npmCliNotFound,
	npmHasVersion,
	npmLatestMany,
	parseMaintainerSearchJson,
	parseNpmViewVersion,
	waitForNpmVersion,
	withPublishedLocal,
} from './npm.js';

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

	it('reports finished counts in order', async () => {
		const ticks: number[] = [];
		await mapPool([1, 2, 3], 2, async (n) => n, (done) => ticks.push(done));
		assert.deepEqual(ticks, [1, 2, 3]);
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

describe('npm maintainer search + view', () => {
	it('parses search hits and quoted view versions', () => {
		assert.deepEqual(
			parseMaintainerSearchJson(
				JSON.stringify([
					{ name: 'localhelm', version: '0.1.20' },
					{ package: { name: 'getfilepress', version: '0.2.0' } },
				]),
			),
			[
				{ name: 'localhelm', version: '0.1.20' },
				{ name: 'getfilepress', version: '0.2.0' },
			],
		);
		assert.equal(parseNpmViewVersion('"1.2.3"\n'), '1.2.3');
		assert.equal(parseNpmViewVersion(JSON.stringify({ version: '4.5.6' })), '4.5.6');
		assert.equal(npmCliNotFound('npm ERR! code E404', 1), true);
		assert.equal(npmCliNotFound('npm ERR! code E429', 1), false);
	});

	it('seeds latest from maintainer search and views only leftovers', async () => {
		clearNpmCache();
		const calls: string[][] = [];
		const byName = await npmLatestMany(['localhelm', 'solo-pkg'], 2, undefined, {
			owner: 'acmegeek',
			ownerSearch: true,
			run: async (args) => {
				calls.push([...args]);
				if (args[0] === 'search') {
					return {
						status: 0,
						stdout: JSON.stringify([{ name: 'localhelm', version: '0.1.20' }]),
						stderr: '',
					};
				}
				if (args[0] === 'view' && args[1] === 'solo-pkg') {
					return { status: 0, stdout: '"0.3.0"\n', stderr: '' };
				}
				return { status: 1, stdout: '', stderr: `unexpected ${args.join(' ')}` };
			},
		});
		assert.equal(byName.get('localhelm')?.latest, '0.1.20');
		assert.equal(byName.get('solo-pkg')?.latest, '0.3.0');
		assert.equal(calls.filter((args) => args[0] === 'search').length, 1);
		assert.equal(calls.filter((args) => args[0] === 'view').length, 1);
		assert.deepEqual(calls.find((args) => args[0] === 'search')?.slice(0, 2), [
			'search',
			'maintainer:acmegeek',
		]);
	});

	it('views enrolled names without waiting on maintainer search', async () => {
		clearNpmCache();
		const calls: string[][] = [];
		const byName = await npmLatestMany(['localhelm'], 1, undefined, {
			owner: 'acmegeek',
			run: async (args) => {
				calls.push([...args]);
				if (args[0] === 'view' && args[1] === 'localhelm') {
					return { status: 0, stdout: '"0.1.20"\n', stderr: '' };
				}
				return { status: 1, stdout: '', stderr: `unexpected ${args.join(' ')}` };
			},
		});
		assert.equal(byName.get('localhelm')?.latest, '0.1.20');
		assert.equal(byName.get('localhelm')?.status, 'ok');
		assert.equal(calls.filter((args) => args[0] === 'search').length, 0);
		assert.deepEqual(calls[0]?.slice(0, 3), ['view', 'localhelm', 'version']);
	});

	it('keeps the view cell when the cache is cleared mid-lookup', async () => {
		clearNpmCache();
		const byName = await npmLatestMany(['localhelm'], 1, undefined, {
			run: async () => {
				clearNpmCache();
				return { status: 0, stdout: '"0.1.20"\n', stderr: '' };
			},
		});
		assert.equal(byName.get('localhelm')?.latest, '0.1.20');
		assert.notEqual(byName.get('localhelm')?.error, 'npm view missing result for localhelm');
	});

	it('treats npm view 404 as unpublished', async () => {
		clearNpmCache();
		const cell = await npmHasVersion('missing-pkg', '1.0.0', {
			run: async () => ({
				status: 1,
				stdout: '',
				stderr: 'npm ERR! code E404\nnpm ERR! 404 Not Found',
			}),
		});
		assert.equal(cell.status, 'none');
	});
});
