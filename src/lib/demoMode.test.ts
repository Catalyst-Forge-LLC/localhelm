import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
	DEMO_MANIFEST_NAME,
	LIVE_MANIFEST_NAME,
	assertDemoAllowsRepoWrite,
	demoRepoWriteError,
	helmStateDir,
	runWithDemo,
} from './demoMode.js';
import { applyEnroll, planEnroll } from './enroll.js';
import { findManifest } from './manifest.js';

describe('demo mode', () => {
	it('keeps helm state under .localhelm/demo', () => {
		assert.equal(helmStateDir('Z:/workspace').replace(/\\/g, '/'), 'Z:/workspace/.localhelm');
		assert.equal(
			runWithDemo(true, () => helmStateDir('Z:/workspace').replace(/\\/g, '/')),
			'Z:/workspace/.localhelm/demo',
		);
	});

	it('refuses repo writes while demo is on', () => {
		assert.doesNotThrow(() => assertDemoAllowsRepoWrite());
		assert.throws(
			() => runWithDemo(true, () => assertDemoAllowsRepoWrite()),
			(err: unknown) => err instanceof Error && err.message === demoRepoWriteError().message,
		);
	});

	it('opens an empty demo fleet beside the live file and enrolls only the demo file', async () => {
		const ws = await mkdtemp(path.join(tmpdir(), 'localhelm-demo-'));
		const live = path.join(ws, LIVE_MANIFEST_NAME);
		await writeFile(live, `${JSON.stringify({ workspaceRoot: '.', projects: [{ id: 'keep', path: 'keep' }] }, null, 2)}\n`);
		const pkg = path.join(ws, 'widget');
		await mkdir(pkg);
		await writeFile(path.join(pkg, 'package.json'), JSON.stringify({ name: 'widget', version: '0.0.1' }));

		const found = await runWithDemo(true, () => findManifest(ws));
		assert.ok(found);
		assert.equal(found.manifest.projects.length, 0);
		assert.equal(path.basename(found.manifestPath), DEMO_MANIFEST_NAME);
		assert.equal(found.workspaceRoot.replace(/\\/g, '/'), ws.replace(/\\/g, '/'));

		await runWithDemo(true, async () => {
			const plan = await planEnroll({ paths: [pkg], cwd: ws }, found);
			assert.equal(plan.manifestPath.replace(/\\/g, '/'), found.manifestPath.replace(/\\/g, '/'));
			await applyEnroll(plan, found);
		});

		const liveAfter = JSON.parse(await readFile(live, 'utf8')) as { projects: { id: string }[] };
		assert.deepEqual(liveAfter.projects.map((row) => row.id), ['keep']);
		const demoAfter = JSON.parse(await readFile(found.manifestPath, 'utf8')) as { projects: { id: string }[] };
		assert.deepEqual(demoAfter.projects.map((row) => row.id), ['widget']);

		const liveFound = await findManifest(ws);
		assert.equal(liveFound?.manifest.projects[0]?.id, 'keep');
	});
});
