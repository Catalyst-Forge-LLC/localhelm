import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { joinBatchFailures, runNamedBatch } from './batchApply.js';
import { JobCancelledError } from './jobCancel.js';

describe('runNamedBatch', () => {
	it('continues after one name throws and joins reasons', async () => {
		const seen: string[] = [];
		const failed = await runNamedBatch(['a', 'b', 'c'], async (name) => {
			seen.push(name);
			if (name === 'b') throw new Error('nope');
		});
		assert.deepEqual(seen, ['a', 'b', 'c']);
		assert.deepEqual(failed, [{ name: 'b', reason: 'nope' }]);
		assert.equal(joinBatchFailures(failed), 'b: nope');
	});

	it('stops before the next name when shouldStop is set', async () => {
		const seen: string[] = [];
		await assert.rejects(
			() =>
				runNamedBatch(['a', 'b', 'c'], async (name) => {
					seen.push(name);
				}, {
					shouldStop: () => seen.length >= 1,
				}),
			(err: unknown) => err instanceof JobCancelledError && err.done === 1,
		);
		assert.deepEqual(seen, ['a']);
	});

	it('rethrows JobCancelledError from the item fn', async () => {
		await assert.rejects(
			() =>
				runNamedBatch(['a', 'b'], async (name) => {
					if (name === 'a') throw new JobCancelledError(0, 2);
				}),
			JobCancelledError,
		);
	});
});
