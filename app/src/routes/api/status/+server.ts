import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fleetStatus } from '../../../../../src/lib/index.js';
import { errJson, loadOptional, operatorCwd } from '$lib/server/helm';

function listen(): { port: string | null; portSource: string | null } {
	return {
		port: process.env.LOCALHELM_PORT ?? null,
		portSource: process.env.LOCALHELM_PORT_SOURCE ?? null,
	};
}

export const GET: RequestHandler = async ({ url }) => {
	try {
		const loaded = await loadOptional();
		const cwd = operatorCwd();
		if (!loaded) {
			return json({ inventory: null, workspaceRoot: null, scanRoot: cwd, cwd, ...listen() });
		}
		const fetchRemotes = url.searchParams.get('fetch') === '1';
		const inventory = await fleetStatus(loaded, { fetch: fetchRemotes });
		return json({
			inventory,
			workspaceRoot: loaded.workspaceRoot,
			scanRoot: loaded.workspaceRoot,
			cwd,
			fetched: fetchRemotes,
			...listen(),
		});
	} catch (err) {
		return errJson(err);
	}
};
