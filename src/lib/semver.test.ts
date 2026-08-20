import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bumpTriple, compareSemver, rangeCovers } from './semver.js';

describe('semver', () => {
	it('orders patch correctly', () => {
		assert.equal(compareSemver('0.1.10', '0.1.9'), 1);
		assert.equal(compareSemver('0.1.8', '0.1.8'), 0);
	});

	it('covers caret ranges', () => {
		assert.equal(rangeCovers('^0.1.8', '0.1.9'), true);
		assert.equal(rangeCovers('^0.1.8', '0.2.0'), false);
		assert.equal(rangeCovers('^1.2.0', '1.9.0'), true);
		assert.equal(rangeCovers('^1.2.0', '2.0.0'), false);
	});

	it('bumps patch minor major', () => {
		assert.equal(bumpTriple('0.1.8', 'patch'), '0.1.9');
		assert.equal(bumpTriple('0.1.8', 'minor'), '0.2.0');
		assert.equal(bumpTriple('0.1.8', 'major'), '1.0.0');
	});
});
