import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadPlugins } from '../../../../../src/lib/index.js';
import { errJson, loadRequired } from '$lib/server/helm';

export const GET: RequestHandler = async () => {
	try {
		const loaded = await loadRequired();
		const plugins = await loadPlugins(loaded);
		const boards = [];
		for (const plug of plugins) {
			boards.push(await plug.plugin.board());
		}
		return json({
			plugins: plugins.map((p) => ({ id: p.id, label: p.label, source: p.source })),
			boards,
		});
	} catch (err) {
		return errJson(err);
	}
};
