import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compareScanPath } from './scan.js';
import { isNestedSitePath } from './scanPaths.js';

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

describe('isNestedSitePath', () => {
	it('drops FilePress site folders under a package', () => {
		assert.equal(isNestedSitePath('acmegeek/site'), true);
		assert.equal(isNestedSitePath('acmegeek/site/docs'), true);
		assert.equal(isNestedSitePath('aegis/web'), false);
		assert.equal(isNestedSitePath('site'), false);
		assert.equal(isNestedSitePath('.'), false);
	});
});
