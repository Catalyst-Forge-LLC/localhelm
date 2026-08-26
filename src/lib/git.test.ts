import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { applyPush, countCommitsSinceVersion, planFetch, planPull, planPush, readGit, requirePushIds, runGit } from './git.js';
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
	it('plans fetch for named ids only', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-fetch-ids-'));
		const loaded: LoadedManifest = {
			manifestPath: path.join(root, 'localhelm.fleet.json'),
			workspaceRoot: root,
			manifest: {
				workspaceRoot: '.',
				projects: [
					{ id: 'alpha', path: 'alpha' },
					{ id: 'beta', path: 'beta' },
				],
			},
		};
		const rows = await planFetch(loaded, ['beta']);
		assert.deepEqual(
			rows.map((row) => row.id),
			['beta'],
		);
	});

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
		const pushRows = await planPush(loaded);
		assert.equal(pushRows[0]?.action, 'skip');
		assert.equal(pushRows[0]?.reason, 'no origin');
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

	it('requires named ids before apply', () => {
		assert.throws(() => requirePushIds([]), /name the project id/);
		assert.deepEqual(requirePushIds([' localhelm ', 'filepress']), ['localhelm', 'filepress']);
	});

	it('skips not-ahead and unknown ids; pushes ahead commits even when the tree is dirty', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-push-'));
		const bare = path.join(root, 'origin.git');
		await mkdir(bare);
		assert.equal(runGit(bare, ['init', '--bare']).ok, true);
		const pkgDir = path.join(root, 'widget');
		await mkdir(pkgDir);
		await gitRepo(pkgDir);
		assert.equal(runGit(pkgDir, ['remote', 'add', 'origin', bare]).ok, true);
		assert.equal(runGit(pkgDir, ['push', '-u', 'origin', 'HEAD']).ok, true);

		const loaded: LoadedManifest = {
			manifestPath: path.join(root, 'localhelm.fleet.json'),
			workspaceRoot: root,
			manifest: { workspaceRoot: '.', projects: [{ id: 'widget', path: 'widget' }] },
		};
		assert.equal((await planPush(loaded))[0]?.reason, 'not ahead');

		await writeFile(path.join(pkgDir, 'README.md'), 'hello\nmore\n');
		assert.equal((await planPush(loaded))[0]?.reason, 'not ahead');

		assert.equal(runGit(pkgDir, ['add', 'README.md']).ok, true);
		assert.equal(runGit(pkgDir, ['commit', '-m', 'ahead']).ok, true);
		await writeFile(path.join(pkgDir, 'scratch.txt'), 'still dirty\n');
		const planned = await planPush(loaded, ['widget']);
		assert.equal(planned[0]?.action, 'push');
		assert.match(planned[0]?.reason ?? '', /on /);
		assert.match(planned[0]?.reason ?? '', /uncommitted files stay local/);
		assert.equal(planned[0]?.remote, 'origin');

		const unknown = await planPush(loaded, ['nope']);
		assert.equal(unknown[0]?.reason, 'not enrolled');

		const applied = applyPush(root, planned[0]!);
		assert.equal(applied.reason, 'pushed');
		assert.equal((await planPush(loaded))[0]?.reason, 'not ahead');
	});

	it('counts origin commits after the last package.json version bump', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-since-npm-'));
		const bare = path.join(root, 'origin.git');
		await mkdir(bare);
		assert.equal(runGit(bare, ['init', '--bare']).ok, true);
		const pkgDir = path.join(root, 'widget');
		await mkdir(pkgDir);
		assert.equal(runGit(pkgDir, ['init']).ok, true);
		assert.equal(runGit(pkgDir, ['config', 'user.email', 'localhelm@test']).ok, true);
		assert.equal(runGit(pkgDir, ['config', 'user.name', 'LocalHelm Test']).ok, true);
		await writeFile(path.join(pkgDir, 'package.json'), '{\n  "name": "widget",\n  "version": "1.0.0"\n}\n');
		assert.equal(runGit(pkgDir, ['add', 'package.json']).ok, true);
		assert.equal(runGit(pkgDir, ['commit', '-m', 'v1.0.0']).ok, true);
		assert.equal(runGit(pkgDir, ['remote', 'add', 'origin', bare]).ok, true);
		assert.equal(runGit(pkgDir, ['push', '-u', 'origin', 'HEAD']).ok, true);
		const branch = runGit(pkgDir, ['branch', '--show-current']).stdout.trim();
		assert.equal(countCommitsSinceVersion(pkgDir, '1.0.0', branch), 0);

		await writeFile(path.join(pkgDir, 'note.txt'), 'work\n');
		assert.equal(runGit(pkgDir, ['add', 'note.txt']).ok, true);
		assert.equal(runGit(pkgDir, ['commit', '-m', 'work']).ok, true);
		assert.equal(countCommitsSinceVersion(pkgDir, '1.0.0', branch), 0);
		assert.equal(runGit(pkgDir, ['push']).ok, true);
		assert.equal(countCommitsSinceVersion(pkgDir, '1.0.0', branch), 1);
	});
});
