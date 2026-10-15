import assert from 'node:assert/strict';
import { it } from 'node:test';
import { ActivityQueue, activityQueueKey } from './activityQueue.js';
function store() { const data = new Map<string, string>(); return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } }; }
const entry = (id: string) => ({ id, at: `2026-10-15T00:00:0${id === 'a' ? '1' : '2'}Z`, title: id, body: 'Original content' });
it('retains original identities and timestamps across reload, merge and acknowledgement retry', () => {
	const storage = store(); const key = activityQueueKey('/workspace', false); const queue = new ActivityQueue(storage, key);
	queue.load({ generation: '0', entries: [] }); queue.enqueue(entry('a')); queue.enqueue(entry('b'));
	const restored = new ActivityQueue(storage, key); restored.load({ generation: '0', entries: [entry('a')] });
	assert.equal(restored.entries.length, 2); assert.deepEqual(restored.pending[0], entry('a'));
	restored.ack('a', { generation: '0', entries: [entry('a')] }); restored.load({ generation: '0', entries: [] });
	assert.equal(restored.entries.length, 2, 'An older read cannot discard an acknowledged entry');
	assert.equal(new ActivityQueue(storage, activityQueueKey('/workspace', true)).pending.length, 0);
});
it('requires explicit review after another clear and preserves entries created during a local clear', () => {
	const queue = new ActivityQueue(store(), 'queue'); queue.load({ generation: '0', entries: [] }); queue.enqueue(entry('a'));
	queue.load({ generation: 'new', entries: [] }); assert.equal(queue.blocked, true); assert.equal(queue.pending.length, 1);
	queue.rebase(); assert.equal(queue.blocked, false); assert.equal(queue.generation, 'new');
	queue.enqueue(entry('b')); queue.cleared({ generation: 'cleared', entries: [] }, ['a']); assert.deepEqual(queue.pending, [entry('b')]);
});
it('keeps unsaved entries visible when durable storage fails', () => {
	const storage = store(); const queue = new ActivityQueue(storage, 'queue'); storage.setItem = () => { throw new Error('quota'); };
	assert.throws(() => queue.enqueue(entry('a')), /quota/); assert.deepEqual(queue.entries, [entry('a')]);
});
