import assert from 'node:assert/strict';
import { appendFile, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { it } from 'node:test';
import { createHash } from 'node:crypto';
import { runGit } from './git.js';
import { defaultPublishRunner, applyPublish, planPublishFromInventory } from './publish.js';
import { readReleaseTarget } from './releaseTarget.js';
import { prepareRelease, runReleaseCommand } from './releasePrepare.js';
import { archiveFiles } from './releaseArchive.js';
import type { FleetInventory, ProjectStatus } from './types.js';

async function fixture(pkg: Record<string, unknown>) {
	const root = await mkdtemp(path.join(tmpdir(), 'helm release & spaces-'));
	await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture-cli', version: '1.0.1', license: 'MIT', ...pkg }));
	await writeFile(path.join(root, 'README.md'), 'Fixture documentation.\r\n');
	await writeFile(path.join(root, '.gitignore'), 'hooks.log\ndist/\n.artifacts/\n');
	for (const args of [['init'], ['config', 'user.email', 'qa@example.invalid'], ['config', 'user.name', 'QA'], ['add', '.'], ['commit', '-m', 'Fixture baseline']]) assert.equal(runGit(root, args).ok, true);
	return root;
}

async function plan(root: string) {
	const release = (await readReleaseTarget(root))!;
	const p: ProjectStatus = { id: 'fixture', path: '.', absPath: root, missing: false, private: false, localVersion: '1.0.1', unpublishedAhead: true, cascadeBehind: 0, pins: [], npm: { name: 'fixture-cli', latest: '1.0.0', status: 'ok' }, git: { repo: true, dirty: false, staged: 0, unstaged: 0, untracked: 0, ahead: 0, behind: 0, branch: 'main' }, release: release.target };
	const inventory: FleetInventory = { workspaceRoot: root, manifestPath: path.join(root, 'localhelm.fleet.json'), projects: [p], digest: { projects: 1, missing: 0, dirty: 0, cascadeBehind: 0, npmErrors: 0, unpublishedAhead: 1 } };
	const loaded = { workspaceRoot: root, manifestPath: inventory.manifestPath, manifest: { workspaceRoot: '.' as const, projects: [{ id: 'fixture', path: '.' }] } };
	return { row: planPublishFromInventory(inventory, ['fixture'], 'patch')[0]!, loaded };
}

it('runs publish lifecycle once, verifies actual tar files, and sends identical bytes to a fake publisher', async () => {
	const root = await fixture({ bin: { fixture: 'dist/cli.js' }, files: ['dist', 'README.md'], scripts: { prepublishOnly: 'node hooks.mjs prepublishOnly', prepack: 'node hooks.mjs prepack', prepare: 'node hooks.mjs prepare', postpack: 'node hooks.mjs postpack', publish: 'node hooks.mjs publish', postpublish: 'node hooks.mjs postpublish' } });
	await writeFile(path.join(root, 'hooks.mjs'), 'import {appendFileSync,mkdirSync,writeFileSync} from "node:fs"; const stage=process.argv[2]; appendFileSync("hooks.log",stage+"\\n"); mkdirSync("dist",{recursive:true});writeFileSync("dist/cli.js","#!/usr/bin/env node\\nconsole.log(1);\\n");');
	assert.equal(runGit(root, ['add', 'hooks.mjs']).ok, true); assert.equal(runGit(root, ['commit', '-m', 'Add fixture hooks']).ok, true);
	const { row, loaded } = await plan(root);
	assert.equal(await readFile(path.join(root, 'hooks.log')).catch(() => null), null, 'Plan executes no scripts');
	let hash = ''; let args: string[] = [];
	const result = await applyPublish(loaded, row, { run: async (_cwd, argv) => { args = argv; hash = createHash('sha256').update(await readFile(argv[1]!)).digest('hex'); await appendFile(path.join(root, 'hooks.log'), 'registry-ack\n'); return { ok: true, stdout: 'published fixture', stderr: '' }; } });
	assert.equal(result.reason, 'published fixture-cli@1.0.1'); assert.equal(hash, result.artifact?.sha256);
	assert.equal(args[0], 'publish'); assert.equal(args.includes('--ignore-scripts'), true);
	assert.deepEqual((await readFile(path.join(root, 'hooks.log'), 'utf8')).trim().split('\n'), ['prepublishOnly', 'prepack', 'prepare', 'postpack', 'registry-ack', 'publish', 'postpublish']);
	assert(result.artifact?.files.includes('dist/cli.js')); assert(!result.artifact?.files.includes('hooks.mjs'));
});

it('blocks missing binaries and build failures before calling the publisher', async () => {
	await assert.rejects(runReleaseCommand(() => ({ ok: false, stdout: '', stderr: "npm error code MODULE_NOT_FOUND\nnpm error Cannot find module 'promise-retry'\nnpm error Require stack: C:/node/node_modules/npm/lib/npm.js" }), '.', ['pack']), /npm installation is incomplete.*promise-retry.*Repair or switch/);
	for (const pkg of [{ bin: { fixture: 'missing.js' } }, { scripts: { prepack: 'node -e "process.exit(7)"' } }]) {
		const root = await fixture(pkg); const { row, loaded } = await plan(root); let calls = 0;
		const result = await applyPublish(loaded, row, { run: () => { calls++; return { ok: true, stdout: '', stderr: '' }; } });
		assert.equal(calls, 0); assert.match(result.reason!, /pack:/);
	}
});

it('accepts a library without a bin and refuses a changed archive before publication', async () => {
	const root = await fixture({}); const { row, loaded } = await plan(root); let calls = 0;
	const result = await applyPublish(loaded, row, { run: () => { calls++; return { ok: true, stdout: '', stderr: '' }; } });
	assert.equal(calls, 1); assert.deepEqual(result.artifact?.executables, []);
	const target = (await readReleaseTarget(root))!.target;
	const prepared = await prepareRelease(root, target, 'fixture-cli', '1.0.1', defaultPublishRunner);
	const files = archiveFiles(await readFile(prepared.artifact.archive)); assert(files.get('README.md')!.equals(await readFile(path.join(root, 'README.md'))));
	await writeFile(prepared.artifact.archive, 'changed');
	const { assertReleaseArchive } = await import('./releasePrepare.js');
	await assert.rejects(assertReleaseArchive(prepared.artifact), /changed/);
});

it('stops on stale sources and tracked build changes; a postpublish failure stays published', async () => {
	const staleRoot = await fixture({}); const stale = await plan(staleRoot); await writeFile(path.join(staleRoot, 'README.md'), 'Changed');
	assert.match((await applyPublish(stale.loaded, stale.row)).reason!, /source changed/);
	const changedRoot = await fixture({ scripts: { prepack: 'node -e "require(\'node:fs\').writeFileSync(\'README.md\',\'changed\')"' } });
	const changed = await plan(changedRoot); let calls = 0;
	assert.match((await applyPublish(changed.loaded, changed.row, { run: () => { calls++; return { ok: true, stdout: '', stderr: '' }; } })).reason!, /README|sources changed/); assert.equal(calls, 0);
	const warningRoot = await fixture({ scripts: { postpublish: 'node -e "process.exit(4)"' } }); const warning = await plan(warningRoot);
	const result = await applyPublish(warning.loaded, warning.row, { run: () => ({ ok: true, stdout: '', stderr: '' }) });
	assert.equal(result.reason, 'published fixture-cli@1.0.1'); assert.match(result.warning!, /hook failed/);
});

it('builds a generated public CLI from a private harness and verifies its source README', async () => {
	const root = await fixture({ name: 'private-harness', version: '0.0.0-dev', private: true, scripts: { 'release:build': 'node generate.mjs' } });
	await mkdir(path.join(root, 'sources'));
	await writeFile(path.join(root, 'sources/release.json'), JSON.stringify({ metadata: { version: 'untouched' }, name: 'fixture-cli', version: '1.0.1', license: 'MIT', bin: { fixture: 'cli.js' } }));
	await writeFile(path.join(root, 'sources/README.md'), 'Authoritative public documentation.\n');
	await writeFile(path.join(root, 'localhelm.release.json'), JSON.stringify({ version: 1, directory: '.artifacts/npm', manifest: 'sources/release.json', readme: 'sources/README.md', buildScript: 'release:build', kind: 'cli', executables: ['fixture'] }));
	await writeFile(path.join(root, 'generate.mjs'), 'import {mkdirSync,copyFileSync,writeFileSync} from "node:fs";mkdirSync(".artifacts/npm",{recursive:true});copyFileSync("sources/release.json",".artifacts/npm/package.json");copyFileSync("sources/README.md",".artifacts/npm/README.md");writeFileSync(".artifacts/npm/cli.js","#!/usr/bin/env node\\nconsole.log(1);\\n");');
	assert.equal(runGit(root, ['add', '.']).ok, true); assert.equal(runGit(root, ['commit', '-m', 'Generated release fixture']).ok, true);
	const { row, loaded } = await plan(root); let publishedFrom = '';
	assert.equal(row.package?.manifest, path.join(root, 'sources/release.json').replaceAll('\\', '/'));
	const result = await applyPublish(loaded, row, { run: (cwd) => { publishedFrom = cwd; return { ok: true, stdout: '', stderr: '' }; } });
	assert.equal(result.reason, 'published fixture-cli@1.0.1');
	assert.equal(publishedFrom, path.join(root, '.artifacts/npm').replaceAll('\\', '/'));
	assert.equal(JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).private, true);
	assert.deepEqual(result.artifact?.executables, ['fixture']);
	assert(archiveFiles(await readFile(result.artifact!.archive)).get('README.md')!.equals(await readFile(path.join(root, 'sources/README.md'))));
});
