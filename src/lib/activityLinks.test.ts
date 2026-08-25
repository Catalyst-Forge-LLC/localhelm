import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { activityLinkedIds } from './activityLinks.js';

describe('activityLinkedIds', () => {
	it('links known ids without grabbing a longer neighbor', () => {
		assert.deepEqual(
			activityLinkedIds('localberth start dictawhisper', ['dictawhisper', 'dictawhisper-site', 'file']),
			['dictawhisper'],
		);
		assert.deepEqual(activityLinkedIds('archive filepress', ['file', 'filepress']), ['filepress']);
		assert.deepEqual(activityLinkedIds('nothing here', ['aibreze']), []);
	});
});
