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
});
