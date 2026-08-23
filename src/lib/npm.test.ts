import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { withPublishedLocal } from './npm.js';

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
