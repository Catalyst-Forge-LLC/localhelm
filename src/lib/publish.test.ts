import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { helmBumpMessage } from './commit.js';
import { runGit } from './git.js';
import type { LoadedManifest } from './manifest.js';
import { publishStepLabel } from './publishDisplay.js';
import { applyPublish, extractNpmAuthUrl, NPM_PUBLISH_AUTH_HINT, planPublishFromInventory, publishAuthHintFor, requirePublishIds } from './publish.js';
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

	it('points publish auth at localhelm auth, not a browser login', () => {
		assert.match(NPM_PUBLISH_AUTH_HINT, /localhelm auth/);
		assert.equal(publishAuthHintFor(null), NPM_PUBLISH_AUTH_HINT);
		assert.equal(publishAuthHintFor(undefined), NPM_PUBLISH_AUTH_HINT);
		assert.equal(publishAuthHintFor('acmegeek'), undefined);
		assert.equal(
			extractNpmAuthUrl('Authenticate at:\nhttps://www.npmjs.com/auth/cli/6547e76d-1a34-40be-92bd-a25953b08062\nPress ENTER'),
			'https://www.npmjs.com/auth/cli/6547e76d-1a34-40be-92bd-a25953b08062',
		);
		assert.equal(extractNpmAuthUrl('no url here'), null);
	});

	it('names the bump commit the house way', () => {
		assert.equal(helmBumpMessage('ollanet', '0.6.7'), 'Helm: bump ollanet to 0.6.7.');
		assert.equal(
			publishStepLabel({ kind: 'bump', from: '1.0.0', to: '1.0.1', bumpKind: 'patch' }),
			'bump 1.0.0 → 1.0.1 (patch)',
		);
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

	it('skips a cut when origin has no commits since the last npm version', () => {
		const [row] = planPublishFromInventory(
			inventory([project({ id: 'widget', commitsSinceNpm: 0 })]),
			['widget'],
			'patch',
		);
		assert.equal(row?.action, 'skip');
		assert.equal(row?.reason, 'nothing to cut');
	});

	it('plans bump+commit+push+publish when local matches npm', () => {
		const [row] = planPublishFromInventory(
			inventory([project({ id: 'widget', commitsSinceNpm: 2 })]),
			['widget'],
			'patch',
		);
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

	it('plans a GitHub Publish link when the checkout has an OIDC workflow', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-pub-gh-'));
		const pkgDir = path.join(root, 'finetuna');
		await mkdir(path.join(pkgDir, '.github', 'workflows'), { recursive: true });
		await writeFile(
			path.join(pkgDir, '.github', 'workflows', 'publish.yml'),
			'on:\n  workflow_dispatch:\npermissions:\n  id-token: write\njobs:\n  p:\n    steps:\n      - run: npm publish --provenance\n',
		);
		const [row] = planPublishFromInventory(
			inventory([
				project({
					id: 'finetuna',
					path: 'finetuna',
					absPath: pkgDir,
					localVersion: '1.1.5',
					unpublishedAhead: true,
					npm: { name: 'finetuna', latest: '1.1.4', status: 'ok' },
					git: {
						repo: true,
						dirty: false,
						staged: 0,
						unstaged: 0,
						untracked: 0,
						ahead: 0,
						behind: 0,
						branch: 'main',
						origin: 'https://github.com/Catalyst-Forge-LLC/finetuna.git',
					},
				}),
			]),
			['finetuna'],
			'patch',
		);
		assert.deepEqual(
			row?.steps.map((s) => s.kind),
			['github'],
		);
		assert.equal(row?.steps[0]?.kind === 'github' && row.steps[0].url, 'https://github.com/Catalyst-Forge-LLC/finetuna/actions/workflows/publish.yml');
	});
});

describe('publish apply', () => {
	it('bumps, commits, pushes, then calls npm publish without --force', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-pub-'));
		const bare = path.join(root, 'origin.git');
		await mkdir(bare);
		assert.equal(runGit(bare, ['init', '--bare']).ok, true);
		const pkgDir = path.join(root, 'widget');
		await mkdir(path.join(pkgDir, 'skills', 'widget'), { recursive: true });
		gitRepo(pkgDir);
		await writeFile(path.join(pkgDir, 'package.json'), '{\n  "name": "widget",\n  "version": "1.0.0"\n}\n');
		await writeFile(
			path.join(pkgDir, 'skills', 'widget', 'SKILL_FACTS.md'),
			'---\nskill_facts_version: "0.1.0"\nversion: "1.0.0"\n---\n\n| **Version** | 1.0.0 |\n',
		);
		assert.equal(runGit(pkgDir, ['add', 'package.json', 'skills/widget/SKILL_FACTS.md']).ok, true);
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
		const events: string[] = [];
		const applied = await applyPublish(loaded, planned[0]!, {
			run: (_cwd, args) => {
				calls.push(args);
				return { ok: true, stdout: '+ widget@1.0.1', stderr: '' };
			},
			onStep: (event) => events.push(`${event.index}:${event.kind}:${event.status}`),
		});
		assert.equal(applied.reason, 'published widget@1.0.1');
		assert.deepEqual(events, [
			'0:bump:start',
			'0:bump:done',
			'1:commit:start',
			'1:commit:done',
			'2:push:start',
			'2:push:done',
			'3:publish:start',
			'3:publish:done',
		]);
		assert.equal(calls.length, 1);
		assert.deepEqual(calls[0], ['publish', '--access', 'public']);
		assert.equal(calls[0]?.includes('--force'), false);
		const pkg = await readFile(path.join(pkgDir, 'package.json'), 'utf8');
		assert.match(pkg, /"version": "1.0.1"/);
		const facts = await readFile(path.join(pkgDir, 'skills', 'widget', 'SKILL_FACTS.md'), 'utf8');
		assert.match(facts, /version: "1\.0\.1"/);
		assert.equal(runGit(pkgDir, ['status', '--porcelain']).stdout.trim(), '');
		assert.match(runGit(pkgDir, ['log', '-1', '--pretty=%s']).stdout, /Helm: bump widget to 1\.0\.1/);
		assert.match(runGit(pkgDir, ['show', '--name-only', '--pretty=format:']).stdout, /SKILL_FACTS\.md/);
	});

	it('keeps a short reason when npm prints env warnings plus a gate', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-pub-fail-'));
		const pkgDir = path.join(root, 'widget');
		await mkdir(pkgDir);
		gitRepo(pkgDir);
		await writeFile(path.join(pkgDir, 'package.json'), '{\n  "name": "widget",\n  "version": "1.0.1"\n}\n');
		assert.equal(runGit(pkgDir, ['add', 'package.json']).ok, true);
		assert.equal(runGit(pkgDir, ['commit', '-m', 'init']).ok, true);

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
					localVersion: '1.0.1',
					unpublishedAhead: true,
					npm: { name: 'widget', latest: '1.0.0', status: 'ok' },
				}),
			]),
			['widget'],
			'patch',
		);
		const stderr = [
			'npm warn Unknown env config "auto-install-peers". This will error in a future major version of npm.',
			'Provenance only works in GitHub Actions (OIDC). A laptop publish fails with: Automatic provenance generation not supported for provider: null.',
		].join('\n');
		const applied = await applyPublish(loaded, planned[0]!, {
			run: () => ({ ok: false, stdout: '', stderr }),
		});
		assert.match(applied.reason ?? '', /Provenance only works in GitHub Actions/);
		assert.equal(applied.reason?.includes('auto-install-peers'), false);
		assert.match(applied.stderr ?? '', /auto-install-peers/);
	});

	it('does not call npm publish when the step is GitHub Actions', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-pub-gh-apply-'));
		const pkgDir = path.join(root, 'finetuna');
		await mkdir(path.join(pkgDir, '.github', 'workflows'), { recursive: true });
		gitRepo(pkgDir);
		await writeFile(path.join(pkgDir, 'package.json'), '{\n  "name": "finetuna",\n  "version": "1.1.5"\n}\n');
		await writeFile(
			path.join(pkgDir, '.github', 'workflows', 'publish.yml'),
			'on:\n  workflow_dispatch:\npermissions:\n  id-token: write\njobs:\n  p:\n    steps:\n      - run: npm publish --provenance\n',
		);
		assert.equal(runGit(pkgDir, ['add', 'package.json']).ok, true);
		assert.equal(runGit(pkgDir, ['commit', '-m', 'init']).ok, true);
		const loaded: LoadedManifest = {
			manifestPath: path.join(root, 'localhelm.fleet.json'),
			workspaceRoot: root,
			manifest: { workspaceRoot: '.', projects: [{ id: 'finetuna', path: 'finetuna' }] },
		};
		const planned = planPublishFromInventory(
			inventory([
				project({
					id: 'finetuna',
					path: 'finetuna',
					absPath: pkgDir,
					localVersion: '1.1.5',
					unpublishedAhead: true,
					npm: { name: 'finetuna', latest: '1.1.4', status: 'ok' },
					git: {
						repo: true,
						dirty: false,
						staged: 0,
						unstaged: 0,
						untracked: 0,
						ahead: 0,
						behind: 0,
						branch: 'main',
						origin: 'https://github.com/Catalyst-Forge-LLC/finetuna.git',
					},
				}),
			]),
			['finetuna'],
			'patch',
		);
		assert.equal(planned[0]?.steps.some((step) => step.kind === 'github'), true);
		let ran = 0;
		const applied = await applyPublish(loaded, planned[0]!, {
			run: () => {
				ran += 1;
				return { ok: false, stdout: '', stderr: 'should not run' };
			},
		});
		assert.equal(ran, 0);
		assert.match(applied.reason ?? '', /open GitHub Publish finetuna@1\.1\.5/);
		assert.match(applied.reason ?? '', /actions\/workflows\/publish\.yml/);
	});
});
