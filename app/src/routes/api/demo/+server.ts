import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { applyClearDemo, isDemoMode, planClearDemo } from '../../../../../src/lib/index.js';
import { errJson, loadOptional, withLockAt } from '$lib/server/helm';

export const POST: RequestHandler = async ({ request }) => {
	try {
		if (!isDemoMode()) return errJson('Demo board is off.');
		const body = (await request.json()) as { apply?: boolean };
		const loaded = await loadOptional();
		if (!loaded) return errJson('No workspace.');
		if (body.apply) {
			return json(
				await withLockAt(loaded.workspaceRoot, () => applyClearDemo(loaded.workspaceRoot), {
					allowInDemo: true,
				}),
			);
		}
		return json(await planClearDemo(loaded.workspaceRoot));
	} catch (err) {
		return errJson(err);
	}
};
