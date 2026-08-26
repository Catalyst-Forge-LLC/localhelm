import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bulkProgressLabel } from './bulkProgress.js';

describe('bulkProgressLabel', () => {
	it('keeps a single item short', () => {
		assert.equal(bulkProgressLabel('syncing', 1, 1, 'filepress-site'), 'syncing filepress-site');
		assert.equal(bulkProgressLabel('pulling', 1, 1), 'pulling');
	});

	it('names the current row in a batch', () => {
		assert.equal(bulkProgressLabel('syncing', 3, 18, 'dictawhisper-site'), 'syncing 3 of 18 · dictawhisper-site');
		assert.equal(bulkProgressLabel('pushing', 2, 5), 'pushing 2 of 5');
	});
});
