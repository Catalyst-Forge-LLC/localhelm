import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { plainFetchError } from './fetchError.js';

describe('plainFetchError', () => {
	it('rewrites the browser Failed to fetch TypeError', () => {
		assert.match(plainFetchError(new TypeError('Failed to fetch')), /Serve may have stopped/);
	});

	it('passes through ordinary errors', () => {
		assert.equal(plainFetchError(new Error('plugin not loaded: filepress')), 'plugin not loaded: filepress');
	});
});
