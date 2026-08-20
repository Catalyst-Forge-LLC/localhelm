import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { applyCascade, planCascade } from './cascade.js';
import { helmRetargetMessage } from './commit.js';
import { runGit } from './git.js';
import type { LoadedManifest } from './manifest.js';
import { retargetSpecifier } from './pinwrite.js';
import { fleetReady } from './ready.js';
import { caretRange } from './semver.js';
import type { FleetInventory } from './types.js';

function gitInit(dir: string): void {
	assert.equal(runGit(dir, ['init']).ok, true);
	assert.equal(runGit(dir, ['config', 'user.email', 'localhelm@test']).ok, true);
	assert.equal(runGit(dir, ['config', 'user.name', 'LocalHelm Test']).ok, true);
}

describe('cascade helpers', () => {
	it('rewrites only the named specifier', () => {
		const raw = '{\n  "name": "site",\n  "dependencies": {\n    "getfilepress": "^0.1.8",\n    "svelte": "^5.0.0"\n  }\n}\n';
		const next = retargetSpecifier(raw, 'getfilepress', '^0.1.9');
		assert.match(next, /"getfilepress": "\^0.1.9"/);
		assert.match(next, /"svelte": "\^5.0.0"/);
		assert.match(next, /"name": "site"/);
	});

	it('builds a caret range', () => {
		assert.equal(caretRange('0.1.9'), '^0.1.9');
		assert.equal(caretRange('v1.2.3'), '^1.2.3');
	});

	it('names the commit the way the brief locked', () => {
		assert.equal(helmRetargetMessage('getfilepress', '0.1.9'), 'Helm: retarget getfilepress to 0.1.9.');
	});
});

describe('ready', () => {
	it('lists only unpublished-ahead clean public packages', () => {
		const inventory: FleetInventory = {
			workspaceRoot: 'Z:/workspace',
			manifestPath: 'Z:/workspace/localhelm.fleet.json',
			digest: { projects: 3, dirty: 1, unpublishedAhead: 2, cascadeBehind: 0, missing: 0, npmErrors: 0 },
			projects: [
				{
					id: 'clean-ahead',
					path: 'clean-ahead',
					absPath: 'Z:/workspace/clean-ahead',
					missing: false,
					localVersion: '0.2.6',
					private: false,
					unpublishedAhead: true,
					cascadeBehind: 0,
					npm: { name: 'clean-ahead', latest: '0.2.5', status: 'ok' },
					git: { repo: true, dirty: false, staged: 0, unstaged: 0, untracked: 0, ahead: 0, behind: 0 },
					pins: [],
				},
				{
					id: 'dirty-ahead',
					path: 'dirty-ahead',
					absPath: 'Z:/workspace/dirty-ahead',
					missing: false,
					localVersion: '0.1.9',
					private: false,
					unpublishedAhead: true,
					cascadeBehind: 0,
					npm: { name: 'dirty-ahead', latest: '0.1.8', status: 'ok' },
					git: { repo: true, dirty: true, staged: 0, unstaged: 1, untracked: 0, ahead: 0, behind: 0 },
					pins: [],
				},
				{
					id: 'current',
					path: 'current',
					absPath: 'Z:/workspace/current',
					missing: false,
					localVersion: '0.6.6',
					private: false,
					unpublishedAhead: false,
					cascadeBehind: 0,
					npm: { name: 'current', latest: '0.6.6', status: 'ok' },
					git: { repo: true, dirty: false, staged: 0, unstaged: 0, untracked: 0, ahead: 0, behind: 0 },
					pins: [],
				},
			],
		};
		const view = fleetReady(inventory);
		assert.deepEqual(view.eligible.map((r) => r.id), ['clean-ahead']);
		assert.equal(view.rows.find((r) => r.id === 'dirty-ahead')?.reason, 'dirty');
		assert.equal(view.rows.find((r) => r.id === 'current')?.reason, 'local is not ahead of npm');
	});
});

describe('cascade plan/apply', () => {
	it('skips dirty and link pins, retargets a clean registry pin, does not bump the consumer', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-cascade-'));
		const pub = path.join(root, 'press');
		const clean = path.join(root, 'site-clean');
		const dirty = path.join(root, 'site-dirty');
		const linked = path.join(root, 'site-link');
		for (const dir of [pub, clean, dirty, linked]) await mkdir(dir);

		await writeFile(path.join(pub, 'package.json'), '{\n  "name": "get-widget",\n  "version": "0.1.9"\n}\n');
		await writeFile(
			path.join(clean, 'package.json'),
			'{\n  "name": "site-clean",\n  "version": "1.0.0",\n  "dependencies": {\n    "get-widget": "^0.1.8"\n  }\n}\n',
		);
		await writeFile(
			path.join(dirty, 'package.json'),
			'{\n  "name": "site-dirty",\n  "version": "1.0.0",\n  "dependencies": {\n    "get-widget": "^0.1.8"\n  }\n}\n',
		);
		await writeFile(
			path.join(linked, 'package.json'),
			'{\n  "name": "site-link",\n  "version": "1.0.0",\n  "dependencies": {\n    "get-widget": "link:../press"\n  }\n}\n',
		);

		gitInit(clean);
		assert.equal(runGit(clean, ['add', 'package.json']).ok, true);
		assert.equal(runGit(clean, ['commit', '-m', 'init']).ok, true);
		gitInit(dirty);
		assert.equal(runGit(dirty, ['add', 'package.json']).ok, true);
		assert.equal(runGit(dirty, ['commit', '-m', 'init']).ok, true);
		await writeFile(path.join(dirty, 'scratch.txt'), 'nope\n');
		gitInit(linked);
		assert.equal(runGit(linked, ['add', 'package.json']).ok, true);
		assert.equal(runGit(linked, ['commit', '-m', 'init']).ok, true);
		gitInit(pub);
		assert.equal(runGit(pub, ['add', 'package.json']).ok, true);
		assert.equal(runGit(pub, ['commit', '-m', 'init']).ok, true);

		const loaded: LoadedManifest = {
			manifestPath: path.join(root, 'localhelm.fleet.json'),
			workspaceRoot: root,
			manifest: {
				workspaceRoot: '.',
				projects: [
					{ id: 'press', path: 'press', npm: 'get-widget' },
					{ id: 'site-clean', path: 'site-clean' },
					{ id: 'site-dirty', path: 'site-dirty' },
					{ id: 'site-link', path: 'site-link' },
				],
			},
		};

		const plan = await planCascade(loaded, 'press', {
			to: '0.2.0',
			commit: false,
			confirmTo: async () => true,
		});
		assert.equal(plan.to, '0.2.0');
		assert.match(plan.note, /does not publish those dependents/);
		const byId = Object.fromEntries(plan.rows.map((row) => [row.fromId, row]));
		assert.equal(byId['site-clean']?.action, 'retarget');
		assert.equal(byId['site-clean']?.toSpec, '^0.2.0');
		assert.equal(byId['site-dirty']?.action, 'skip');
		assert.equal(byId['site-dirty']?.reason, 'dirty');
		assert.equal(byId['site-link']?.action, 'skip');
		assert.match(byId['site-link']?.reason ?? '', /local link/);

		const applied = await applyCascade({ ...plan, commit: false });
		assert.equal(applied.writes, true);
		const { readFile } = await import('node:fs/promises');
		const cleanPkg = await readFile(path.join(clean, 'package.json'), 'utf8');
		assert.match(cleanPkg, /"get-widget": "\^0.2.0"/);
		assert.match(cleanPkg, /"version": "1.0.0"/);
		const dirtyPkg = await readFile(path.join(dirty, 'package.json'), 'utf8');
		assert.match(dirtyPkg, /"get-widget": "\^0.1.8"/);
		const linkPkg = await readFile(path.join(linked, 'package.json'), 'utf8');
		assert.match(linkPkg, /"get-widget": "link:\.\.\/press"/);
	});
});
