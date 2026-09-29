import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadPluginBoard, loadPluginDashboard, loadPlugins, setPluginEnabled } from '../../../../../src/lib/index.js';
import { errJson, loadRequired } from '$lib/server/helm';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const loaded = await loadRequired();
		const id = url.searchParams.get('id')?.trim() ?? '';
		if (!id) return json(await loadPluginDashboard(loaded));
		if (!/^[a-z][a-z0-9-]*$/.test(id)) return errJson('bad plugin id');
		return json(await loadPluginBoard(loaded, id));
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
