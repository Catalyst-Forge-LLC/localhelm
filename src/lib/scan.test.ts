import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compareScanPath } from './scan.js';

describe('compareScanPath', () => {
	it('lists folders A–Z ignoring case and keeps children under the parent', () => {
		const mixed = ['FocusFreely/scripts', 'acmegeek', 'FocusFreely', 'aegis/web', 'aegis'];
		assert.deepEqual(mixed.toSorted(compareScanPath), [
			'acmegeek',
			'aegis',
			'aegis/web',
			'FocusFreely',
			'FocusFreely/scripts',
		]);
	});
});
