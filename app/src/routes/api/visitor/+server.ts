import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { asPluginBoards, loadPlugins } from '../../../../../src/lib/index.js';
import { visitorSnapshotFromBoards } from '../../../../../src/lib/visitorMachine.js';
import { errJson, loadOptional } from '$lib/server/helm';

export const GET: RequestHandler = async () => {
	try {
		const loaded = await loadOptional();
		if (!loaded) return json({ hostname: '', addresses: [], tiles: [] });
		const plugins = await loadPlugins(loaded);
		const boards = [];
		for (const plug of plugins) {
			boards.push(...asPluginBoards(await plug.plugin.board()));
		}
		const helmPort = Number(process.env.LOCALHELM_PORT);
		return json(
			visitorSnapshotFromBoards(boards, {
				helmPort: Number.isInteger(helmPort) ? helmPort : undefined,
			}),
		);
	} catch (err) {
		return errJson(err);
	}
};
