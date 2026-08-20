import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { applyBump, planBump } from './bump.js';
import { planExport } from './export.js';
import type { LoadedManifest } from './manifest.js';

describe('bump and export', () => {
	it('replaces only the version field', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-bump-'));
		const pkgDir = path.join(root, 'widget');
		await mkdir(pkgDir);
		await writeFile(
			path.join(pkgDir, 'package.json'),
			'{\n  "name": "widget",\n  "version": "0.1.8",\n  "license": "Apache-2.0"\n}\n',
		);
		const loaded: LoadedManifest = {
			manifestPath: path.join(root, 'localhelm.fleet.json'),
			workspaceRoot: root,
			manifest: { workspaceRoot: '.', projects: [{ id: 'widget', path: 'widget', npm: 'widget' }] },
		};
		const plan = await planBump(loaded, 'widget', 'patch');
		assert.equal(plan.action, 'bump');
		assert.equal(plan.from, '0.1.8');
		assert.equal(plan.to, '0.1.9');
		await applyBump(plan);
		const text = await readFile(path.join(pkgDir, 'package.json'), 'utf8');
		assert.match(text, /"version": "0.1.9"/);
		assert.match(text, /"license": "Apache-2.0"/);
	});

	it('plans an export path', () => {
		const plan = planExport('Z:/workspace');
		assert.equal(plan.file, 'Z:/workspace/localhelm.status.json');
		assert.equal(plan.action, 'write');
	});
});
