import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { activityLinkedIds } from './activityLinks.js';

describe('activityLinkedIds', () => {
	it('links known ids without grabbing a longer neighbor', () => {
		assert.deepEqual(
			activityLinkedIds('localslip start dictawhisper', ['dictawhisper', 'dictawhisper-site', 'file']),
			['dictawhisper'],
		);
		assert.deepEqual(activityLinkedIds('archive filepress', ['file', 'filepress']), ['filepress']);
		assert.deepEqual(activityLinkedIds('nothing here', ['aibreze']), []);
		assert.deepEqual(
			activityLinkedIds('publish --apply — 11 published, 3 failed: aibreze, finetuna, ollanet', [
				'aibreze',
				'finetuna',
				'ollanet',
				'coldeye',
			]),
			['aibreze', 'finetuna', 'ollanet'],
		);
	});
});
