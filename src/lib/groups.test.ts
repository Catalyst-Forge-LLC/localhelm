import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { runWithDemo } from './demoMode.js';
import { matchingGroupIds } from './groupSelect.js';
import { deleteGroup, groupsPath, readGroups, saveGroup } from './groups.js';

describe('matchingGroupIds', () => {
	it('keeps ids that exist on this list', () => {
		assert.deepEqual(matchingGroupIds(['agent-facts', 'missing', 'agent-facts'], ['filepress', 'agent-facts']), [
			'agent-facts',
		]);
	});
});

describe('groups persist', () => {
	it('saves, replaces by name, and deletes', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-groups-'));
		const first = await saveGroup(root, 'xFacts', ['browser-facts', 'agent-facts']);
		assert.deepEqual(first.groups, [{ name: 'xFacts', ids: ['agent-facts', 'browser-facts'] }]);
		assert.equal(groupsPath(root).replace(/\\/g, '/').endsWith('.localhelm/groups.json'), true);
		const replaced = await saveGroup(root, 'xfacts', ['feature-facts']);
		assert.deepEqual(replaced.groups, [{ name: 'xfacts', ids: ['feature-facts'] }]);
		const gone = await deleteGroup(root, 'XFacts');
		assert.deepEqual(gone.groups, []);
		assert.deepEqual((await readGroups(root)).groups, []);
		await rm(root, { recursive: true, force: true });
	});

	it('refuses an empty name or an empty check list', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-groups-'));
		await assert.rejects(() => saveGroup(root, '  ', ['a']), /Name the group/);
		await assert.rejects(() => saveGroup(root, 'xFacts', []), /Check at least one row/);
		await rm(root, { recursive: true, force: true });
	});

	it('reports a broken groups.json instead of replacing it', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-groups-'));
		await mkdir(path.join(root, '.localhelm'), { recursive: true });
		await writeFile(path.join(root, '.localhelm', 'groups.json'), '{', 'utf8');
		await assert.rejects(() => readGroups(root), /not valid JSON/);
		await assert.rejects(() => saveGroup(root, 'xFacts', ['a']), /not valid JSON/);
		await rm(root, { recursive: true, force: true });
	});

	it('writes demo groups under .localhelm/demo', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-groups-'));
		await runWithDemo(true, () => saveGroup(root, 'xFacts', ['agent-facts']));
		assert.equal(groupsPath(root).replace(/\\/g, '/').endsWith('.localhelm/groups.json'), true);
		const demoPath = runWithDemo(true, () => groupsPath(root)).replace(/\\/g, '/');
		assert.equal(demoPath.endsWith('.localhelm/demo/groups.json'), true);
		assert.deepEqual((await runWithDemo(true, () => readGroups(root))).groups[0]?.ids, ['agent-facts']);
		assert.deepEqual((await readGroups(root)).groups, []);
		await rm(root, { recursive: true, force: true });
	});
});
