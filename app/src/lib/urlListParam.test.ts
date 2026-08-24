import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	idsToSelection,
	listsEqual,
	parseListParam,
	selectionToIds,
	serializeListParam,
} from './urlListParam.js';

describe('urlListParam', () => {
	it('parses and serializes CSV lists', () => {
		assert.deepEqual(parseListParam('a, b,a,'), ['a', 'b']);
		assert.equal(serializeListParam(['a', 'b', 'a']), 'a,b');
		assert.equal(serializeListParam([]), null);
	});

	it('round-trips selection maps', () => {
		assert.deepEqual(selectionToIds({ b: true, a: true, c: false }), ['a', 'b']);
		assert.deepEqual(idsToSelection(['a', 'b']), { a: true, b: true });
		assert.equal(listsEqual(['a', 'b'], ['a', 'b']), true);
		assert.equal(listsEqual(['a', 'b'], ['b', 'a']), false);
	});
});
