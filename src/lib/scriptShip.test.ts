import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import type { LoadedManifest } from './manifest.js';
import { shipScriptTarget } from './pkg.js';
import { applyScriptShip, isShippedReason, planScriptShip, requireShipIds } from './scriptShip.js';

function loaded(root: string, projects: Array<{ id: string; path: string }>): LoadedManifest {
	return {
		manifestPath: path.join(root, 'localhelm.fleet.json'),
		workspaceRoot: root,
		manifest: { workspaceRoot: '.', projects },
	};
}

describe('shipScriptTarget', () => {
	it('prefers root scripts.ship over site', () => {
		assert.deepEqual(
			shipScriptTarget({ scripts: { ship: 'wrangler deploy' } }, { scripts: { ship: 'pnpm ship' } }),
			{ dir: 'root' },
		);
		assert.deepEqual(shipScriptTarget({}, { scripts: { ship: 'wrangler pages deploy' } }), { dir: 'site' });
		assert.equal(shipScriptTarget({ scripts: { build: 'vite build' } }, undefined), undefined);
		assert.equal(shipScriptTarget({ scripts: { ship: '   ' } }, undefined), undefined);
	});
});

describe('requireShipIds', () => {
	it('refuses an empty apply', () => {
		assert.throws(() => requireShipIds([]), /name the project id/);
		assert.deepEqual(requireShipIds([' x-facts ', 'catalyst-forge']), ['x-facts', 'catalyst-forge']);
	});
});

describe('planScriptShip', () => {
	it('plans root or site ship and skips repos without the script', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-ship-'));
		await mkdir(path.join(root, 'facts'));
		await writeFile(
			path.join(root, 'facts', 'package.json'),
			'{\n  "name": "facts",\n  "private": true,\n  "scripts": { "ship": "wrangler deploy" }\n}\n',
		);
		await mkdir(path.join(root, 'pages', 'site'), { recursive: true });
		await writeFile(path.join(root, 'pages', 'package.json'), '{\n  "name": "pages",\n  "private": true\n}\n');
		await writeFile(
			path.join(root, 'pages', 'site', 'package.json'),
			'{\n  "name": "pages-site",\n  "scripts": { "ship": "wrangler pages deploy" }\n}\n',
		);
		await mkdir(path.join(root, 'lib'));
		await writeFile(path.join(root, 'lib', 'package.json'), '{\n  "name": "lib",\n  "version": "1.0.0"\n}\n');
		const plan = await planScriptShip(
			loaded(root, [
				{ id: 'facts', path: 'facts' },
				{ id: 'pages', path: 'pages' },
				{ id: 'lib', path: 'lib' },
			]),
		);
		assert.equal(plan.find((row) => row.id === 'facts')?.action, 'ship');
		assert.equal(plan.find((row) => row.id === 'facts')?.dir, 'root');
		assert.equal(plan.find((row) => row.id === 'pages')?.dir, 'site');
		assert.deepEqual(plan.find((row) => row.id === 'lib'), {
			id: 'lib',
			path: 'lib',
			action: 'skip',
			reason: 'no scripts.ship',
		});
	});
});

describe('applyScriptShip', () => {
	it('records shipped or the plugin error line', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-ship-apply-'));
		const row = {
			id: 'x-facts',
			path: 'x-facts',
			action: 'ship' as const,
			dir: 'root' as const,
			cwd: root,
		};
		const ok = await applyScriptShip(loaded(root, []), row, async () => ({
			ok: true,
			stdout: 'Uploaded',
			stderr: '',
		}));
		assert.equal(ok.reason, 'shipped (root)');
		assert.equal(isShippedReason(ok.reason), true);
		const fail = await applyScriptShip(loaded(root, []), row, async () => ({
			ok: false,
			stdout: '',
			stderr: '✘ [ERROR] Authentication error [code: 10000]',
		}));
		assert.match(fail.reason ?? '', /Authentication error/);
		assert.equal(isShippedReason(fail.reason), false);
	});
});
