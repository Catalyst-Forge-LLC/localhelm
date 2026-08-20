import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { applyFetch, planFetch } from '../../../../../src/lib/index.js';
import { errJson, withJobLock } from '$lib/server/helm';

export const POST: RequestHandler = async () => {
	try {
		return json(
			await withJobLock(async (loaded) => {
				const planned = await planFetch(loaded);
				const rows = planned.map((row) => applyFetch(loaded.workspaceRoot, row));
				return { rows };
			}),
		);
	} catch (err) {
		return errJson(err);
	}
};
