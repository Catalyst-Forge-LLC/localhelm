import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classifySpec, pinsFromPkg } from './pins.js';

describe('pins', () => {
	it('classifies spec kinds', () => {
		assert.equal(classifySpec('^0.1.8'), 'registry');
		assert.equal(classifySpec('link:../aibreze'), 'link');
		assert.equal(classifySpec('file:../x'), 'file');
	});

	it('marks link edges and ignores outside packages', () => {
		const edges = pinsFromPkg(
			'site-a',
			'root',
			{ dependencies: { aibreze: 'link:../aibreze', svelte: '^5.0.0' } },
			[{ id: 'aibreze', path: 'aibreze', npm: 'aibreze' }],
			new Map([['aibreze', '0.1.6']]),
		);
		assert.equal(edges.length, 1);
		assert.equal(edges[0]?.kind, 'link');
		assert.equal(edges[0]?.onLatest, false);
	});
});
