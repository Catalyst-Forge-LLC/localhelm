import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import type { LoadedManifest } from './manifest.js';
import { applyPackagePrivacy, planPackagePrivacy } from './packagePrivacy.js';
import { packagePrivacyHint, packagePrivacyLabel } from './packagePrivacyDisplay.js';

async function fixture(raw = '{\r\n\t"name": "privacy-demo",\r\n\t"private": true,\r\n\t"version": "1.0.0",\r\n\t"custom": { "private": true, "text": "a \\\"quoted\\\" {value}" }\r\n}\r\n') {
	const root = await mkdtemp(path.join(tmpdir(), 'localhelm-package-policy-'));
	const dir = path.join(root, 'repo with spaces');
	await mkdir(dir);
	const file = path.join(dir, 'package.json');
	await writeFile(file, raw);
	await writeFile(path.join(dir, 'README.md'), 'Keep this content.');
	const loaded: LoadedManifest = { manifestPath: path.join(root, 'localhelm.fleet.json'), workspaceRoot: root, manifest: { workspaceRoot: '.', projects: [{ id: 'demo', path: 'repo with spaces' }] } };
	return { loaded, file, dir, raw };
}

async function apply(loaded: LoadedManifest) {
	const plan = await planPackagePrivacy(loaded, 'demo');
	assert(plan.file && plan.revision, plan.reason);
	return applyPackagePrivacy(loaded, 'demo', plan.file, plan.revision);
}

describe('npm publishing policy', () => {
	it('plans without writing and shows the actual enrolled package identity and file', async () => {
		const { loaded, file, raw } = await fixture();
		const plan = await planPackagePrivacy(loaded, 'demo');
		assert.equal(plan.action, 'remove');
		assert.equal(plan.name, 'privacy-demo');
		assert.equal(plan.version, '1.0.0');
		assert.equal(plan.from, true);
		assert.match(plan.revision!, /^[a-f0-9]{64}$/);
		assert.equal(await readFile(file, 'utf8'), raw);
		assert.equal((await planPackagePrivacy(loaded, 'unknown')).action, 'skip');
	});

	it('removes only the top-level flag, preserving nested fields, CRLF, spacing, and other files', async () => {
		const { loaded, file, dir, raw } = await fixture();
		assert.equal((await apply(loaded)).writes, true);
		const expected = raw.replace('\t"private": true,\r\n', '');
		assert.equal(await readFile(file, 'utf8'), expected);
		assert.equal(await readFile(path.join(dir, 'README.md'), 'utf8'), 'Keep this content.');
		assert.equal((await apply(loaded)).writes, false);
	});

	it('does not add or edit a flag when publishing is already allowed', async () => {
		for (const raw of ['{ "name":"demo", "nested":{"private":true} }\n', '{"private":false}', '{}', '{\r\n}\r\n']) {
			const { loaded, file } = await fixture(raw);
			assert.equal((await planPackagePrivacy(loaded, 'demo')).action, 'skip');
			assert.equal((await apply(loaded)).writes, false);
			assert.equal(await readFile(file, 'utf8'), raw);
		}
	});

	it('removes first, middle, last, and only properties without leaving invalid commas', async () => {
		for (const raw of ['{"private":true,"name":"demo"}', '{"name":"demo","private":true,"version":"1.0.0"}', '{\r\n  "name": "demo",\r\n  "private": true\r\n}\r\n', '{"private":true}', '{\n  "private": true\n}\n']) {
			const { loaded, file } = await fixture(raw);
			await apply(loaded);
			const expected = JSON.parse(raw);
			delete expected.private;
			assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), expected);
		}
	});

	it('recognizes an escaped top-level private key and ignores private text inside values', async () => {
		const raw = '{"description":"private", "\\u0070rivate":true, "other":{"private":true}}';
		const { loaded, file } = await fixture(raw);
		await apply(loaded);
		assert.equal(await readFile(file, 'utf8'), raw.replace('"\\u0070rivate":true,', ''));
	});

	it('refuses stale contents and changed enrollment paths before writing', async () => {
		const { loaded, file, raw } = await fixture();
		const plan = await planPackagePrivacy(loaded, 'demo');
		await writeFile(file, raw.replace('1.0.0', '1.0.1'));
		await assert.rejects(applyPackagePrivacy(loaded, 'demo', plan.file!, plan.revision!), /package changed/);
		assert((await readFile(file, 'utf8')).includes('1.0.1'));
		await writeFile(file, raw);
		const second = path.join(loaded.workspaceRoot, 'other');
		await mkdir(second);
		await writeFile(path.join(second, 'package.json'), raw);
		loaded.manifest.projects[0]!.path = 'other';
		await assert.rejects(applyPackagePrivacy(loaded, 'demo', plan.file!, plan.revision!), /package changed/);
		assert.equal(await readFile(file, 'utf8'), raw);
		assert.equal(await readFile(path.join(second, 'package.json'), 'utf8'), raw);
	});

	it('rejects malformed, non-object, non-boolean, and duplicate-private manifests', async () => {
		for (const raw of ['{', '[]', 'null', '{"private":"true"}', '{"private":null}', '{"private":true,"private":false}']) {
			const { loaded, file } = await fixture(raw);
			const plan = await planPackagePrivacy(loaded, 'demo');
			assert.equal(plan.action, 'skip');
			assert(plan.reason);
			await assert.rejects(applyPackagePrivacy(loaded, 'demo', file, '0'.repeat(64)), /package changed/);
			assert.equal(await readFile(file, 'utf8'), raw);
		}
	});

	it('refuses a linked package.json and never edits its external target', async () => {
		const { loaded, dir, raw } = await fixture();
		const linked = path.join(loaded.workspaceRoot, 'linked');
		await mkdir(linked);
		await symlink(path.join(dir, 'package.json'), path.join(linked, 'package.json'), 'file');
		loaded.manifest.projects[0]!.path = 'linked';
		const plan = await planPackagePrivacy(loaded, 'demo');
		assert.equal(plan.action, 'skip');
		assert.match(plan.reason!, /regular file|outside the enrolled checkout/);
		assert.equal(await readFile(path.join(dir, 'package.json'), 'utf8'), raw);
	});

	it('explains npm policy separately from GitHub visibility and publication', () => {
		assert.equal(packagePrivacyLabel(), 'Remove private flag');
		assert.match(packagePrivacyHint(), /Removes private: true/);
		assert.match(packagePrivacyHint(), /does not change GitHub repository visibility or publish anything/);
	});
});
