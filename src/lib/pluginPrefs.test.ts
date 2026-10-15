import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { isPluginEnabled, pluginPrefsPath, readPluginPrefs, setPluginEnabled } from './pluginPrefs.js';

describe('pluginPrefs', () => {
	it('reports unreadable preferences without silently enabling or overwriting companions', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-plugprefs-broken-'));
		await setPluginEnabled(root, 'alpha', false); await writeFile(pluginPrefsPath(root), '{broken');
		await assert.rejects(readPluginPrefs(root), /unreadable/); await assert.rejects(setPluginEnabled(root, 'beta', false), /unreadable/);
		assert.equal(await readFile(pluginPrefsPath(root), 'utf8'), '{broken');
	});
	it('preserves independent concurrent companion toggles', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-plugprefs-concurrent-'));
		await Promise.all([setPluginEnabled(root, 'alpha', false), setPluginEnabled(root, 'beta', false)]);
		assert.deepEqual((await readPluginPrefs(root)).disabled, ['alpha', 'beta']);
	});
	it('defaults every plugin on and persists an off switch', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-plugprefs-'));
		const empty = await readPluginPrefs(root);
		assert.deepEqual(empty.disabled, []);
		assert.equal(isPluginEnabled('xfacts', empty), true);
		const off = await setPluginEnabled(root, 'xfacts', false);
		assert.deepEqual(off.disabled, ['xfacts']);
		assert.equal(isPluginEnabled('xfacts', off), false);
		assert.equal(isPluginEnabled('filepress', off), true);
		assert.equal(pluginPrefsPath(root).replace(/\\/g, '/').endsWith('.localhelm/plugins.json'), true);
		const on = await setPluginEnabled(root, 'xfacts', true);
		assert.deepEqual(on.disabled, []);
		assert.deepEqual((await readPluginPrefs(root)).disabled, []);
		await rm(root, { recursive: true, force: true });
	});
});
