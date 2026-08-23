import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import type { LoadedManifest } from './manifest.js';
import { asPluginBoards, loadPluginFile, loadPlugins } from './plugin.js';
import { pluginPlanWriteIds } from './pluginPlan.js';

describe('plugins', () => {
	it('loads a generic plugin from an enrolled project', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'localhelm-plug-'));
		const proj = path.join(root, 'engine');
		await mkdir(proj);
		const file = path.join(proj, 'localhelm.plugin.mjs');
		await writeFile(
			file,
			`export default {
  id: 'demo',
  label: 'Demo sites',
  async board() {
    return { plugin: 'demo', title: 'Demo', columns: [{ id: 'name', label: 'name' }], rows: [] };
  }
};
`,
		);
		const loaded: LoadedManifest = {
			manifestPath: path.join(root, 'localhelm.fleet.json'),
			workspaceRoot: root,
			manifest: { workspaceRoot: '.', projects: [{ id: 'engine', path: 'engine' }] },
		};
		const plugins = await loadPlugins(loaded);
		assert.equal(plugins.length, 1);
		assert.equal(plugins[0]?.id, 'demo');
		const board = await plugins[0]!.plugin.board();
		assert.equal(board.title, 'Demo');
		assert.equal(asPluginBoards(board).length, 1);
		assert.equal((await loadPluginFile(file)).id, 'demo');
	});

	it('reads write ids from a plugin plan and ignores already-current rows', () => {
		assert.deepEqual(
			pluginPlanWriteIds({
				action: 'sync',
				rows: [
					{ id: 'aibreze', writes: false, update: 'already ^0.1.8' },
					{ id: 'ember-dossier', writes: true, update: 'pnpm update getfilepress' },
				],
			}),
			['ember-dossier'],
		);
		assert.deepEqual(pluginPlanWriteIds({ action: 'sync', rows: [{ id: 'a', writes: false }] }), []);
		assert.equal(pluginPlanWriteIds({ note: 'old shape, no writes flags' }), null);
	});
});
