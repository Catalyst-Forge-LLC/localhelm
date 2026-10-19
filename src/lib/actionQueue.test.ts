import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	enqueue,
	failedConfirmSubjects,
	holdLine,
	intentLabel,
	removeIntent,
	takeNext,
	type ActionIntent,
} from './actionQueue.js';

const push = (id: string, ids: string[]): ActionIntent => ({ id, kind: 'push', ids });

describe('action queue', () => {
	it('keeps intents in the order they were added', () => {
		const queued = enqueue(enqueue([], push('a', ['one', 'one', ' two '])), {
			id: 'b',
			kind: 'publish',
			ids: ['two'],
		});
		assert.deepEqual(queued.map((item) => item.kind), ['push', 'publish']);
		assert.deepEqual(queued[0]?.ids, ['one', 'two']);
		assert.equal(intentLabel(queued[0]!), 'Push 2');
		assert.equal(intentLabel(queued[1]!), 'Publish two');
	});

	it('leaves the queue unchanged when an intent has no repos', () => {
		const queued = enqueue([push('a', ['one'])], { id: 'b', kind: 'ship', ids: [' ', ''] });
		assert.equal(queued.length, 1);
	});

	it('holds a repo that already failed and still runs the rest', () => {
		const queued = [
			push('a', ['craftassay', 'detangler']),
			{ id: 'b', kind: 'publish' as const, ids: ['craftassay', 'misemphasis'] },
			{ id: 'c', kind: 'ship' as const, ids: ['craftassay'] },
		];
		const first = takeNext(queued, new Set());
		assert.deepEqual(first.next?.ids, ['craftassay', 'detangler']);
		const second = takeNext(first.queue, new Set(['craftassay']));
		assert.deepEqual(second.next?.ids, ['misemphasis']);
		assert.deepEqual(second.skipped.map((row) => row.id), ['craftassay']);
		const third = takeNext(second.queue, new Set(['craftassay']));
		assert.equal(third.next, null);
		assert.deepEqual(third.skipped.map((row) => `${row.kind}:${row.id}`), ['ship:craftassay']);
		assert.match(holdLine(second.skipped), /craftassay stays out/);
	});

	it('removes one intent without disturbing the others', () => {
		const queued = [push('a', ['one']), push('b', ['two'])];
		assert.deepEqual(removeIntent(queued, 'a').map((item) => item.id), ['b']);
	});

	it('treats a stepped confirm key as the repo', () => {
		assert.deepEqual(
			failedConfirmSubjects(['craftassay:0', 'craftassay:1', 'detangler'], ['fail', 'done', 'pending']),
			['craftassay'],
		);
	});
});
