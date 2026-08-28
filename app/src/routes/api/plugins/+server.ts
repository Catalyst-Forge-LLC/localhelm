import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadPluginDashboard, loadPlugins, setPluginEnabled } from '../../../../../src/lib/index.js';
import { errJson, loadRequired } from '$lib/server/helm';

export const GET: RequestHandler = async () => {
	try {
		const loaded = await loadRequired();
		return json(await loadPluginDashboard(loaded));
	} catch (err) {
		return errJson(err);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as { id?: string; enabled?: boolean };
		if (!body.id || typeof body.enabled !== 'boolean') return errJson('id and enabled required');
		const loaded = await loadRequired();
		const found = await loadPlugins(loaded);
		if (!found.some((plug) => plug.id === body.id)) {
			return errJson(`plugin not loaded: ${body.id}. Enroll the project that has localhelm.plugin.mjs.`);
		}
		await setPluginEnabled(loaded.workspaceRoot, body.id, body.enabled);
		return json(await loadPluginDashboard(loaded));
	} catch (err) {
		return errJson(err);
	}
};
