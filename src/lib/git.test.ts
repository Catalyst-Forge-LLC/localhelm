import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { planFetch, planPull, readGit, runGit } from './git.js';
import type { LoadedManifest } from './manifest.js';

async function gitRepo(dir: string): Promise<void> {
	assert.equal(runGit(dir, ['init']).ok, true);
	assert.equal(runGit(dir, ['config', 'user.email', 'localhelm@test']).ok, true);
	assert.equal(runGit(dir, ['config', 'user.name', 'LocalHelm Test']).ok, true);
	await writeFile(path.join(dir, 'README.md'), 'hello\n');
	assert.equal(runGit(dir, ['add', 'README.md']).ok, true);
	assert.equal(runGit(dir, ['commit', '-m', 'init']).ok, true);
}

describe('git jobs', () => {
	it('skips fetch and pull without origin', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-git-'));
		const pkgDir = path.join(root, 'widget');
		await mkdir(pkgDir);
		await gitRepo(pkgDir);
		const loaded: LoadedManifest = {
			manifestPath: path.join(root, 'localhelm.fleet.json'),
			workspaceRoot: root,
			manifest: { workspaceRoot: '.', projects: [{ id: 'widget', path: 'widget' }] },
		};
		const fetchRows = await planFetch(loaded);
		assert.equal(fetchRows[0]?.action, 'skip');
		assert.equal(fetchRows[0]?.reason, 'no origin');
		const pullRows = await planPull(loaded);
		assert.equal(pullRows[0]?.action, 'skip');
		assert.equal(pullRows[0]?.reason, 'no origin');
	});

	it('keeps local state when a fetch fails', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-fetchfail-'));
		await gitRepo(root);
		assert.equal(runGit(root, ['remote', 'add', 'origin', path.join(root, 'no-such-remote.git')]).ok, true);
		await writeFile(path.join(root, 'scratch.txt'), 'dirty\n');
		const cell = readGit(root, true);
		assert.equal(cell.repo, true);
		assert.equal(cell.dirty, true);
		assert.ok(cell.branch);
		assert.ok(cell.fetchError);
		assert.equal(cell.error, undefined);
	});
});
