import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { it } from 'node:test';
import { readReleaseTarget } from './releaseTarget.js';
import { planBump, applyBump } from './bump.js';
import { planPackagePrivacy, applyPackagePrivacy } from './packagePrivacy.js';

it('resolves a private harness to its public generated manifest and bumps that source only', async () => {
	const root = await mkdtemp(path.join(tmpdir(), 'helm-generated-'));
	await mkdir(path.join(root, 'packages/cli'), { recursive: true });
	await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'harness', private: true, version: '0.0.0-dev', scripts: { 'package:build': 'node build.mjs' } }));
	await writeFile(path.join(root, 'packages/cli/release.json'), JSON.stringify({ name: 'public-cli', version: '1.0.0', private: true, bin: { public: 'bin/public.js' } }));
	await writeFile(path.join(root, 'packages/cli/README.md'), 'Public CLI\n');
	await writeFile(path.join(root, 'localhelm.release.json'), JSON.stringify({ version: 1, directory: '.artifacts/package', manifest: 'packages/cli/release.json', readme: 'packages/cli/README.md', buildScript: 'package:build', kind: 'cli' }));
	const release = (await readReleaseTarget(root))!;
	assert.equal(release.pkg.name, 'public-cli'); assert.equal(release.pkg.version, '1.0.0');
	assert.equal(release.target.directory.replaceAll('\\', '/'), path.join(root, '.artifacts/package').replaceAll('\\', '/'));
	assert.deepEqual(release.target.executables, ['public']);
	const loaded = { workspaceRoot: root, manifestPath: path.join(root, 'localhelm.fleet.json'), manifest: { workspaceRoot: '.' as const, projects: [{ id: 'cli', path: '.' }] } };
	const bump = await planBump(loaded, 'cli', 'minor'); assert.equal(bump.from, '1.0.0');
	await applyBump(bump); assert.equal(JSON.parse(await readFile(release.target.manifest, 'utf8')).version, '1.1.0');
	assert.equal(JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version, '0.0.0-dev');
	const privacy = await planPackagePrivacy(loaded, 'cli'); assert.equal(privacy.file, release.target.manifest);
	await applyPackagePrivacy(loaded, 'cli', privacy.file!, privacy.revision!);
	assert.equal(JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).private, true);
	assert.equal(JSON.parse(await readFile(release.target.manifest, 'utf8')).private, undefined);
});

it('rejects malformed contracts, escaping paths and symlink escapes without falling back to the harness', async () => {
	const root = await mkdtemp(path.join(tmpdir(), 'helm-target-path-')); const outside = await mkdtemp(path.join(tmpdir(), 'helm-target-outside-'));
	await writeFile(path.join(root, 'package.json'), '{"name":"harness","private":true,"version":"1.0.0"}');
	for (const config of [{ version: 1, manifest: '../outside.json' }, { version: 1, manifest: '.git/metadata.json' }, { version: 1, manifest: '.GIT/metadata.json' }, { version: 1, output: 'typo' }, { version: 1, kind: 'cli' }]) {
		await writeFile(path.join(root, 'localhelm.release.json'), JSON.stringify(config));
		await assert.rejects(readReleaseTarget(root));
	}
	await symlink(outside, path.join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
	await writeFile(path.join(root, 'localhelm.release.json'), JSON.stringify({ version: 1, directory: 'linked/output', manifest: 'package.json' }));
	await assert.rejects(readReleaseTarget(root), /outside/);
});
