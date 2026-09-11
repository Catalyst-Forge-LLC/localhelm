import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { resolveDashboard } from './serve.js';

describe('resolveDashboard', () => {
	it('prefers a checkout app over a leftover built dashboard', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-serve-dev-'));
		await mkdir(path.join(root, 'app'));
		await mkdir(path.join(root, 'dashboard'));
		await writeFile(path.join(root, 'app', 'package.json'), '{"name":"app"}\n');
		await writeFile(path.join(root, 'dashboard', 'index.js'), 'export {};\n');
		assert.deepEqual(resolveDashboard(root), { mode: 'dev', appDir: path.join(root, 'app') });
	});

	it('uses the packaged dashboard when app/ is absent', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-serve-pkg-'));
		await mkdir(path.join(root, 'dashboard'));
		const entry = path.join(root, 'dashboard', 'index.js');
		await writeFile(entry, 'export {};\n');
		assert.deepEqual(resolveDashboard(root), { mode: 'built', entry });
	});

	it('names both missing pieces', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-serve-miss-'));
		assert.throws(() => resolveDashboard(root), /no app\/ and no built dashboard/);
	});
});
