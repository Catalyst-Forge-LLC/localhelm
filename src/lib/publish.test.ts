import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { helmBumpMessage } from './commit.js';
import { runGit } from './git.js';
import type { LoadedManifest } from './manifest.js';
import { applyPublish, NPM_PUBLISH_AUTH_HINT, planPublishFromInventory, publishLaunchKind, requirePublishIds } from './publish.js';
import type { FleetInventory, ProjectStatus } from './types.js';

function gitRepo(dir: string): void {
	assert.equal(runGit(dir, ['init']).ok, true);
	assert.equal(runGit(dir, ['config', 'user.email', 'localhelm@test']).ok, true);
	assert.equal(runGit(dir, ['config', 'user.name', 'LocalHelm Test']).ok, true);
}

function project(partial: Partial<ProjectStatus> & Pick<ProjectStatus, 'id'>): ProjectStatus {
	return {
		path: partial.path ?? partial.id,
		absPath: partial.absPath ?? `Z:/workspace/${partial.id}`,
		missing: false,
		localVersion: '1.0.0',
		private: false,
		unpublishedAhead: false,
		cascadeBehind: 0,
		npm: { name: partial.id, latest: '1.0.0', status: 'ok' },
		git: { repo: true, dirty: false, staged: 0, unstaged: 0, untracked: 0, ahead: 0, behind: 0, branch: 'main', origin: 'https://example.com/x.git' },
		pins: [],
		...partial,
	};
}

function inventory(projects: ProjectStatus[]): FleetInventory {
	return {
		workspaceRoot: 'Z:/workspace',
		manifestPath: 'Z:/workspace/localhelm.fleet.json',
		digest: { projects: projects.length, dirty: 0, unpublishedAhead: 0, cascadeBehind: 0, missing: 0, npmErrors: 0 },
		projects,
	};
}

describe('publish plan', () => {
	it('requires named ids before apply', () => {
		assert.throws(() => requirePublishIds([]), /name the project id/);
		assert.deepEqual(requirePublishIds([' ollanet ']), ['ollanet']);
	});

	it('tells the operator where the browser login happens', () => {
		assert.match(NPM_PUBLISH_AUTH_HINT, /LocalHelm publish/i);
		assert.match(NPM_PUBLISH_AUTH_HINT, /KeePass/i);
		assert.equal(publishLaunchKind({ stdinTTY: true, stdoutTTY: true, platform: 'win32' }), 'inherit');
		assert.equal(publishLaunchKind({ stdinTTY: false, stdoutTTY: false, platform: 'win32' }), 'windows-console');
		assert.equal(publishLaunchKind({ stdinTTY: false, stdoutTTY: false, platform: 'linux' }), 'need-tty');
	});

	it('names the bump commit the house way', () => {
		assert.equal(helmBumpMessage('ollanet', '0.6.7'), 'Helm: bump ollanet to 0.6.7.');
	});

	it('skips dirty, private, behind-npm, and diverged rows', () => {
		const rows = planPublishFromInventory(
			inventory([
				project({ id: 'dirty', git: { repo: true, dirty: true, staged: 0, unstaged: 1, untracked: 0, ahead: 0, behind: 0 } }),
				project({ id: 'priv', private: true }),
				project({ id: 'behind', localVersion: '1.0.0', unpublishedAhead: false, npm: { name: 'behind', latest: '1.1.0', status: 'ok' } }),
				project({
					id: 'diverged',
					unpublishedAhead: true,
					localVersion: '1.0.1',
					npm: { name: 'diverged', latest: '1.0.0', status: 'ok' },
					git: { repo: true, dirty: false, staged: 0, unstaged: 0, untracked: 0, ahead: 1, behind: 1, branch: 'main', origin: 'https://example.com/x.git' },
				}),
			]),
			undefined,
			'patch',
		);
		assert.equal(rows.find((r) => r.id === 'dirty')?.reason, 'dirty');
		assert.equal(rows.find((r) => r.id === 'priv')?.reason, 'private');
		assert.equal(rows.find((r) => r.id === 'behind')?.reason, 'local is behind npm');
		assert.equal(rows.find((r) => r.id === 'diverged')?.reason, 'diverged');
	});

	it('plans bump+commit+push+publish when local matches npm', () => {
		const [row] = planPublishFromInventory(inventory([project({ id: 'widget' })]), ['widget'], 'patch');
		assert.equal(row?.action, 'publish');
		assert.equal(row?.version, '1.0.1');
		assert.deepEqual(
			row?.steps.map((s) => s.kind),
			['bump', 'commit', 'push', 'publish'],
		);
		assert.match(row?.reason ?? '', /npm publish widget@1\.0\.1/);
	});

	it('plans push+publish when already unpublished-ahead', () => {
		const [row] = planPublishFromInventory(
			inventory([
				project({
					id: 'widget',
					localVersion: '1.0.1',
					unpublishedAhead: true,
					npm: { name: 'widget', latest: '1.0.0', status: 'ok' },
					git: { repo: true, dirty: false, staged: 0, unstaged: 0, untracked: 0, ahead: 2, behind: 0, branch: 'main', origin: 'https://example.com/x.git' },
				}),
			]),
			['widget'],
			'minor',
		);
		assert.equal(row?.action, 'publish');
		assert.equal(row?.version, '1.0.1');
		assert.deepEqual(
			row?.steps.map((s) => s.kind),
			['push', 'publish'],
		);
	});

	it('plans publish only when already ahead of npm and in sync with origin', () => {
		const [row] = planPublishFromInventory(
			inventory([
				project({
					id: 'widget',
					localVersion: '1.0.1',
					unpublishedAhead: true,
					npm: { name: 'widget', latest: '1.0.0', status: 'ok' },
				}),
			]),
			['widget'],
			'patch',
		);
		assert.deepEqual(
			row?.steps.map((s) => s.kind),
			['publish'],
		);
	});
});

describe('publish apply', () => {
	it('bumps, commits, pushes, then calls npm publish without --force', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-pub-'));
		const bare = path.join(root, 'origin.git');
		await mkdir(bare);
		assert.equal(runGit(bare, ['init', '--bare']).ok, true);
		const pkgDir = path.join(root, 'widget');
		await mkdir(pkgDir);
		gitRepo(pkgDir);
		await writeFile(path.join(pkgDir, 'package.json'), '{\n  "name": "widget",\n  "version": "1.0.0"\n}\n');
		assert.equal(runGit(pkgDir, ['add', 'package.json']).ok, true);
		assert.equal(runGit(pkgDir, ['commit', '-m', 'init']).ok, true);
		assert.equal(runGit(pkgDir, ['remote', 'add', 'origin', bare]).ok, true);
		assert.equal(runGit(pkgDir, ['push', '-u', 'origin', 'HEAD']).ok, true);

		const loaded: LoadedManifest = {
			manifestPath: path.join(root, 'localhelm.fleet.json'),
			workspaceRoot: root,
			manifest: { workspaceRoot: '.', projects: [{ id: 'widget', path: 'widget' }] },
		};
		const planned = planPublishFromInventory(
			inventory([
				project({
					id: 'widget',
					path: 'widget',
					absPath: pkgDir,
					localVersion: '1.0.0',
					unpublishedAhead: false,
					npm: { name: 'widget', latest: '1.0.0', status: 'ok' },
					git: {
						repo: true,
						dirty: false,
						staged: 0,
						unstaged: 0,
						untracked: 0,
						ahead: 0,
						behind: 0,
						branch: runGit(pkgDir, ['branch', '--show-current']).stdout.trim(),
						origin: bare,
					},
				}),
			]),
			['widget'],
			'patch',
		);
		assert.equal(planned[0]?.action, 'publish');

		const calls: string[][] = [];
		const applied = await applyPublish(loaded, planned[0]!, {
			run: (_cwd, args) => {
				calls.push(args);
				return { ok: true, stdout: '+ widget@1.0.1', stderr: '' };
			},
		});
		assert.equal(applied.reason, 'published widget@1.0.1');
		assert.equal(calls.length, 1);
		assert.deepEqual(calls[0], ['publish', '--access', 'public']);
		assert.equal(calls[0]?.includes('--force'), false);
		const pkg = await readFile(path.join(pkgDir, 'package.json'), 'utf8');
		assert.match(pkg, /"version": "1.0.1"/);
		assert.equal(runGit(pkgDir, ['status', '--porcelain']).stdout.trim(), '');
		assert.match(runGit(pkgDir, ['log', '-1', '--pretty=%s']).stdout, /Helm: bump widget to 1\.0\.1/);
	});
});
