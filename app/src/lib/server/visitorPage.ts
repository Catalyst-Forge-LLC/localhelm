import { asPluginBoards, loadPlugins } from '../../../../src/lib/index.js';
import { visitorPageHost } from '../../../../src/lib/loopback.js';
import { visitorSnapshotFromBoards } from '../../../../src/lib/visitorMachine.js';
import type { VisitorSnapshot } from '../../../../src/lib/visitorTiles.js';
import { loadOptional } from './helm';

const empty: VisitorSnapshot = { hostname: '', addresses: [], tiles: [] };

export async function loadVisitorSnapshot(): Promise<VisitorSnapshot> {
	const loaded = await loadOptional();
	if (!loaded) return empty;
	const plugins = await loadPlugins(loaded);
	const boards = (
		await Promise.all(plugins.map(async (plug) => asPluginBoards(await plug.plugin.board())))
	).flat();
	const helmPort = Number(process.env.LOCALHELM_PORT);
	return visitorSnapshotFromBoards(boards, {
		helmPort: Number.isInteger(helmPort) ? helmPort : undefined,
	});
}

export async function loadVisitorPage(hostHeader: string | null): Promise<{
	pageHost: string | null;
	visitor: VisitorSnapshot;
}> {
	try {
		return {
			pageHost: visitorPageHost(hostHeader),
			visitor: await loadVisitorSnapshot(),
		};
	} catch {
		return { pageHost: visitorPageHost(hostHeader), visitor: empty };
	}
}
