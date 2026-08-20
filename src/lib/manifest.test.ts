import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { applyEnroll, inferManifestPath, planEnroll } from './enroll.js';
import { findManifest } from './manifest.js';
import { readManifestFile, validateManifest } from './manifest.js';
import { scanFolders } from './scan.js';

describe('manifest and enroll', () => {
	it('rejects duplicate ids', () => {
		assert.throws(() =>
			validateManifest(
				{ workspaceRoot: '.', projects: [{ id: 'a', path: 'a' }, { id: 'a', path: 'b' }] },
				'test.json',
			),
		);
	});

	it('findManifest returns quickly when none exists', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-none-'));
		const found = await findManifest(root);
		assert.equal(found, null);
	});

	it('infers manifest at the shared parent of sibling folders', () => {
		const ws = 'Z:/workspace';
		const inferred = inferManifestPath([`${ws}/localhelm`, `${ws}/ollanet`], ws);
		assert.equal(inferred, 'Z:/workspace/localhelm.fleet.json');
	});

	it('plans enroll then writes on apply', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-'));
		const pkgDir = path.join(root, 'widget');
		await mkdir(pkgDir);
		await writeFile(path.join(pkgDir, 'package.json'), JSON.stringify({ name: 'get-widget', version: '0.1.0' }));
		const plan = await planEnroll({ paths: [pkgDir], cwd: root, manifestPath: path.join(root, 'localhelm.fleet.json') }, null);
		assert.equal(plan.rows[0]?.action, 'add');
		assert.equal(plan.rows[0]?.npm, 'get-widget');
		assert.equal(plan.writes, false);
		await applyEnroll(plan, null);
		const loaded = await readManifestFile(plan.manifestPath);
		assert.equal(loaded.manifest.projects.length, 1);
		assert.equal(loaded.manifest.workspaceRoot, '.');
		assert.equal(loaded.manifest.projects[0]?.path, 'widget');
	});

	it('scan honors .localhelmignore', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-ign-'));
		await mkdir(path.join(root, 'keep'));
		await writeFile(path.join(root, 'keep', 'package.json'), JSON.stringify({ name: 'keep', version: '1.0.0' }));
		await mkdir(path.join(root, 'sandbox'));
		await writeFile(path.join(root, 'sandbox', 'package.json'), JSON.stringify({ name: 'sandbox', version: '1.0.0' }));
		await writeFile(path.join(root, '.localhelmignore'), 'sandbox\n# comments\n');
		const rows = await scanFolders({ roots: [root], cwd: root });
		assert.equal(rows.some((r) => r.npmName === 'sandbox'), false);
		assert.equal(rows.some((r) => r.npmName === 'keep'), true);
	});

	it('scan skips node_modules and proposes a package', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-scan-'));
		await mkdir(path.join(root, 'keep'));
		await writeFile(path.join(root, 'keep', 'package.json'), JSON.stringify({ name: 'keep', version: '1.0.0' }));
		await mkdir(path.join(root, 'node_modules', 'keep'), { recursive: true });
		await writeFile(path.join(root, 'node_modules', 'keep', 'package.json'), JSON.stringify({ name: 'nope' }));
		const rows = await scanFolders({ roots: [root], cwd: root });
		assert.equal(rows.some((r) => r.path.includes('node_modules')), false);
		assert.equal(rows.some((r) => r.npmName === 'keep'), true);
	});
});
