import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadPlugins, requirePlugin } from '../../../../../src/lib/index.js';
import { errJson, loadRequired, withLockAt } from '$lib/server/helm';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as {
			id?: string;
			action?: string;
			ids?: string[];
			apply?: boolean;
		};
		if (!body.id || !body.action) return errJson('id and action required');
		const loaded = await loadRequired();
		const plug = requirePlugin(await loadPlugins(loaded), body.id);
		const ids = body.ids ?? [];
		if (!body.apply) {
			if (!plug.plugin.plan) return errJson(`plugin ${body.id} has no plan`);
			return json(await plug.plugin.plan(body.action, ids));
		}
		if (!plug.plugin.apply) return errJson(`plugin ${body.id} has no apply`);
		return json(await withLockAt(loaded.workspaceRoot, () => plug.plugin.apply!(body.action as string, ids)));
	} catch (err) {
		return errJson(err);
	}
};
