import { readActivity } from './activity.js';
import { formatBrief, type BriefLease } from './briefFormat.js';
import { asPluginBoards, loadPlugins } from './plugin.js';
import { fleetStatus } from './status.js';
import type { LoadedManifest } from './manifest.js';

export { formatBrief } from './briefFormat.js';
export type { BriefLease, BriefProject } from './briefFormat.js';

export async function buildBrief(loaded: LoadedManifest): Promise<string> {
	const inventory = await fleetStatus(loaded);
	const plugins = await loadPlugins(loaded);
	const leases: BriefLease[] = [];
	for (const plug of plugins) {
		if (plug.id !== 'localberth') continue;
		for (const board of asPluginBoards(await plug.plugin.board())) {
			if (board.tab !== 'ports' || board.title === 'Observed') continue;
			for (const row of board.rows) {
				leases.push({
					id: row.id,
					listening: row.cells.listening === 'yes',
					recipe: row.cells.recipe ?? '—',
					parked: row.cells.parked === 'yes',
				});
			}
		}
	}
	const activity = await readActivity(loaded.workspaceRoot);
	return formatBrief({
		projects: inventory.projects,
		leases,
		activityTitles: activity.map((entry) => entry.title),
	});
}
