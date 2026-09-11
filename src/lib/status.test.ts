import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import type { LoadedManifest } from './manifest.js';
import { fleetStatus } from './status.js';

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
		const all = await fleetStatus(loaded);
		assert.equal(all.projects.length, 2);
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
	});
});
