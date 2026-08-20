import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { applyUnenroll, planUnenroll } from '../../../../../src/lib/index.js';
import { errJson, loadRequired, withLockAt } from '$lib/server/helm';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as { ids?: string[]; apply?: boolean };
		if (!body.ids?.length) return errJson('ids required');
		const loaded = await loadRequired();
		const plan = await planUnenroll(body.ids, loaded);
		if (body.apply) {
			await withLockAt(loaded.workspaceRoot, async () => {
				await applyUnenroll(plan, loaded);
				plan.writes = true;
			});
		}
		return json(plan);
	} catch (err) {
		return errJson(err);
	}
};
