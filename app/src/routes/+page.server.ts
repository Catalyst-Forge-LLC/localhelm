import type { PageServerLoad } from './$types';
import { asPluginBoards, loadPlugins } from '../../../src/lib/index.js';
import { isOperatorFace, visitorPageHost } from '../../../src/lib/loopback.js';
import { visitorSnapshotFromBoards } from '../../../src/lib/visitorMachine.js';
import { loadOptional } from '$lib/server/helm';

export const load: PageServerLoad = async ({ getClientAddress, request }) => {
	const host = request.headers.get('host');
	const operator = isOperatorFace(getClientAddress(), host);
	if (operator) return { face: 'operator' as const };
	try {
		const loaded = await loadOptional();
		if (!loaded) {
			return {
				face: 'visitor' as const,
				pageHost: visitorPageHost(host),
				visitor: { hostname: '', addresses: [], tiles: [] },
			};
		}
		const plugins = await loadPlugins(loaded);
		const boards = [];
		for (const plug of plugins) {
			boards.push(...asPluginBoards(await plug.plugin.board()));
		}
		const helmPort = Number(process.env.LOCALHELM_PORT);
		return {
			face: 'visitor' as const,
			pageHost: visitorPageHost(host),
			visitor: visitorSnapshotFromBoards(boards, {
				helmPort: Number.isInteger(helmPort) ? helmPort : undefined,
			}),
		};
	} catch {
		return {
			face: 'visitor' as const,
			pageHost: visitorPageHost(host),
			visitor: { hostname: '', addresses: [], tiles: [] },
		};
	}
};
