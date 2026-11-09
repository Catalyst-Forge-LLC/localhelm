import assert from 'node:assert/strict';
import { it } from 'node:test';
import { JOB_HISTORY_KEEP, JobJournal, jobStorageKey, jobRequest, jobAcknowledgement, unresolvedJob } from './jobJournal.js';
function store() { const map = new Map<string, string>(); return { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value); } }; }
it('retains acknowledged results, stopped subjects, and uncertain writes across reload and board changes', () => {
	const storage = store(); const key = jobStorageKey('/fixture', false); const journal = new JobJournal(storage, key);
	const id = journal.begin('Push', ['a', 'b', 'c']); journal.start(id, ['a'], { route: '/api/push' }); journal.settle(id, ['a'], 'succeeded', 'pushed'); journal.start(id, ['b'], { route: '/api/push' });
	const restored = new JobJournal(storage, key); assert.deepEqual(restored.jobs[0]!.subjects.map((s) => s.state), ['succeeded', 'unknown', 'pending']);
	assert.equal(new JobJournal(storage, jobStorageKey('/fixture', true)).jobs.length, 0); assert.equal(new JobJournal(storage, jobStorageKey('/other', false)).jobs.length, 0);
	restored.finish(id); assert.equal(restored.jobs[0]!.subjects[0]!.state, 'succeeded'); restored.reconciled(id); assert(restored.jobs[0]!.reconciledAt);
});
it('never refuses a new action, keeps the newest results, and lets review be optional', () => {
	const journal = new JobJournal(store(), 'key');
	const ids: string[] = [];
	for (let i = 0; i < JOB_HISTORY_KEEP + 5; i++) { const id = journal.begin(`Ship ${i}`, ['a']); journal.settle(id, ['a'], 'failed', 'ship failed'); ids.push(id); }
	assert.equal(journal.jobs.length, JOB_HISTORY_KEEP);
	assert.equal(journal.jobs[0]!.id, ids.at(-1)); assert.equal(journal.jobs.some((job) => job.id === ids[0]), false);
	assert.equal(journal.jobs.filter(unresolvedJob).length, JOB_HISTORY_KEEP);
	journal.reviewed(ids.at(-1)!); assert.equal(journal.jobs.filter(unresolvedJob).length, JOB_HISTORY_KEEP - 1);
	const running = journal.begin('Land', ['site']); journal.start(running, ['site'], { route: '/api/land' });
	journal.reviewedAll();
	assert.deepEqual(journal.jobs.filter(unresolvedJob).map((job) => job.id), [running]);
	assert.equal(journal.jobs.length, JOB_HISTORY_KEEP);
});
it('does not call an update with no dependents unknown', () => {
	const op = { route: '/api/cascade' };
	assert.equal(jobAcknowledgement({ rows: [], writes: false }, 'workspace', op).state, 'succeeded');
	assert.equal(jobAcknowledgement({ rows: [{ fromId: 'a', action: 'skip', reason: 'dirty' }] }, 'workspace', op).state, 'succeeded');
	assert.equal(jobAcknowledgement({ rows: [] }, 'a', op).state, 'unknown');
	assert.equal(jobAcknowledgement({ rows: [{ fromId: 'a', action: 'retarget', writes: true }] }, 'a', op).state, 'succeeded');
});
it('reports a failed save and keeps the previous result', () => {
	const storage = store(); const journal = new JobJournal(storage, 'key'); const id = journal.begin('Publish', ['a']);
	storage.setItem = () => { throw new Error('quota'); }; assert.throws(() => journal.start(id, ['a'], { route: '/api/publish' }), /quota/); assert.equal(journal.jobs[0]!.subjects[0]!.state, 'pending');
	assert.throws(() => new JobJournal({ getItem: () => '{"version":0}', setItem() {} }, 'bad'), /unreadable/);
});
it('stores only operation identity and distinguishes failed, successful and uncertain acknowledgements', () => {
	assert.deepEqual(jobRequest('/api/publish', { apply: true, ids: ['a'], otp: 'secret', messages: { a: 'private text' } }), { ids: ['a'], operation: { route: '/api/publish' } });
	assert.equal(jobRequest('/api/publish', { apply: false, ids: ['a'] }), null);
	assert.equal(jobAcknowledgement({ rows: [{ id: 'a', action: 'publish', reason: 'published a@1.0.0' }] }, 'a').state, 'succeeded');
	assert.equal(jobAcknowledgement({ rows: [{ id: 'a', action: 'publish', reason: 'pack: missing executable' }] }, 'a').state, 'failed');
	assert.equal(jobAcknowledgement({ rows: [] }, 'a').state, 'unknown');
	assert.equal(jobAcknowledgement({ rows: [], writes: true }, 'a').state, 'unknown');
	assert.equal(jobAcknowledgement({ rows: [{ id: 'other', ok: true }] }, 'a').state, 'unknown');
	assert.equal(jobAcknowledgement({ rows: [{ id: 'a', action: 'commit' }], writes: true }, 'a', { route: '/api/commit' }).state, 'succeeded');
	assert.deepEqual(jobRequest('/api/land', { apply: true, siteIds: ['site'], otp: 'secret' })?.ids, ['site']);
	assert.equal(jobAcknowledgement({ results: [{ siteId: 'site', ok: false, steps: [{ ok: false, reason: 'ship failed' }] }], writes: true }, 'site').state, 'failed');
});
