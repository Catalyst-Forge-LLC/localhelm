import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clearLocalOnly, markLocalOnly, readLocalOnly } from '../../../../../src/lib/index.js';
import { errJson, loadOptional, operatorCwd } from '$lib/server/helm';

async function localRoot(): Promise<string> {
	const loaded = await loadOptional();
	return loaded?.workspaceRoot ?? operatorCwd();
}

export const GET: RequestHandler = async () => {
	try {
		return json(await readLocalOnly(await localRoot()));
	} catch (err) {
		return errJson(err);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json().catch(() => ({}))) as {
			ids?: unknown;
			restore?: unknown;
		};
		const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === 'string') : [];
		if (!ids.length) return errJson(new Error('ids required'));
		const root = await localRoot();
		const file = body.restore ? await clearLocalOnly(root, ids) : await markLocalOnly(root, ids);
		return json(file);
	} catch (err) {
		return errJson(err);
	}
};
