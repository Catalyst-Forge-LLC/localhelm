import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { remainingAfter } from '../../app/src/lib/publishBatch.js';

describe('remainingAfter', () => {
	it('drops ids that already have a row', () => {
		assert.deepEqual(remainingAfter(['a', 'b', 'c'], [{ id: 'a' }, { id: 'c' }]), ['b']);
		assert.deepEqual(remainingAfter(['a'], [{ id: 'a' }]), []);
	});
});
