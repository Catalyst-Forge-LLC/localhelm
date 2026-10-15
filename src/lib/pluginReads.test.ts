import assert from 'node:assert/strict';
import { it } from 'node:test';
import { PluginReads } from './pluginReads.js';
const snapshot = (id: string, value: string) => ({ plugins: [{ id, label: id, source: `/plugins/${id}.mjs`, enabled: true }], boards: [{ plugin: id, title: id, columns: [], rows: [{ id: value, cells: {} }] }], faults: [] });
it('preserves independent scoped reads and faults while rejecting stale success and failure', () => {
	const state = new PluginReads(); const a = state.begin('a'); const b = state.begin('b');
	state.apply(b, snapshot('b', 'b1')); state.apply(a, snapshot('a', 'a1')); assert.equal(state.boards.length, 2);
	const full = state.begin(); const newer = state.begin('a'); state.apply(newer, snapshot('a', 'a2'));
	state.apply(full, { plugins: [...snapshot('a', '').plugins, ...snapshot('b', '').plugins], boards: [...snapshot('a', 'old').boards, ...snapshot('b', 'b2').boards] });
	state.fail(full, 'old full failed'); assert.equal(state.boards.find((b) => b.plugin === 'a')?.rows[0]?.id, 'a2'); assert(!state.states.a?.error);
	const failed = state.begin('a'); state.fail(failed, 'a down'); const refreshB = state.begin('b'); state.apply(refreshB, snapshot('b', 'b3'));
	assert.equal(state.states.a?.error, 'a down'); assert.equal(state.boards.find((b) => b.plugin === 'a')?.rows[0]?.id, 'a2');
});
it('rejects old-board results and changes toggle visibility only after server acknowledgement', () => {
	const state = new PluginReads(); const old = state.begin(); state.reset(); state.apply(old, snapshot('a', 'old')); state.fail(old, 'old error'); assert.equal(state.boards.length, 0); assert.equal(state.faults.length, 0);
	const read = state.begin('a'); state.apply(read, snapshot('a', 'live')); const toggle = state.begin('a'); assert.equal(state.plugins[0]?.enabled, true);
	state.apply(toggle, { ...snapshot('a', ''), plugins: [{ id: 'a', label: 'a', enabled: false }], boards: [] }); assert.equal(state.plugins[0]?.enabled, false); assert.equal(state.boards.length, 0);
});
