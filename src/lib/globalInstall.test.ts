import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
	applyGlobalInstall,
	isInstalledGlobalReason,
	parseGlobalVersions,
	planGlobalInstall,
	requireGlobalIds,
} from './globalInstall.js';
import type { LoadedManifest } from './manifest.js';
import { pkgBinNames } from './pkg.js';

function loaded(root: string, projects: Array<{ id: string; path: string; npm?: string }>): LoadedManifest {
	return {
		manifestPath: path.join(root, 'localhelm.fleet.json'),
		workspaceRoot: root,
		manifest: { workspaceRoot: '.', projects },
	};
}

describe('pkgBinNames', () => {
	it('reads a string bin or a map of names', () => {
		assert.deepEqual(pkgBinNames({ name: 'localhelm', bin: './bin/localhelm.mjs' }), ['localhelm']);
		assert.deepEqual(pkgBinNames({ name: '@acme/cli', bin: './cli.js' }), ['cli']);
		assert.deepEqual(pkgBinNames({ bin: { helm: './a', slip: './b' } }), ['helm', 'slip']);
		assert.deepEqual(pkgBinNames({ name: 'lib', version: '1.0.0' }), []);
		assert.deepEqual(pkgBinNames({ bin: '   ' }), []);
	});
});

describe('parseGlobalVersions', () => {
	it('reads pnpm list arrays and npm list objects', () => {
		const pnpm = parseGlobalVersions(
			JSON.stringify([{ dependencies: { localhelm: { version: '0.1.9' } } }]),
		);
		assert.equal(pnpm.get('localhelm'), '0.1.9');
		const npm = parseGlobalVersions(JSON.stringify({ dependencies: { localslip: { version: '1.2.3' } } }));
		assert.equal(npm.get('localslip'), '1.2.3');
		assert.equal(parseGlobalVersions('not-json').size, 0);
	});
});

describe('requireGlobalIds', () => {
	it('refuses an empty apply', () => {
		assert.throws(() => requireGlobalIds([]), /name the project id/);
		assert.deepEqual(requireGlobalIds([' localhelm ', 'localslip']), ['localhelm', 'localslip']);
	});
});

describe('planGlobalInstall', () => {
	it('plans CLIs that are missing or behind and skips the rest', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-global-'));
		await mkdir(path.join(root, 'cli'));
		await writeFile(
			path.join(root, 'cli', 'package.json'),
			'{\n  "name": "localhelm",\n  "version": "0.2.0",\n  "bin": { "localhelm": "./bin/localhelm.mjs" }\n}\n',
		);
		await mkdir(path.join(root, 'lib'));
		await writeFile(path.join(root, 'lib', 'package.json'), '{\n  "name": "lib",\n  "version": "1.0.0"\n}\n');
		await mkdir(path.join(root, 'priv'));
		await writeFile(
			path.join(root, 'priv', 'package.json'),
			'{\n  "name": "priv",\n  "private": true,\n  "bin": { "priv": "./cli.js" }\n}\n',
		);
		const manifest = loaded(root, [
			{ id: 'localhelm', path: 'cli', npm: 'localhelm' },
			{ id: 'lib', path: 'lib' },
			{ id: 'priv', path: 'priv' },
		]);
		const plan = await planGlobalInstall(manifest, undefined, new Map([['localhelm', '0.1.9']]));
		assert.equal(plan.find((row) => row.id === 'localhelm')?.action, 'global');
		assert.match(plan.find((row) => row.id === 'localhelm')?.reason ?? '', /update localhelm@0\.2\.0/);
		assert.deepEqual(plan.find((row) => row.id === 'lib'), {
			id: 'lib',
			path: 'lib',
			npm: 'lib',
			version: '1.0.0',
			action: 'skip',
			reason: 'no bin (not a CLI)',
		});
		assert.equal(plan.find((row) => row.id === 'priv')?.reason, 'private');
		const current = await planGlobalInstall(manifest, ['localhelm'], new Map([['localhelm', '0.2.0']]));
		assert.equal(current[0]?.action, 'skip');
		assert.match(current[0]?.reason ?? '', /already global 0\.2\.0/);
		const pinned = await planGlobalInstall(
			manifest,
			['localhelm'],
			new Map([['localhelm', '0.1.9']]),
			{ localhelm: '0.2.1' },
		);
		assert.equal(pinned[0]?.version, '0.2.1');
		assert.equal(pinned[0]?.action, 'global');
	});
});

describe('applyGlobalInstall', () => {
	it('records installed global or the runner error', async () => {
		const row = {
			id: 'localhelm',
			path: 'localhelm',
			npm: 'localhelm',
			version: '0.2.0',
			action: 'global' as const,
		};
		const ok = await applyGlobalInstall(row, async (name, version) => {
			assert.equal(name, 'localhelm');
			assert.equal(version, '0.2.0');
			return { ok: true, stdout: 'Done', stderr: '' };
		});
		assert.equal(ok.reason, 'installed global localhelm@0.2.0');
		assert.equal(isInstalledGlobalReason(ok.reason), true);
		const fail = await applyGlobalInstall(row, async () => ({
			ok: false,
			stdout: '',
			stderr: '404 Not Found - GET https://registry.npmjs.org/localhelm',
		}));
		assert.equal(fail.action, 'global');
		assert.match(fail.reason ?? '', /404 Not Found/);
		assert.equal(isInstalledGlobalReason(fail.reason), false);
	});
});
