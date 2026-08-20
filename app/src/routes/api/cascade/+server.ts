import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { applyCascade, planCascade } from '../../../../../src/lib/index.js';
import { errJson, loadRequired, withLockAt } from '$lib/server/helm';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as {
			id?: string;
			to?: string;
			apply?: boolean;
			commit?: boolean;
		};
		if (!body.id) return errJson('id required');
		const loaded = await loadRequired();
		const plan = await planCascade(loaded, body.id, {
			to: body.to,
			commit: body.commit !== false,
		});
		if (!body.apply) return json({ ...plan, writes: false });
		return json(await withLockAt(loaded.workspaceRoot, () => applyCascade(plan)));
	} catch (err) {
		return errJson(err);
	}
};
