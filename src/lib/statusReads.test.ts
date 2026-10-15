import assert from 'node:assert/strict';
import { it } from 'node:test';
import { StatusReads } from './statusReads.js';

it('keeps independent row refreshes regardless of response order', () => {
	const reads = new StatusReads();
	const a = reads.begin(['a']); const b = reads.begin(['b']);
	assert.equal(reads.accepts(b, 'b'), true);
	assert.equal(reads.accepts(a, 'a'), true);
	assert.equal(reads.accepts(a, 'b'), false);
});

it('uses the newest request for each overlapping subject', () => {
	const reads = new StatusReads();
	const first = reads.begin(['a', 'b']); const newer = reads.begin(['b']);
	assert.equal(reads.accepts(first, 'a'), true);
	assert.equal(reads.accepts(first, 'b'), false);
	assert.equal(reads.accepts(newer, 'b'), true);
});

it('keeps a broad read for other rows while a newer row read is pending', () => {
	const reads = new StatusReads();
	const full = reads.begin(); const row = reads.begin(['b']);
	assert.equal(reads.accepts(full, 'a'), true);
	assert.equal(reads.accepts(full, 'b'), false);
	assert.equal(reads.accepts(row, 'b'), true);
	assert.equal(reads.latest(full), false);
	assert.equal(reads.latest(row), true);
});

it('a newer full read supersedes older requests; board changes invalidate everything', () => {
	const reads = new StatusReads();
	const row = reads.begin(['a']); const full = reads.begin();
	assert.equal(reads.accepts(row, 'a'), false);
	assert.equal(reads.accepts(full, 'a'), true);
	reads.reset();
	assert.equal(reads.accepts(full, 'a'), false);
	assert.equal(reads.latest(full), false);
});
