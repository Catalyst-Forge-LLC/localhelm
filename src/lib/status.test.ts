import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import type { LoadedManifest } from './manifest.js';
import { fleetStatus, needsCommitsSinceNpm, statusPhaseLabel } from './status.js';

describe('fleetStatus onlyIds', () => {
	it('reads only the named projects', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-status-'));
		for (const id of ['alpha', 'beta']) {
			const dir = path.join(root, id);
			await mkdir(dir);
			await writeFile(
				path.join(dir, 'package.json'),
				`{\n  "name": "${id}",\n  "version": "0.0.1",\n  "private": true\n}\n`,
			);
		}
		const loaded: LoadedManifest = {
			manifestPath: path.join(root, 'localhelm.fleet.json'),
			workspaceRoot: root,
			manifest: {
				workspaceRoot: '.',
				projects: [
					{ id: 'alpha', path: 'alpha', npm: 'alpha' },
					{ id: 'beta', path: 'beta', npm: 'beta' },
				],
			},
		};
		const phases: string[] = [];
		const all = await fleetStatus(loaded, { onProgress: (progress) => phases.push(progress.phase) });
		assert.equal(all.projects.length, 2);
		assert.ok(phases.includes('packages'));
		assert.ok(phases.includes('git'));
		const one = await fleetStatus(loaded, { onlyIds: ['beta'] });
		assert.deepEqual(
			one.projects.map((row) => row.id),
			['beta'],
		);
		assert.equal(one.digest.projects, 1);
	});

	it('marks scripts.ship on root or site package.json', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-status-ship-'));
		await mkdir(path.join(root, 'forge'));
		await writeFile(
			path.join(root, 'forge', 'package.json'),
			'{\n  "name": "forge",\n  "private": true,\n  "scripts": { "ship": "wrangler pages deploy" }\n}\n',
		);
		await mkdir(path.join(root, 'plain'));
		await writeFile(path.join(root, 'plain', 'package.json'), '{\n  "name": "plain",\n  "private": true\n}\n');
		const loaded: LoadedManifest = {
			manifestPath: path.join(root, 'localhelm.fleet.json'),
			workspaceRoot: root,
			manifest: {
				workspaceRoot: '.',
				projects: [
					{ id: 'forge', path: 'forge' },
					{ id: 'plain', path: 'plain' },
				],
			},
		};
		const inventory = await fleetStatus(loaded);
		assert.deepEqual(inventory.projects.find((row) => row.id === 'forge')?.ship, { dir: 'root' });
		assert.equal(inventory.projects.find((row) => row.id === 'plain')?.ship, undefined);
	});

	it('lists package.json bin names on CLI packages', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-status-bin-'));
		await mkdir(path.join(root, 'cli'));
		await writeFile(
			path.join(root, 'cli', 'package.json'),
			'{\n  "name": "localhelm",\n  "version": "0.1.9",\n  "bin": { "localhelm": "./bin/localhelm.mjs" }\n}\n',
		);
		const inventory = await fleetStatus({
			manifestPath: path.join(root, 'localhelm.fleet.json'),
			workspaceRoot: root,
			manifest: { workspaceRoot: '.', projects: [{ id: 'localhelm', path: 'cli', npm: 'localhelm' }] },
		});
		assert.deepEqual(inventory.projects[0]?.bin, ['localhelm']);
		assert.ok(inventory.projects[0]?.global);
		assert.equal(inventory.projects[0]?.commitsSinceNpm ?? null, null);
	});
});

describe('statusPhaseLabel', () => {
	it('names the current fleet read step', () => {
		assert.equal(statusPhaseLabel('packages', 2, 43), 'reading packages (2 of 43)');
		assert.equal(statusPhaseLabel('npm', 8, 40), 'checking npm (8 of 40)');
		assert.equal(statusPhaseLabel('git', 16, 43), 'reading git (16 of 43)');
		assert.equal(statusPhaseLabel('globals'), 'checking global installs');
	});
});

describe('needsCommitsSinceNpm', () => {
	const git = { repo: true, branch: 'main', dirty: false };

	it('skips private, dirty, unpublished-ahead, and behind npm', () => {
		const row = { privatePkg: false, npmName: 'widget', localVersion: '1.0.0' };
		const npm = { status: 'ok' as const, latest: '1.0.0' };
		assert.equal(needsCommitsSinceNpm({ ...row, privatePkg: true }, npm, false, git), false);
		assert.equal(needsCommitsSinceNpm(row, npm, true, git), false);
		assert.equal(needsCommitsSinceNpm(row, npm, false, { ...git, dirty: true }), false);
		assert.equal(needsCommitsSinceNpm(row, { status: 'ok', latest: '1.1.0' }, false, git), false);
		assert.equal(needsCommitsSinceNpm(row, { status: 'none' }, false, git), false);
	});

	it('counts only when local already matches a published latest', () => {
		assert.equal(
			needsCommitsSinceNpm(
				{ privatePkg: false, npmName: 'widget', localVersion: '1.0.0' },
				{ status: 'ok', latest: '1.0.0' },
				false,
				git,
			),
			true,
		);
	});
});
