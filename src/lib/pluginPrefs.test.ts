import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { isPluginEnabled, pluginPrefsPath, readPluginPrefs, setPluginEnabled } from './pluginPrefs.js';

describe('pluginPrefs', () => {
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
