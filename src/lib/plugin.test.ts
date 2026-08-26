import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import type { LoadedManifest } from './manifest.js';
import { asPluginBoards, loadPluginFile, loadPlugins } from './plugin.js';
import { formatPluginPlanLines, pluginPlanWriteIds } from './pluginPlan.js';

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

	it('prints PORT and HOST on a start recipe line', () => {
		assert.deepEqual(
			formatPluginPlanLines({
				rows: [
					{
						id: 'dictawhisper',
						recipe: 'pnpm serve',
						port: 7777,
						host: '127.0.0.1',
						proposedCwd: 'Z:/workspace/dictawhisper',
					},
					{ id: 'up', action: 'skip', reason: 'already listening (pid 9)' },
				],
			}),
			[
				'dictawhisper  pnpm serve  PORT=7777 HOST=127.0.0.1  in Z:/workspace/dictawhisper',
				'up  —  already listening (pid 9)',
			],
		);
	});

	it('does not print a start recipe on stop', () => {
		assert.deepEqual(
			formatPluginPlanLines({
				rows: [
					{
						id: 'aibreze-site',
						action: 'stop',
						writes: true,
						recipe: 'pnpm site:dev',
						port: 5181,
						host: '127.0.0.1',
						reason: 'stop pid 48376',
					},
				],
			}),
			['aibreze-site  stop pid 48376'],
		);
	});

	it('does not leak FilePress engine update onto ship or push lines', () => {
		assert.deepEqual(
			formatPluginPlanLines({
				action: 'ship',
				rows: [
					{
						id: 'localberth',
						action: 'ship',
						writes: true,
						update: 'pnpm update getfilepress  (0.1.10 → 0.1.11)',
						headers: { action: 'ok' },
						ship: 'pnpm ship in sites/localberth',
					},
				],
			}),
			['localberth  pnpm ship in sites/localberth'],
		);
		assert.deepEqual(
			formatPluginPlanLines({
				action: 'push',
				rows: [
					{
						id: 'localberth',
						action: 'push',
						writes: true,
						update: 'pnpm update getfilepress  (0.1.10 → 0.1.11)',
						reason: '2 on main → https://github.com/example/localberth.git',
					},
				],
			}),
			['localberth  push  2 on main → https://github.com/example/localberth.git'],
		);
		assert.deepEqual(
			formatPluginPlanLines({
				action: 'sync',
				rows: [
					{
						id: 'localberth',
						action: 'sync',
						writes: true,
						update: 'pnpm update getfilepress  (0.1.10 → 0.1.11)',
						ship: 'skipped',
					},
				],
			}),
			['localberth  sync  pnpm update getfilepress  (0.1.10 → 0.1.11)'],
		);
	});
});
