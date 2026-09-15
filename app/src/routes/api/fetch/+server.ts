import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { applyFetches, planFetch } from '../../../../../src/lib/index.js';
import { errJson, withJobLock } from '$lib/server/helm';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json().catch(() => ({}))) as { ids?: string[] };
		return json(
			await withJobLock(async (loaded) => {
				const planned = await planFetch(loaded, body.ids?.length ? body.ids : undefined);
				const rows = await applyFetches(loaded.workspaceRoot, planned);
				return { rows };
			}),
		);
	} catch (err) {
		return errJson(err);
	}
};
